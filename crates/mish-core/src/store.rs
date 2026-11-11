//! Snapshot catalog and background scan jobs.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use mish_ipc::{ScanOptions, ScanProgress, ScanState, ScanSummary};

use crate::docker::{overlay_labels, DockerCollector};
use crate::error::{CoreError, Result};
use crate::index::{now_ms, IndexReader, IndexWriter, Manifest, ManifestSeed};
use crate::scanner::{canonical_root, platform_fs, scan, LabelIndex, Previous, Progress};

struct Job {
    summary: ScanSummary,
    progress: ScanProgress,
    cancel: Arc<AtomicBool>,
}

/// A snapshot id is a single path component. Rejecting separators, absolute
/// paths and `.`/`..` keeps every store operation inside `snapshots_dir`.
fn validate_snapshot_id(id: &str) -> Result<()> {
    if id.is_empty() || id.len() > 128 {
        return Err(CoreError::Config("invalid snapshot id".into()));
    }
    if id.eq_ignore_ascii_case("blocks") {
        return Err(CoreError::Config("reserved snapshot id".into()));
    }
    if !id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(CoreError::Config("invalid snapshot id".into()));
    }
    Ok(())
}

/// Maximum number of roots and exclusions accepted for one scan. These bound
/// the work an unauthenticated caller can request through the API.
const MAX_SCAN_ROOTS: usize = 32;
const MAX_SCAN_EXCLUSIONS: usize = 128;
const MAX_EXCLUSION_LEN: usize = 1024;
/// Maximum number of scans running at once. Additional requests fail fast
/// instead of exhausting threads, file handles and disk.
const MAX_CONCURRENT_SCANS: usize = 4;

/// Owns the data directory and the running/completed scans.
pub struct Store {
    data_dir: PathBuf,
    snapshots_dir: PathBuf,
    jobs: Arc<Mutex<HashMap<String, Job>>>,
    docker: Option<DockerCollector>,
}

impl Store {
    pub fn new(data_dir: impl Into<PathBuf>) -> Result<Self> {
        Self::new_with_docker(data_dir, true)
    }

    /// Build a store with Docker collection explicitly enabled or disabled.
    pub fn new_with_docker(data_dir: impl Into<PathBuf>, docker_enabled: bool) -> Result<Self> {
        let data_dir = data_dir.into();
        std::fs::create_dir_all(&data_dir)?;
        // Canonicalize so the data-dir exclusion matches the absolute paths the
        // scanner reports, even when the configured value was relative.
        let data_dir = std::fs::canonicalize(&data_dir)?;
        let snapshots_dir = data_dir.join("snapshots");
        std::fs::create_dir_all(&snapshots_dir)?;
        Ok(Self {
            data_dir,
            snapshots_dir,
            jobs: Arc::new(Mutex::new(HashMap::new())),
            docker: docker_enabled.then(DockerCollector::from_env),
        })
    }

    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    pub fn snapshots_dir(&self) -> &Path {
        &self.snapshots_dir
    }

    /// Resolve a snapshot id to a directory, rejecting anything that could
    /// escape the snapshots directory.
    pub fn snapshot_path(&self, id: &str) -> Result<PathBuf> {
        validate_snapshot_id(id)?;
        Ok(self.snapshots_dir.join(id))
    }

    /// All known scans: completed snapshots on disk plus live jobs.
    pub fn list(&self) -> Vec<ScanSummary> {
        let mut out: Vec<ScanSummary> = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&self.snapshots_dir) {
            for entry in entries.flatten() {
                let dir_name = entry.file_name().to_string_lossy().into_owned();
                if validate_snapshot_id(&dir_name).is_err() {
                    continue;
                }
                let manifest = entry.path().join("manifest.json");
                if let Ok(bytes) = std::fs::read(&manifest) {
                    if let Ok(m) = serde_json::from_slice::<Manifest>(&bytes) {
                        // A manifest whose id disagrees with its directory is
                        // not a snapshot this store created; ignore it so GC
                        // can never be steered at another path.
                        if m.id == dir_name {
                            out.push(manifest_to_summary(&m));
                        }
                    }
                }
            }
        }
        if let Ok(jobs) = self.jobs.lock() {
            for job in jobs.values() {
                if job.summary.state == ScanState::Running || job.summary.state == ScanState::Queued
                {
                    out.push(job.summary.clone());
                }
            }
        }
        out.sort_by_key(|s| std::cmp::Reverse(s.started_at_ms));
        out
    }

    pub fn get(&self, id: &str) -> Option<ScanSummary> {
        if let Ok(jobs) = self.jobs.lock() {
            if let Some(job) = jobs.get(id) {
                return Some(job.summary.clone());
            }
        }
        let path = self.snapshot_path(id).ok()?;
        let bytes = std::fs::read(path.join("manifest.json")).ok()?;
        let manifest: Manifest = serde_json::from_slice(&bytes).ok()?;
        Some(manifest_to_summary(&manifest))
    }

    pub fn progress(&self, id: &str) -> Option<ScanProgress> {
        if let Ok(jobs) = self.jobs.lock() {
            if let Some(job) = jobs.get(id) {
                return Some(job.progress.clone());
            }
        }
        let summary = self.get(id)?;
        Some(ScanProgress {
            scan_id: summary.id,
            state: summary.state,
            files: summary.files,
            dirs: summary.dirs,
            bytes_apparent: summary.bytes_apparent,
            bytes_alloc: summary.bytes_alloc,
            errors: summary.errors,
            elapsed_ms: (summary.finished_at_ms.unwrap_or(summary.started_at_ms)
                - summary.started_at_ms)
                .max(0) as u64,
            eta_ms: None,
            current_path: None,
        })
    }

    pub fn open(&self, id: &str) -> Result<IndexReader> {
        IndexReader::open(&self.snapshot_path(id)?)
    }

    /// Start a scan in the background and return its initial summary.
    pub fn start(&self, options: ScanOptions) -> Result<ScanSummary> {
        if options.roots.is_empty() {
            return Err(CoreError::Config("scan requires at least one root".into()));
        }
        if options.roots.len() > MAX_SCAN_ROOTS {
            return Err(CoreError::Config(format!(
                "too many scan roots (max {MAX_SCAN_ROOTS})"
            )));
        }
        if options.exclusions.len() > MAX_SCAN_EXCLUSIONS {
            return Err(CoreError::Config(format!(
                "too many exclusions (max {MAX_SCAN_EXCLUSIONS})"
            )));
        }
        if options
            .exclusions
            .iter()
            .any(|e| e.len() > MAX_EXCLUSION_LEN)
        {
            return Err(CoreError::Config(format!(
                "exclusion is longer than {MAX_EXCLUSION_LEN} bytes"
            )));
        }
        if let Ok(jobs) = self.jobs.lock() {
            let running = jobs
                .values()
                .filter(|job| matches!(job.summary.state, ScanState::Running | ScanState::Queued))
                .count();
            if running >= MAX_CONCURRENT_SCANS {
                return Err(CoreError::Config(format!(
                    "too many concurrent scans (max {MAX_CONCURRENT_SCANS})"
                )));
            }
        }

        let mut options = options;
        // Never index the store's own data directory, even when a root contains it.
        // Escape the paths because they are turned into glob patterns below.
        let blocks_dir = self.snapshots_dir.join("blocks");
        for path in [
            self.data_dir.as_path(),
            self.snapshots_dir.as_path(),
            blocks_dir.as_path(),
        ] {
            let escaped = globset::escape(&path.to_string_lossy());
            options.exclusions.push(escaped.clone());
            options.exclusions.push(format!("{escaped}/**"));
        }
        let roots: Vec<PathBuf> = options
            .roots
            .iter()
            .map(|r| canonical_root(r))
            .collect::<Result<_>>()?;

        let id = new_id();
        let snap = self.snapshot_path(&id)?;
        let started = now_ms();

        let summary = ScanSummary {
            id: id.clone(),
            parent_id: None,
            state: ScanState::Running,
            roots: options.roots.clone(),
            started_at_ms: started,
            finished_at_ms: None,
            files: 0,
            dirs: 0,
            bytes_apparent: 0,
            bytes_alloc: 0,
            errors: 0,
        };
        let progress = ScanProgress {
            scan_id: id.clone(),
            state: ScanState::Running,
            files: 0,
            dirs: 0,
            bytes_apparent: 0,
            bytes_alloc: 0,
            errors: 0,
            elapsed_ms: 0,
            eta_ms: None,
            current_path: None,
        };
        let cancel = Arc::new(AtomicBool::new(false));

        if let Ok(mut jobs) = self.jobs.lock() {
            jobs.insert(
                id.clone(),
                Job {
                    summary: summary.clone(),
                    progress,
                    cancel: cancel.clone(),
                },
            );
        }

        let jobs = self.jobs.clone();
        let job_id = id.clone();
        let roots_for_thread = roots;
        let options_for_thread = options.clone();
        let snapshots_dir = self.snapshots_dir.clone();
        // Enumerating Docker is deferred into the scan thread so the scan-start
        // RPC is not gated on N+1 Docker Engine calls.
        let docker = self.docker.clone();
        thread::spawn(move || {
            let labels = docker.as_ref().map(docker_label_index).unwrap_or_default();
            run_scan(
                jobs,
                job_id,
                snap,
                snapshots_dir,
                roots_for_thread,
                options_for_thread,
                started,
                cancel,
                labels,
            );
        });

        Ok(summary)
    }

    pub fn cancel(&self, id: &str) -> bool {
        if let Ok(jobs) = self.jobs.lock() {
            if let Some(job) = jobs.get(id) {
                job.cancel.store(true, Ordering::Relaxed);
                return true;
            }
        }
        false
    }

    pub fn delete(&self, id: &str) -> Result<()> {
        if let Ok(mut jobs) = self.jobs.lock() {
            if let Some(job) = jobs.get(id) {
                job.cancel.store(true, Ordering::Relaxed);
                jobs.remove(id);
            }
        }
        let path = self.snapshot_path(id)?;
        if path.exists() {
            std::fs::remove_dir_all(path)?;
        }
        Ok(())
    }

    /// Delete completed snapshots beyond the newest `keep`.
    pub fn gc(&self, keep: usize) -> Result<Vec<String>> {
        let mut scans: Vec<ScanSummary> = self
            .list()
            .into_iter()
            .filter(|s| s.state == ScanState::Completed)
            .collect();
        scans.sort_by_key(|s| std::cmp::Reverse(s.started_at_ms));
        let mut removed = Vec::new();
        for scan in scans.into_iter().skip(keep) {
            self.delete(&scan.id)?;
            removed.push(scan.id);
        }
        // Sweep CAS blocks no longer referenced by any live manifest.
        let _ = sweep_blocks(&self.snapshots_dir);
        Ok(removed)
    }
}

/// Resolve Docker overlay2 layer directories to owner labels for a scan.
/// Best-effort: when the Docker socket is missing or errors, no labels are
/// attached and the scan proceeds unchanged.
fn docker_label_index(docker: &DockerCollector) -> LabelIndex {
    let host_root = crate::docker::host_root();
    let Ok(containers) = docker.containers_detailed() else {
        return LabelIndex::new();
    };
    let mut index = LabelIndex::new();
    for (path, label) in overlay_labels(&containers, &host_root) {
        index.insert(path, label);
    }
    index
}

#[allow(clippy::too_many_arguments)]
fn run_scan(
    jobs: Arc<Mutex<HashMap<String, Job>>>,
    id: String,
    snap: PathBuf,
    snapshots_dir: PathBuf,
    roots: Vec<PathBuf>,
    options: ScanOptions,
    started: i64,
    cancel: Arc<AtomicBool>,
    labels: LabelIndex,
) {
    let fs = platform_fs();
    let mut writer = match IndexWriter::create(&snap) {
        Ok(w) => w,
        Err(e) => return finish_failed(&jobs, &id, e.to_string()),
    };

    let previous = if options.incremental {
        latest_completed(&snapshots_dir, &snap)
            .and_then(|dir| IndexReader::open(&dir).ok())
            .map(Previous::build)
    } else {
        None
    };

    let jobs_cb = jobs.clone();
    let id_cb = id.clone();
    let mut on_progress = move |p: &Progress| {
        if let Ok(mut map) = jobs_cb.lock() {
            if let Some(job) = map.get_mut(&id_cb) {
                job.progress.files = p.files;
                job.progress.dirs = p.dirs;
                job.progress.bytes_apparent = p.bytes_apparent;
                job.progress.bytes_alloc = p.bytes_alloc;
                job.progress.errors = p.errors;
                job.progress.elapsed_ms = p.elapsed_ms;
                job.progress.current_path = Some(p.current_path.clone());
                job.summary.files = p.files;
                job.summary.dirs = p.dirs;
                job.summary.bytes_apparent = p.bytes_apparent;
                job.summary.bytes_alloc = p.bytes_alloc;
                job.summary.errors = p.errors;
            }
        }
    };

    let result = scan(
        &mut writer,
        &roots,
        &options,
        fs.as_ref(),
        &cancel,
        previous.as_ref(),
        &labels,
        &mut on_progress,
    );
    if let Err(e) = result {
        let _ = std::fs::remove_dir_all(&snap);
        let state = if cancel.load(Ordering::Relaxed) {
            ScanState::Cancelled
        } else {
            ScanState::Failed
        };
        return finish_state(&jobs, &id, state, Some(e.to_string()));
    }

    match writer.finish(ManifestSeed {
        id: id.clone(),
        parent_id: None,
        roots: roots
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect(),
        started_at_ms: started,
    }) {
        Ok(manifest) => {
            if let Ok(mut map) = jobs.lock() {
                if let Some(job) = map.get_mut(&id) {
                    job.summary.state = ScanState::Completed;
                    job.summary.finished_at_ms = Some(manifest.finished_at_ms);
                    job.summary.files = manifest.stats.files;
                    job.summary.dirs = manifest.stats.dirs;
                    job.summary.bytes_apparent = manifest.stats.bytes_apparent;
                    job.summary.bytes_alloc = manifest.stats.bytes_alloc;
                    job.summary.errors = manifest.stats.errors;
                    job.progress.state = ScanState::Completed;
                }
            }
        }
        Err(e) => {
            let _ = std::fs::remove_dir_all(&snap);
            finish_failed(&jobs, &id, e.to_string());
        }
    }
}

fn finish_failed(jobs: &Arc<Mutex<HashMap<String, Job>>>, id: &str, message: String) {
    finish_state(jobs, id, ScanState::Failed, Some(message));
}

fn finish_state(
    jobs: &Arc<Mutex<HashMap<String, Job>>>,
    id: &str,
    state: ScanState,
    _message: Option<String>,
) {
    if let Ok(mut map) = jobs.lock() {
        if let Some(job) = map.get_mut(id) {
            job.summary.state = state;
            job.summary.finished_at_ms = Some(now_ms());
            job.progress.state = state;
        }
    }
}

fn manifest_to_summary(m: &Manifest) -> ScanSummary {
    ScanSummary {
        id: m.id.clone(),
        parent_id: m.parent_id.clone(),
        state: ScanState::Completed,
        roots: m.roots.clone(),
        started_at_ms: m.started_at_ms,
        finished_at_ms: Some(m.finished_at_ms),
        files: m.stats.files,
        dirs: m.stats.dirs,
        bytes_apparent: m.stats.bytes_apparent,
        bytes_alloc: m.stats.bytes_alloc,
        errors: m.stats.errors,
    }
}

/// Delete CAS blocks not referenced by any live snapshot manifest.
fn sweep_blocks(snapshots_dir: &Path) -> Result<usize> {
    let cas_dir = snapshots_dir.join("blocks");
    if !cas_dir.exists() {
        return Ok(0);
    }
    let mut referenced: std::collections::HashSet<String> = std::collections::HashSet::new();
    for entry in std::fs::read_dir(snapshots_dir)?.flatten() {
        let dir_name = entry.file_name().to_string_lossy().into_owned();
        if validate_snapshot_id(&dir_name).is_err() {
            continue;
        }
        let manifest_path = entry.path().join("manifest.json");
        if let Ok(bytes) = std::fs::read(&manifest_path) {
            if let Ok(manifest) = serde_json::from_slice::<Manifest>(&bytes) {
                if manifest.id != dir_name {
                    continue;
                }
                for block in &manifest.blocks {
                    referenced.insert(block.hash.clone());
                }
            }
        }
    }
    let mut removed = 0usize;
    for shard in std::fs::read_dir(&cas_dir)?.flatten() {
        // Do not follow a symlinked shard: sweep only real CAS directories.
        if !shard.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        for file in std::fs::read_dir(shard.path())?.flatten() {
            if !file.file_type().map(|t| t.is_file()).unwrap_or(false) {
                continue;
            }
            let name = file.file_name().to_string_lossy().into_owned();
            if !referenced.contains(&name) && std::fs::remove_file(file.path()).is_ok() {
                removed += 1;
            }
        }
    }
    Ok(removed)
}

/// Newest completed snapshot directory other than `current`, for incremental reuse.
fn latest_completed(snapshots_dir: &Path, current: &Path) -> Option<PathBuf> {
    let mut best: Option<(i64, PathBuf)> = None;
    for entry in std::fs::read_dir(snapshots_dir).ok()?.flatten() {
        let dir = entry.path();
        if dir == current {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().into_owned();
        if validate_snapshot_id(&dir_name).is_err() {
            continue;
        }
        let Ok(bytes) = std::fs::read(dir.join("manifest.json")) else {
            continue;
        };
        let Ok(manifest) = serde_json::from_slice::<Manifest>(&bytes) else {
            continue;
        };
        if manifest.id != dir_name {
            continue;
        }
        if best
            .as_ref()
            .map(|(ms, _)| manifest.finished_at_ms > *ms)
            .unwrap_or(true)
        {
            best = Some((manifest.finished_at_ms, dir));
        }
    }
    best.map(|(_, dir)| dir)
}

fn new_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos:x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_path_rejects_traversal_and_reserved_names() {
        let tmp = tempfile::tempdir().unwrap();
        let store = Store::new(tmp.path()).unwrap();
        for id in [
            "",
            ".",
            "..",
            "../victim",
            "a/b",
            "a\\b",
            "/etc",
            "C:\\Windows",
            "blocks",
            "BLOCKS",
            "a\0b",
        ] {
            assert!(store.snapshot_path(id).is_err(), "accepted {id:?}");
        }
        assert!(store.snapshot_path("snap1").is_ok());
        assert!(store.snapshot_path("0123abcd").is_ok());
    }

    #[test]
    fn delete_rejects_traversal_without_touching_outside_directories() {
        let tmp = tempfile::tempdir().unwrap();
        let store = Store::new(tmp.path()).unwrap();
        let victim = tmp.path().join("victim");
        std::fs::create_dir_all(victim.join("keep")).unwrap();
        std::fs::write(victim.join("keep/file.txt"), b"keep").unwrap();

        assert!(store.delete("../victim").is_err());
        assert!(victim.join("keep/file.txt").exists());

        let blocks = store.snapshots_dir().join("blocks");
        std::fs::create_dir_all(blocks.join("aa")).unwrap();
        std::fs::write(blocks.join("aa/block"), b"x").unwrap();
        assert!(store.delete("blocks").is_err());
        assert!(blocks.join("aa/block").exists());
    }

    #[test]
    fn start_rejects_unbounded_roots_and_exclusions() {
        let tmp = tempfile::tempdir().unwrap();
        let store = Store::new(tmp.path()).unwrap();
        let mut options = ScanOptions::new(vec!["/tmp".into(); MAX_SCAN_ROOTS + 1]);
        assert!(store.start(options.clone()).is_err());
        options.roots = vec!["/tmp".into()];
        options.exclusions = vec!["x".into(); MAX_SCAN_EXCLUSIONS + 1];
        assert!(store.start(options).is_err());
    }
}
