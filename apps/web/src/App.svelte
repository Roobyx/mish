<script lang="ts">
  import type {
    DriveInfo,
    HealthResponse,
    HeatmapResponse,
    HierarchyNode,
    HistogramBucket,
    NodeRecord,
    ScanSummary,
    Tile,
  } from "@mish/api-types";
  import { onDestroy, onMount } from "svelte";

  import Bars from "./components/Bars.svelte";
  import Breadcrumb from "./components/Breadcrumb.svelte";
  import Breakdown from "./components/Breakdown.svelte";
  import Bubble from "./components/Bubble.svelte";
  import DiffPanel from "./components/DiffPanel.svelte";
  import DockerPanel from "./components/DockerPanel.svelte";
  import DriveStats from "./components/DriveStats.svelte";
  import DrivesDashboard from "./components/DrivesDashboard.svelte";
  import DuplicatesPanel from "./components/DuplicatesPanel.svelte";
  import FileTypes from "./components/FileTypes.svelte";
  import Heatmap from "./components/Heatmap.svelte";
  import Histogram from "./components/Histogram.svelte";
  import Icicle from "./components/Icicle.svelte";
  import Icon from "./components/Icon.svelte";
  import Logo from "./components/Logo.svelte";
  import Modal from "./components/Modal.svelte";
  import RankedTable from "./components/RankedTable.svelte";
  import ReportMenu from "./components/ReportMenu.svelte";
  import ReportViewer from "./components/ReportViewer.svelte";
  import ScanLauncher from "./components/ScanLauncher.svelte";
  import ScanProgressPanel from "./components/ScanProgressPanel.svelte";
  import ScanSwitcher from "./components/ScanSwitcher.svelte";
  import SearchPanel from "./components/SearchPanel.svelte";
  import SchedulesPanel from "./components/SchedulesPanel.svelte";
  import SettingsPanel from "./components/SettingsPanel.svelte";
  import Spinner from "./components/Spinner.svelte";
  import Sunburst from "./components/Sunburst.svelte";
  import ThemeSwitcher from "./components/ThemeSwitcher.svelte";
  import Treemap from "./components/Treemap.svelte";
  import {
    errorMessage,
    getChildren,
    getDrives,
    getHealth,
    getHeatmap,
    getHistogram,
    getScan,
    getTiles,
    getTop,
    getTree,
    listScans,
  } from "./lib/api.js";
  import type { HistogramDim } from "./lib/api.js";
  import type { ColorMode } from "./lib/color.js";
  import { fileTypeLabel, groupOfExtension } from "./lib/file-types.js";
  import { formatAgo, formatBytes } from "./lib/format.js";
  import type { IconName } from "./lib/icons.js";
  import { type MishReport, reportTypeLabel } from "./lib/report.js";
  import {
    applyTheme,
    readStoredTheme,
    storeTheme,
    themeById,
    type ThemeId,
  } from "./lib/theme.js";

  type ViewId =
    | "dashboard"
    | "treemap"
    | "sunburst"
    | "icicle"
    | "bubble"
    | "bars"
    | "histogram"
    | "heatmap"
    | "extensions"
    | "age"
    | "owners"
    | "docker"
    | "duplicates"
    | "diff"
    | "schedules"
    | "settings";

  interface ViewDef {
    id: ViewId;
    label: string;
    icon: IconName;
    hint: string;
  }

  const VIEWS: ViewDef[] = [
    {
      id: "dashboard",
      label: "Drives",
      icon: "hard-drive",
      hint: "Host filesystems and their newest snapshots",
    },
    {
      id: "treemap",
      label: "Treemap",
      icon: "treemap",
      hint: "Area-proportional map of the current scope",
    },
    {
      id: "sunburst",
      label: "Sunburst",
      icon: "pie-chart",
      hint: "Radial hierarchy of the current scope",
    },
    {
      id: "icicle",
      label: "Icicle",
      icon: "layers",
      hint: "Layered hierarchy of the current scope",
    },
    {
      id: "bubble",
      label: "Bubble",
      icon: "bubbles",
      hint: "Packed bubbles for the current scope",
    },
    {
      id: "bars",
      label: "Bars",
      icon: "bar-chart",
      hint: "Largest items in the current scope",
    },
    {
      id: "histogram",
      label: "Histogram",
      icon: "activity",
      hint: "Size distribution across the scope",
    },
    {
      id: "heatmap",
      label: "Heatmap",
      icon: "grid",
      hint: "Directory density across the scope",
    },
    {
      id: "extensions",
      label: "Extensions",
      icon: "file",
      hint: "Space used by file type",
    },
    {
      id: "age",
      label: "Age",
      icon: "clock",
      hint: "Space by modification age",
    },
    {
      id: "owners",
      label: "Owners",
      icon: "users",
      hint: "Space by file owner",
    },
    {
      id: "docker",
      label: "Docker",
      icon: "box",
      hint: "Read-only container footprint",
    },
    {
      id: "duplicates",
      label: "Duplicates",
      icon: "copy",
      hint: "Repeated files and the space they waste",
    },
    {
      id: "diff",
      label: "Diff",
      icon: "git-compare",
      hint: "Compare two snapshots",
    },
    {
      id: "schedules",
      label: "Schedules",
      icon: "calendar",
      hint: "Recurring scans",
    },
  ];

  interface NavGroup {
    label: string;
    items: ViewDef[];
  }

  const NAV_GROUPS: NavGroup[] = [
    { label: "Overview", items: VIEWS.filter((entry) => entry.id === "dashboard") },
    {
      label: "Analyze",
      items: VIEWS.filter((entry) =>
        ["treemap", "sunburst", "icicle", "bubble", "bars"].includes(entry.id),
      ),
    },
    {
      label: "Insights",
      items: VIEWS.filter((entry) =>
        ["histogram", "heatmap", "extensions", "age", "owners"].includes(entry.id),
      ),
    },
    {
      label: "Operate",
      items: VIEWS.filter((entry) =>
        ["docker", "duplicates", "diff", "schedules"].includes(entry.id),
      ),
    },
  ];

  interface Crumb {
    id: number;
    name: string;
  }

  interface HashState {
    view: ViewId;
    scope: number | null;
    color: ColorMode;
    q: string;
  }

  function parseHash(): HashState {
    const raw =
      typeof window !== "undefined" && window.location.hash.length > 1
        ? window.location.hash.slice(1)
        : "";
    const params = new URLSearchParams(raw);
    const viewParam = params.get("view");
    const matched = VIEWS.find((entry) => entry.id === viewParam);
    const scopeRaw = params.get("scope");
    const scopeNum = scopeRaw === null ? Number.NaN : Number(scopeRaw);
    return {
      view: viewParam === "settings" ? "settings" : matched ? matched.id : "dashboard",
      scope: Number.isFinite(scopeNum) && scopeNum >= 0 ? scopeNum : null,
      color: params.get("color") === "ext" ? "ext" : "size",
      q: params.get("q") ?? "",
    };
  }

  const initial = parseHash();
  let pendingScope: number | null = initial.scope;

  let health = $state<HealthResponse | null>(null);
  let healthError = $state<string | null>(null);
  let scans = $state<ScanSummary[]>([]);
  let selectedId = $state<string | null>(null);

  let drives = $state<DriveInfo[]>([]);
  let drivesHostRoot = $state("/host");
  let drivesWarning = $state<string | null>(null);
  let drivesError = $state<string | null>(null);
  let drivesLoading = $state(false);

  let scopePath = $state<Crumb[]>([]);
  let scopeId = $state(0);

  let tiles = $state<Tile[]>([]);
  let childTotal = $state(0);
  let truncated = $state(false);

  let colorMode = $state<ColorMode>(initial.color);
  let view = $state<ViewId>(initial.view);
  let loading = $state(false);
  let tileBusy = $state(false);
  let childBusy = $state(false);
  let swhitching = $state(true);
  let error = $state<string | null>(null);

  let tree = $state<HierarchyNode | null>(null);
  let topNodes = $state<NodeRecord[]>([]);
  let histogram = $state<HistogramBucket[]>([]);
  /** File-type group the Extensions breakdown is filtered to, or null. */
  let extGroup = $state<string | null>(null);
  let heatmapData = $state<HeatmapResponse | null>(null);
  let viewLoading = $state(false);
  let viewError = $state<string | null>(null);

  let searchOpen = $state(initial.q.length > 0);
  let searchQuery = $state(initial.q);
  let launcherOpen = $state(false);
  let sidebarOpen = $state(false);

  /** Report opened from a `.mish` file, shown in a read-only viewer. */
  let reportView = $state<MishReport | null>(null);
  let toast = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  /** Selected colour theme, persisted in local storage. */
  let theme = $state<ThemeId>(readStoredTheme());

  /** Node id whose overlay tree is shown in the Docker side panel, or null when closed. */
  let sideTreeNodeId = $state<number | null>(null);

  let treemapHost = $state<HTMLDivElement | null>(null);
  let hostW = $state(0);
  let hostH = $state(0);
  let tilesSeq = 0;
  let childrenSeq = 0;
  let viewSeq = 0;
  let scanSeq = 0;
  let switchTimer: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    clearTimeout(switchTimer);
    clearTimeout(toastTimer);
  });

  function timestampOf(scan: ScanSummary): number {
    return scan.finishedAtMs ?? scan.startedAtMs;
  }

  function viewDef(id: ViewId): ViewDef {
    if (id === "settings") {
      return {
        id,
        label: "Settings",
        icon: "settings",
        hint: "Runtime status, snapshots and appearance",
      };
    }
    return (
      VIEWS.find((entry) => entry.id === id) ?? {
        id,
        label: id,
        icon: "file",
        hint: "",
      }
    );
  }

  const currentDef = $derived(viewDef(view));
  const currentGroup = $derived(
    view === "settings"
      ? "System"
      : (NAV_GROUPS.find((group) => group.items.some((entry) => entry.id === view))?.label ??
        "Overview"),
  );
  const activeTheme = $derived(themeById(theme));

  function chooseTheme(id: ThemeId): void {
    theme = id;
    applyTheme(id);
    storeTheme(id);
  }

  function go(next: ViewId): void {
    view = next;
    sidebarOpen = false;
    searchOpen = false;
  }

  function toggleSearch(): void {
    if (!selectedId) return;
    searchOpen = !searchOpen;
  }

  function showToast(message: string): void {
    toast = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 4_000);
  }

  function handleReportImport(report: MishReport): void {
    reportView = report;
  }

  /** Veil the shell while another snapshot is selected and its data arrives. */
  function beginSwitch(): void {
    swhitching = true;
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => (swhitching = false), 8000);
  }

  function endSwitch(): void {
    clearTimeout(switchTimer);
    swhitching = false;
  }

  function bucket(value: number): number {
    if (value <= 0) return 0;
    return Math.max(256, Math.round(value / 128) * 128);
  }

  const tileW = $derived(bucket(hostW));
  const tileH = $derived(bucket(hostH));
  const scopeLabel = $derived(scopePath[scopePath.length - 1]?.name ?? "/");
  const totalBytes = $derived(tiles.reduce((sum, tile) => sum + tile.size, 0));
  const isHierarchyView = $derived(view === "sunburst" || view === "icicle" || view === "bubble");

  const snapshotRoot = $derived.by(() => {
    const scan = scans.find((entry) => entry.id === selectedId);
    return scan?.roots[0] ?? null;
  });

  /** The current chart is rendered and safe to rasterize. */
  const canExportImage = $derived.by(() => {
    if (!selectedId || !treemapHost) return false;
    if (view === "treemap") return !loading && !error && tiles.length > 0;
    if (isHierarchyView) {
      return !viewLoading && !viewError && (tree?.children?.length ?? 0) > 0;
    }
    if (view === "bars") return !viewLoading && !viewError && topNodes.length > 0;
    if (view === "heatmap") return !viewLoading && !viewError && heatmapData !== null;
    if (
      view === "histogram" ||
      view === "extensions" ||
      view === "age" ||
      view === "owners"
    ) {
      return !viewLoading && !viewError && histogram.length > 0;
    }
    return false;
  });

  const completedScans = $derived(scans.filter((scan) => scan.state === "completed"));
  const newestCompleted = $derived.by(() => {
    let newest: ScanSummary | null = null;
    for (const scan of completedScans) {
      if (!newest || timestampOf(scan) > timestampOf(newest)) newest = scan;
    }
    return newest;
  });
  const totalCapacity = $derived(
    drives.reduce((sum, drive) => sum + (drive.totalBytes ?? 0), 0),
  );
  const coveredDriveCount = $derived(
    drives.filter((drive) =>
      completedScans.some((scan) => scan.roots.includes(drive.containerPath)),
    ).length,
  );

  const viewSummary = $derived.by(() => {
    if (view === "dashboard") return `${scans.length} snapshots`;
    if (view === "treemap") return `${formatBytes(totalBytes)}${truncated ? " · truncated" : ""}`;
    if (isHierarchyView) return tree ? formatBytes(tree.size) : "—";
    if (view === "bars") return `${topNodes.length} nodes`;
    if (view === "docker") return "containers";
    if (view === "duplicates") return "duplicate files";
    if (view === "diff") return "snapshot diff";
    if (view === "schedules") return "cron jobs";
    return `${histogram.length} buckets`;
  });

  /** Extensions breakdown rows, narrowed to the chosen file-type group. */
  const extItems = $derived.by(() =>
    extGroup === null
      ? histogram
      : histogram.filter((bucket) => groupOfExtension(bucket.key) === extGroup),
  );

  const breakdownTitle = $derived.by(() => {
    if (view === "extensions") {
      return extGroup === null ? "Extensions" : `Extensions · ${fileTypeLabel(extGroup)}`;
    }
    return view === "age" ? "Age" : "Owners";
  });

  const scopePathIds = $derived.by(() => scopePath.map((crumb) => crumb.id));

  /** The filesystem the selected snapshot scann, matched to the host drives. */
  const activeDrive = $derived.by(() => {
    const summary = scans.find((scan) => scan.id === selectedId);
    const root = summary ? (summary.roots[0] ?? "") : "";
    if (root.length === 0) return null;
    const same = drives.find((drive) => drive.containerPath === root);
    if (same) return same;
    let best: DriveInfo | null = null;
    for (const drive of drives) {
      if (root.slice(0, drive.containerPath.length) !== drive.containerPath) continue;
      if (!best || drive.containerPath.length > best.containerPath.length) best = drive;
    }
    return best;
  });

  /** The starting root of the snapshot, always the top row of the tree panel. */
  const treeRoot = $derived.by(() => {
    const root = scopePath[0];
    if (!root) return null;
    const summary = scans.find((scan) => scan.id === selectedId);
    return {
      id: root.id,
      name: root.name,
      size: summary?.bytesAlloc ?? 0,
      items: (summary?.files ?? 0) + (summary?.dirs ?? 0),
    };
  });

  async function loadScans(): Promise<void> {
    try {
      scans = await listScans();
    } catch (cause) {
      error = errorMessage(cause);
    }
  }

  async function loadDrives(): Promise<void> {
    drivesLoading = true;
    drivesError = null;
    try {
      const response = await getDrives();
      drives = response.drives;
      drivesHostRoot = response.hostRoot;
      drivesWarning = response.warning ?? null;
    } catch (cause) {
      drivesError = errorMessage(cause);
    } finally {
      drivesLoading = false;
    }
  }

  async function selectScan(id: string): Promise<void> {
    const seq = scanSeq + 1;
    scanSeq = seq;
    const changed = id !== selectedId;
    selectedId = id;
    if (changed) beginSwitch();
    const requested = pendingScope;
    pendingScope = null;
    scopeId = requested ?? 0;
    let summary = scans.find((scan) => scan.id === id) ?? null;
    if (!summary) {
      try {
        summary = await getScan(id);
      } catch (cause) {
        error = errorMessage(cause);
      }
    }
    if (seq !== scanSeq) return;
    scopePath = [{ id: requested ?? 0, name: summary?.roots[0] ?? "/" }];
    extGroup = null;
    // The treemap drops the veiled shell once its tiles for the new snapshot
    // arrive; every other view has nothing left to wait for.
    if (view !== "treemap") endSwitch();
  }

  async function handleCreated(id: string): Promise<void> {
    // A scan was started: refresh the list so it appears, and pick the newest
    // completed snapshot if nothing is selected. Progress is shown globally by
    // <ScanProgressPanel />, and we navigate when it finishes.
    await loadScans();
    if (!selectedId) {
      const newest = scans
        .filter((scan) => scan.state === "completed")
        .sort((a, b) => timestampOf(b) - timestampOf(a))[0];
      if (newest) await selectScan(newest.id);
    }
    void id;
  }

  async function handleScanFinished(id: string): Promise<void> {
    await loadScans();
    const scan = scans.find((entry) => entry.id === id);
    if (scan?.state === "completed") {
      await selectScan(id);
    }
  }

  async function handleScansChanged(): Promise<void> {
    await loadScans();
    if (!selectedId) return;
    if (scans.some((scan) => scan.id === selectedId)) return;
    const newest = scans
      .filter((scan) => scan.state === "completed")
      .sort((a, b) => timestampOf(b) - timestampOf(a))[0];
    if (newest) {
      await selectScan(newest.id);
    } else {
      selectedId = null;
      scopeId = 0;
      scopePath = [];
    }
  }

  function openLauncher(): void {
    launcherOpen = true;
  }

  async function handleLauncherCreated(id: string): Promise<void> {
    launcherOpen = false;
    await handleCreated(id);
  }

  /** Open a drive's snapshot from the dashboard. */
  async function openScan(id: string): Promise<void> {
    if (id.length === 0) return;
    view = "treemap";
    await selectScan(id);
  }

  async function loadTiles(
    scanId: string,
    scope: number,
    width: number,
    height: number,
    color: ColorMode,
  ): Promise<void> {
    const seq = tilesSeq + 1;
    tilesSeq = seq;
    loading = true;
    error = null;
    try {
      const response = await getTiles(scanId, { scope, depth: 1, w: width, h: height, color });
      if (seq !== tilesSeq) return;
      tiles = response.tiles;
      truncated = response.truncated;
      const root = scopePath[0];
      if (scopePath.length === 1 && root && root.id !== response.scope) {
        scopePath = [{ id: response.scope, name: root.name }];
      }
    } catch (cause) {
      if (seq !== tilesSeq) return;
      error = errorMessage(cause);
    } finally {
      if (seq !== tilesSeq) return;
      loading = false;
      endSwitch();
    }
  }

  async function loadChildren(scanId: string, scope: number): Promise<void> {
    const seq = childrenSeq + 1;
    childrenSeq = seq;
    childBusy = true;
    try {
      const response = await getChildren(scanId, scope, { sort: "size", limit: 1000 });
      if (seq !== childrenSeq) return;
      childTotal = response.total;
    } catch (cause) {
      if (seq !== childrenSeq) return;
      error = errorMessage(cause);
    } finally {
      if (seq === childrenSeq) childBusy = false;
    }
  }

  async function loadViewData(): Promise<void> {
    const scanId = selectedId;
    if (!scanId) return;
    const seq = viewSeq + 1;
    viewSeq = seq;
    viewError = null;
    if (isHierarchyView) {
      tree = null;
    } else if (view === "bars") {
      topNodes = [];
    } else if (view === "heatmap") {
      heatmapData = null;
    } else {
      histogram = [];
    }
    viewLoading = true;
    try {
      if (isHierarchyView) {
        const response = await getTree(scanId, scopeId, 3, 2000);
        if (seq !== viewSeq) return;
        tree = response.root;
      } else if (view === "bars") {
        const nodes = await getTop(scanId, { n: 25, scope: scopeId });
        if (seq !== viewSeq) return;
        topNodes = nodes;
      } else if (view === "heatmap") {
        const response = await getHeatmap(scanId, scopeId);
        if (seq !== viewSeq) return;
        heatmapData = response;
      } else {
        const dim: HistogramDim =
          view === "histogram" ? "size" : view === "age" ? "age" : view === "owners" ? "owner" : "ext";
        const response = await getHistogram(scanId, dim, scopeId);
        if (seq !== viewSeq) return;
        histogram = response.items;
      }
    } catch (cause) {
      if (seq !== viewSeq) return;
      viewError = errorMessage(cause);
    } finally {
      if (seq === viewSeq) viewLoading = false;
    }
  }

  function pushScope(id: number, name: string): void {
    scopePath = [...scopePath, { id, name }];
    scopeId = id;
    extGroup = null;
  }

  async function openTile(tile: Tile): Promise<void> {
    const scanId = selectedId;
    if (!scanId) return;
    tileBusy = true;
    try {
      const response = await getChildren(scanId, tile.node, { limit: 1, sort: "name" });
      if (response.total === 0) return;
      pushScope(tile.node, tile.name);
    } catch (cause) {
      error = errorMessage(cause);
    } finally {
      tileBusy = false;
    }
  }

  function openNode(node: NodeRecord): void {
    if (node.kind !== "directory") return;
    if (node.children <= 0 && node.hasChildren !== true) return;
    pushScope(node.id, node.name);
  }

  async function openHierarchy(node: HierarchyNode): Promise<void> {
    if (node.kind !== "directory") return;
    if (node.children && node.children.length > 0) {
      pushScope(node.id, node.name);
      return;
    }
    const scanId = selectedId;
    if (!scanId) return;
    tileBusy = true;
    try {
      const response = await getChildren(scanId, node.id, { limit: 1, sort: "name" });
      if (response.total === 0) return;
      pushScope(node.id, node.name);
    } catch (cause) {
      error = errorMessage(cause);
    } finally {
      tileBusy = false;
    }
  }

  function navigate(index: number): void {
    const target = scopePath[index];
    if (!target) return;
    scopePath = scopePath.slice(0, index + 1);
    scopeId = target.id;
    extGroup = null;
  }

  async function openManagedScan(id: string): Promise<void> {
    view = "treemap";
    await selectScan(id);
  }

  onMount(() => {
    applyTheme(theme);

    function onKeydown(event: KeyboardEvent): void {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (selectedId) searchOpen = !searchOpen;
        return;
      }
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        if (selectedId) searchOpen = true;
        return;
      }
      if (event.key === "Escape") sidebarOpen = false;
    }

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  onMount(() => {
    void (async () => {
      // Arm the fallback for the initial veil: a hung API must never leave the
      // shell covered with no way to reach the launcher.
      beginSwitch();
      try {
        health = await getHealth();
      } catch (cause) {
        healthError = errorMessage(cause);
      }
      try {
        void loadDrives();
        await loadScans();
        const completed = scans
          .filter((scan) => scan.state === "completed")
          .sort((a, b) => timestampOf(b) - timestampOf(a));
        const newest = completed[0];
        if (newest) await selectScan(newest.id);
        // Nothing scann yet: the dashboard is empty, so offer the launcher.
        if (!newest) launcherOpen = true;
        // The treemap drops the veil once its tiles arrive; every other case has
        // nothing left to wait for.
        if (view !== "treemap" || !newest) endSwitch();
      } catch (cause) {
        error = errorMessage(cause);
        endSwitch();
      }
    })();
  });

  $effect(() => {
    const host = treemapHost;
    if (!host) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      hostW = entry.contentRect.width;
      hostH = entry.contentRect.height;
    });
    observer.observe(host);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (view !== "treemap") return;
    const scanId = selectedId;
    const scope = scopeId;
    const width = tileW;
    const height = tileH;
    const color = colorMode;
    if (!scanId || width <= 0 || height <= 0) return;
    void loadTiles(scanId, scope, width, height, color);
  });

  $effect(() => {
    const scanId = selectedId;
    const scope = scopeId;
    if (!scanId) return;
    void loadChildren(scanId, scope);
  });

  $effect(() => {
    const scanId = selectedId;
    const active = view;
    if (
      !scanId ||
      active === "dashboard" ||
      active === "treemap" ||
      active === "docker" ||
      active === "duplicates" ||
      active === "diff" ||
      active === "schedules" ||
      active === "settings"
    )
      return;
    void loadViewData();
  });

  $effect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    // The dashboard is the default view, so it stays out of the hash.
    if (view !== "dashboard") params.set("view", view);
    if (scopeId !== 0) params.set("scope", String(scopeId));
    params.set("color", colorMode);
    const trimmed = searchQuery.trim();
    if (trimmed.length > 0) params.set("q", trimmed);
    const hash = `#${params.toString()}`;
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
  });
</script>

<div class="shell">
  <aside class="sidebar" class:open={sidebarOpen}>
    <div class="sidebar-brand">
      <Logo size={32} />
      <div class="brand-text">
        <strong>mish</strong>
        <span>disk analyzer</span>
      </div>
      <button
        type="button"
        class="icon-button sidebar-close"
        aria-label="Close navigation"
        onclick={() => (sidebarOpen = false)}
      >
        <Icon name="x" size={16} />
      </button>
    </div>

    <nav class="sidebar-nav" aria-label="Views">
      {#each NAV_GROUPS as group (group.label)}
        <div class="nav-group">
          <span class="nav-label">{group.label}</span>
          {#each group.items as entry (entry.id)}
            <button
              type="button"
              class="nav-item"
              class:active={view === entry.id}
              aria-current={view === entry.id ? "page" : undefined}
              title={entry.hint}
              onclick={() => go(entry.id)}
            >
              <span class="nav-icon"><Icon name={entry.icon} size={16} /></span>
              <span class="nav-text">{entry.label}</span>
              {#if entry.id === "docker"}
                <span class="nav-badge">RO</span>
              {/if}
            </button>
          {/each}
        </div>
      {/each}
    </nav>

    <div class="sidebar-footer">
      <button
        type="button"
        class="nav-item"
        class:active={view === "settings"}
        aria-current={view === "settings" ? "page" : undefined}
        onclick={() => go("settings")}
      >
        <span class="nav-icon"><Icon name="settings" size={16} /></span>
        <span class="nav-text">Settings</span>
      </button>
      <div class="status-line">
        <span
          class="status-dot"
          class:ok={Boolean(health && !healthError)}
          class:err={Boolean(healthError)}
        ></span>
        <span class="truncate">
          {#if healthError}
            API unreachable
          {:else if health}
            API {health.status}
          {:else}
            Connecting…
          {/if}
        </span>
      </div>
      <div class="status-line subtle">
        <span class="truncate">protocol v{health?.protocol ?? "—"} · read-only</span>
      </div>
    </div>
  </aside>

  {#if sidebarOpen}
    <button
      type="button"
      class="sidebar-scrim"
      aria-label="Close navigation"
      onclick={() => (sidebarOpen = false)}
    ></button>
  {/if}

  <div class="workspace">
    <header class="topbar">
      <div class="topbar-left">
        <button
          type="button"
          class="icon-button menu-toggle"
          aria-label="Open navigation"
          onclick={() => (sidebarOpen = true)}
        >
          <Icon name="menu" size={17} />
        </button>
        <div class="page-id">
          <span class="eyebrow">{currentGroup}</span>
          <span class="page-name">{currentDef.label}</span>
        </div>
      </div>

      <div class="topbar-right">
        <ScanSwitcher
          {scans}
          {selectedId}
          {drives}
          disabled={swhitching}
          onselect={(id) => void selectScan(id)}
        />
        <ReportMenu
          view={view}
          snapshotId={selectedId}
          snapshotRoot={snapshotRoot}
          scopeId={scopeId}
          scopePath={scopePath}
          chartHost={treemapHost}
          canExportImage={canExportImage}
          tiles={tiles}
          colorMode={colorMode}
          onimport={handleReportImport}
          onnotice={showToast}
        />
        <button
          type="button"
          class="icon-button search-button"
          class:active={searchOpen}
          disabled={!selectedId}
          aria-pressed={searchOpen}
          aria-label="Search"
          title="Search (Ctrl K)"
          onclick={toggleSearch}
        >
          <Icon name="search" size={16} />
          <span class="kbd">/</span>
        </button>
        <span class="theme-slot"><ThemeSwitcher {theme} onselect={chooseTheme} /></span>
        <button type="button" class="action primary new-scan" onclick={openLauncher}>
          <Icon name="plus" size={15} />
          <span class="btn-label">New scan</span>
        </button>
      </div>
    </header>

    <div class="content">
      {#if searchOpen && selectedId}
        <section class="search-panel">
          <div class="panel-head">
            <div class="panel-title">
              <span class="panel-icon"><Icon name="search" size={15} /></span>
              <h2>Search</h2>
              <span class="kbd kbd-inline">Ctrl K</span>
            </div>
            <button
              type="button"
              class="icon-button"
              aria-label="Close search"
              onclick={() => (searchOpen = false)}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
          <SearchPanel scanId={selectedId} scope={scopeId} onselect={openNode} bind:q={searchQuery} />
        </section>
      {/if}

      {#if view === "dashboard"}
        <main class="page page-dashboard">
          <div class="page-head">
            <p class="subtitle">
              Host filesystems mounted read-only, with the newest snapshot for each. Scans never
              modify the files they read.
            </p>
          </div>

          <div class="stat-grid">
            <article class="stat">
              <span class="stat-label">Filesystems</span>
              <strong>{drives.length}</strong>
              <span class="stat-meta">{formatBytes(totalCapacity)} total capacity</span>
            </article>
            <article class="stat">
              <span class="stat-label">Snapshots</span>
              <strong>{completedScans.length}</strong>
              <span class="stat-meta">
                {#if scans.length > completedScans.length}
                  {scans.length - completedScans.length} in progress
                {:else}
                  all complete
                {/if}
              </span>
            </article>
            <article class="stat">
              <span class="stat-label">Latest index</span>
              <strong>{newestCompleted ? formatBytes(newestCompleted.bytesAlloc) : "—"}</strong>
              <span class="stat-meta">
                {#if newestCompleted}
                  {formatAgo(timestampOf(newestCompleted))}
                {:else}
                  no snapshot yet
                {/if}
              </span>
            </article>
            <article class="stat">
              <span class="stat-label">Coverage</span>
              <strong>{coveredDriveCount}/{drives.length}</strong>
              <span class="stat-meta">filesystems with a snapshot</span>
            </article>
          </div>

          <section class="panel">
            <div class="panel-head">
              <div class="panel-title">
                <span class="panel-icon"><Icon name="hard-drive" size={15} /></span>
                <h2>Mounted drives</h2>
              </div>
              <div class="panel-tools">
                <span class="pill">{viewSummary}</span>
              </div>
            </div>
            <div class="view-host">
              <DrivesDashboard
                {scans}
                {drives}
                hostRoot={drivesHostRoot}
                warning={drivesWarning}
                error={drivesError}
                loading={drivesLoading}
                onrefresh={loadDrives}
                onopen={openScan}
                oncreated={handleCreated}
              />
            </div>
          </section>
        </main>
      {:else if view === "settings"}
        <main class="page page-settings">
          <SettingsPanel
            {scans}
            {selectedId}
            {drives}
            {health}
            {healthError}
            {theme}
            ontheme={chooseTheme}
            onopen={openManagedScan}
            onchanged={handleScansChanged}
          />
        </main>
      {:else if view === "docker"}
        <main class="page page-solo">
          <div class="page-head">
            <p class="subtitle">
              Container, image, volume and mount footprint. Every call is read-only.
            </p>
            <span class="pill">read-only</span>
          </div>
          <section class="panel panel-fill">
            <div class="view-host">
              <DockerPanel
                scanId={selectedId ?? undefined}
                onreveal={(nodeId) => {
                  scopeId = nodeId;
                }}
              />
            </div>
            {#if sideTreeNodeId !== null}
              <section class="side-tree-panel">
                <div class="panel-head">
                  <div class="panel-title">
                    <span class="panel-icon"><Icon name="layers" size={15} /></span>
                    <h2>Container overlay tree</h2>
                  </div>
                  <button
                    type="button"
                    class="icon-button"
                    onclick={() => (sideTreeNodeId = null)}
                    aria-label="Close tree panel"
                  >
                    <Icon name="x" size={16} />
                  </button>
                </div>
                <div class="view-host">
                  {#if sideTreeNodeId !== null && tree && (tree.children ?? []).length > 0}
                    <Icicle root={tree} onselect={() => (sideTreeNodeId = null)} />
                  {:else if sideTreeNodeId !== null}
                    <p class="state">No tree data available for this node.</p>
                  {/if}
                </div>
              </section>
            {/if}
          </section>
        </main>
      {:else if view === "schedules"}
        <main class="page page-solo">
          <div class="page-head">
            <p class="subtitle">Run recurring read-only scans on a cron expression.</p>
            <span class="pill">{viewSummary}</span>
          </div>
          <section class="panel panel-fill">
            <div class="view-host">
              <SchedulesPanel />
            </div>
          </section>
        </main>
      {:else if view === "duplicates" && selectedId}
        <main class="page page-solo">
          <div class="page-head">
            <p class="subtitle">
              Files that repeat within the current scope, and the space they waste.
            </p>
            <span class="pill">{viewSummary}</span>
          </div>
          <section class="panel panel-fill">
            <div class="view-host">
              <DuplicatesPanel scanId={selectedId} scope={scopeId} />
            </div>
          </section>
        </main>
      {:else if view === "diff" && selectedId}
        <main class="page page-solo">
          <div class="page-head">
            <p class="subtitle">Compare the selected snapshot against a baseline.</p>
            <span class="pill">{viewSummary}</span>
          </div>
          <section class="panel panel-fill">
            <div class="view-host">
              <DiffPanel scanId={selectedId} {scans} />
            </div>
          </section>
        </main>
      {:else if !selectedId}
        <main class="empty-main">
          <section class="empty-card">
            <Logo size={48} />
            <h2>No snapshot selected</h2>
            <p>Start a read-only scan to explore disk usage on this host.</p>
            <button type="button" class="action primary" onclick={openLauncher}>
              <Icon name="plus" size={15} />
              New scan
            </button>
          </section>
        </main>
      {:else}
        <main class="split">
          <section class="panel panel-viz">
            <div class="panel-head">
              <div class="panel-title">
                <span class="panel-icon"><Icon name={currentDef.icon} size={15} /></span>
                <div class="crumbs">
                  <Breadcrumb path={scopePath} onnavigate={navigate} />
                </div>
              </div>
              <div class="panel-tools">
                <DriveStats drive={activeDrive} />
                {#if view === "treemap"}
                  <div class="segmented" role="group" aria-label="Colour mode">
                    <button
                      type="button"
                      class:active={colorMode === "size"}
                      title="Colour tiles by size"
                      onclick={() => (colorMode = "size")}
                    >
                      <Icon name="pie-chart" size={12} />
                      Size
                    </button>
                    <button
                      type="button"
                      class:active={colorMode === "ext"}
                      title="Colour tiles by extension"
                      onclick={() => (colorMode = "ext")}
                    >
                      <Icon name="file" size={12} />
                      Extension
                    </button>
                  </div>
                {/if}
                {#if loading || tileBusy}
                  <span class="busy" role="status" aria-label="Loading view">
                    <Spinner size={12} label="Loading view" />
                    <span>Loading…</span>
                  </span>
                {/if}
                <span class="pill">{viewSummary}</span>
              </div>
            </div>
            <div class="view-host" class:stacked={view === "extensions"} bind:this={treemapHost}>
              {#if view === "treemap"}
                {#if loading && tiles.length === 0}
                  <p class="state" role="status" aria-label="Loading tiles">
                    <Spinner size={16} label="Loading tiles" />
                    <span>Loading tiles…</span>
                  </p>
                {:else if error}
                  <p class="state err">{error}</p>
                {:else if tiles.length === 0}
                  <p class="state">No tiles in {scopeLabel}.</p>
                {:else}
                  <Treemap {tiles} {colorMode} onselect={openTile} />
                {/if}
              {:else if isHierarchyView}
                {#if viewLoading}
                  <p class="state" role="status" aria-label="Loading hierarchy">
                    <Spinner size={16} label="Loading hierarchy" />
                    <span>Loading hierarchy…</span>
                  </p>
                {:else if viewError}
                  <p class="state err">{viewError}</p>
                {:else if tree}
                  {#if (tree.children ?? []).length > 0}
                    {#if view === "sunburst"}
                      <Sunburst root={tree} onselect={openHierarchy} />
                    {:else if view === "icicle"}
                      <Icicle root={tree} onselect={openHierarchy} />
                    {:else}
                      <Bubble root={tree} onselect={openHierarchy} />
                    {/if}
                  {:else}
                    <p class="state">No children in {scopeLabel}.</p>
                  {/if}
                {:else}
                  <p class="state">No children in {scopeLabel}.</p>
                {/if}
              {:else if view === "bars"}
                {#if viewLoading}
                  <p class="state" role="status" aria-label="Loading nodes">
                    <Spinner size={16} label="Loading nodes" />
                    <span>Loading nodes…</span>
                  </p>
                {:else if viewError}
                  <p class="state err">{viewError}</p>
                {:else if topNodes.length === 0}
                  <p class="state">No nodes in {scopeLabel}.</p>
                {:else}
                  <Bars items={topNodes} onselect={openNode} />
                {/if}
              {:else if view === "heatmap"}
                {#if viewLoading}
                  <p class="state" role="status" aria-label="Loading heatmap">
                    <Spinner size={16} label="Loading heatmap" />
                    <span>Loading heatmap…</span>
                  </p>
                {:else if viewError}
                  <p class="state err">{viewError}</p>
                {:else if heatmapData}
                  <Heatmap heatmap={heatmapData} />
                {:else}
                  <p class="state">No data in {scopeLabel}.</p>
                {/if}
              {:else if view === "histogram"}
                {#if viewLoading}
                  <p class="state" role="status" aria-label="Loading histogram">
                    <Spinner size={16} label="Loading histogram" />
                    <span>Loading histogram…</span>
                  </p>
                {:else if viewError}
                  <p class="state err">{viewError}</p>
                {:else if histogram.length === 0}
                  <p class="state">No data in {scopeLabel}.</p>
                {:else}
                  <Histogram items={histogram} />
                {/if}
              {:else if view === "extensions"}
                {#if viewLoading}
                  <p class="state" role="status" aria-label="Loading breakdown">
                    <Spinner size={16} label="Loading breakdown" />
                    <span>Loading breakdown…</span>
                  </p>
                {:else if viewError}
                  <p class="state err">{viewError}</p>
                {:else if histogram.length === 0}
                  <p class="state">No data in {scopeLabel}.</p>
                {:else}
                  <FileTypes
                    items={histogram}
                    selected={extGroup}
                    onselect={(group) => (extGroup = group)}
                  />
                  {#if extItems.length === 0}
                    <p class="state">No files of this type in {scopeLabel}.</p>
                  {:else}
                    <Breakdown items={extItems} title={breakdownTitle} />
                  {/if}
                {/if}
              {:else}
                {#if viewLoading}
                  <p class="state" role="status" aria-label="Loading breakdown">
                    <Spinner size={16} label="Loading breakdown" />
                    <span>Loading breakdown…</span>
                  </p>
                {:else if viewError}
                  <p class="state err">{viewError}</p>
                {:else if histogram.length === 0}
                  <p class="state">No data in {scopeLabel}.</p>
                {:else}
                  <Breakdown items={histogram} title={breakdownTitle} />
                {/if}
              {/if}
            </div>
          </section>

          <section class="panel panel-tree">
            <div class="panel-head">
              <div class="panel-title">
                <span class="panel-icon"><Icon name="list" size={15} /></span>
                <h2>Tree</h2>
              </div>
              <div class="panel-tools">
                <span class="pill">{childTotal.toLocaleString()} items</span>
                {#if childBusy}
                  <Spinner size={12} label="Loading items in scope" />
                {/if}
              </div>
            </div>
            <RankedTable
              scanId={selectedId}
              root={treeRoot}
              path={scopePathIds}
              scope={scopeId}
              onselect={openNode}
            />
          </section>
        </main>
      {/if}
    </div>

    <footer class="statusbar">
      <div class="statusbar-left">
        <span
          class="status-dot"
          class:ok={Boolean(health && !healthError)}
          class:err={Boolean(healthError)}
        ></span>
        <span class="truncate">
          {#if healthError}
            API unreachable
          {:else if health}
            API {health.status} · core {health.core.connected ? "connected" : "idle"}
          {:else}
            Connecting…
          {/if}
        </span>
        <span class="dot-sep">·</span>
        <span class="truncate">protocol v{health?.protocol ?? "—"}</span>
      </div>
      <div class="statusbar-right">
        <span>read-only · no telemetry</span>
        <span class="dot-sep">·</span>
        <span>{activeTheme.name}</span>
      </div>
    </footer>
  </div>

  {#if swhitching}
    <div class="overlay" role="status" aria-label="Loading snapshot">
      <div class="overlay-card">
        <Spinner size={26} label="Loading snapshot" />
        <span>Loading snapshot…</span>
      </div>
    </div>
  {/if}

  {#if launcherOpen}
    <Modal
      title="New scan"
      subtitle="Read-only scan of a host filesystem"
      onclose={() => (launcherOpen = false)}
    >
      <ScanLauncher oncreated={handleLauncherCreated} />
    </Modal>
  {/if}

  {#if reportView}
    <Modal
      title="Imported report"
      subtitle={`${reportTypeLabel(reportView.type)} · ${reportView.view}`}
      onclose={() => (reportView = null)}
      wide
    >
      <ReportViewer report={reportView} />
    </Modal>
  {/if}

  {#if toast}
    <div class="toast" role="status">{toast}</div>
  {/if}

  <ScanProgressPanel onfinished={handleScanFinished} />
</div>

<style>
  .shell {
    display: flex;
    height: 100%;
    min-height: 0;
  }

  /* ---------------------------------------------------------------- sidebar */

  .sidebar {
    position: relative;
    z-index: 20;
    display: flex;
    flex: none;
    flex-direction: column;
    width: var(--sidebar-w);
    min-height: 0;
    border-right: 1px solid var(--border);
    background: var(--sidebar);
  }

  .sidebar-brand {
    display: flex;
    flex: none;
    align-items: center;
    gap: 0.6rem;
    height: var(--topbar-h);
    padding: 0 0.9rem;
    border-bottom: 1px solid var(--border);
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.1;
  }

  .brand-text strong {
    font-size: 0.95rem;
    letter-spacing: -0.01em;
  }

  .brand-text span {
    color: var(--subtle);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .sidebar-brand .sidebar-close {
    display: none;
    margin-left: auto;
  }

  .sidebar-nav {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1.05rem;
    min-height: 0;
    padding: 0.9rem 0.6rem;
    overflow: auto;
  }

  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .nav-label {
    padding: 0 0.55rem 0.3rem;
    color: var(--subtle);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.48rem 0.55rem;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 0.79rem;
    text-align: left;
    cursor: pointer;
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .nav-icon {
    display: inline-flex;
    flex: none;
    opacity: 0.9;
  }

  .nav-item:hover {
    background: var(--sidebar-2);
    color: var(--text);
  }

  .nav-item.active {
    border-color: color-mix(in srgb, var(--accent) 24%, transparent);
    background: var(--sidebar-active);
    color: var(--text);
  }

  .nav-item.active .nav-icon {
    color: var(--accent);
    opacity: 1;
  }

  .nav-text {
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-badge {
    margin-left: auto;
    padding: 0.05rem 0.35rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--subtle);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .sidebar-footer {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.6rem;
    border-top: 1px solid var(--border);
  }

  .status-line {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0 0.55rem;
    color: var(--muted);
    font-size: 0.67rem;
  }

  .status-line.subtle {
    color: var(--subtle);
  }

  .status-dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--subtle);
  }

  .status-dot.ok {
    background: var(--ok);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 16%, transparent);
  }

  .status-dot.err {
    background: var(--err);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--err) 16%, transparent);
  }

  .sidebar-scrim {
    position: fixed;
    inset: 0;
    z-index: 15;
    padding: 0;
    border: 0;
    background: var(--overlay);
  }

  /* --------------------------------------------------------------- topbar */

  .workspace {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .topbar {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    height: var(--topbar-h);
    padding: 0 1rem;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--panel) 55%, var(--bg));
  }

  .topbar-left,
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .page-id {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.15;
  }

  .eyebrow {
    color: var(--subtle);
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .page-name {
    overflow: hidden;
    font-size: 0.9rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .topbar .menu-toggle {
    display: none;
  }

  .theme-slot {
    display: inline-flex;
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    height: 2.1rem;
    min-width: 2.1rem;
    padding: 0 0.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--panel);
    color: var(--muted);
    font: inherit;
    font-size: 0.74rem;
    cursor: pointer;
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .icon-button:hover:not(:disabled) {
    border-color: var(--border-strong);
    background: var(--panel-2);
    color: var(--text);
  }

  .icon-button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .icon-button.active {
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent);
  }

  .kbd {
    padding: 0.02rem 0.28rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--panel-2);
    color: var(--subtle);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    line-height: 1.4;
  }

  .kbd-inline {
    margin-left: 0.15rem;
  }

  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    height: 2.1rem;
    padding: 0 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--panel);
    color: var(--text);
    font: inherit;
    font-size: 0.76rem;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .action:hover:not(:disabled) {
    border-color: var(--border-strong);
    background: var(--panel-2);
  }

  .action.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }

  .action.primary:hover:not(:disabled) {
    border-color: var(--accent-hover);
    background: var(--accent-hover);
  }

  .action:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* --------------------------------------------------------------- content */

  .content {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .search-panel {
    display: flex;
    flex: none;
    flex-direction: column;
    max-height: 46vh;
    margin: 0.75rem 0.75rem 0;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--panel);
    box-shadow: var(--shadow-sm);
  }

  .page {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.9rem;
    min-height: 0;
    padding: 1rem;
    overflow: auto;
  }

  .page-dashboard > .panel {
    flex: none;
  }

  .page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .subtitle {
    max-width: 54rem;
    margin: 0;
    color: var(--muted);
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .page-solo {
    overflow: hidden;
  }

  .page-solo .panel-fill {
    flex: 1;
    min-height: 0;
  }

  .page-settings {
    padding: 0;
    overflow: hidden;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.75rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.8rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--panel);
  }

  .stat-label {
    color: var(--subtle);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .stat strong {
    font-size: 1.4rem;
    font-weight: 650;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .stat-meta {
    color: var(--muted);
    font-size: 0.7rem;
  }

  /* ---------------------------------------------------------------- panels */

  .panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--panel);
  }

  .panel-head {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-height: 2.9rem;
    padding: 0.5rem 0.7rem;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--panel) 92%, var(--panel-2));
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .panel-title h2 {
    margin: 0;
    color: var(--muted);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .panel-icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 7px;
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent);
  }

  .panel-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.45rem;
    min-width: 0;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.16rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--panel-2);
    color: var(--muted);
    font-size: 0.67rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .split {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: 0.75rem;
    min-height: 0;
    padding: 0.75rem;
    overflow: hidden;
  }

  .panel-viz,
  .panel-tree {
    min-height: 0;
  }

  .view-host {
    position: relative;
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .view-host.stacked {
    flex-direction: column;
  }

  .crumbs {
    min-width: 0;
    overflow: hidden;
  }

  .segmented {
    display: inline-flex;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--panel-2);
  }

  .segmented button {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    padding: 0.22rem 0.5rem;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 0.69rem;
    cursor: pointer;
  }

  .segmented button:hover {
    color: var(--text);
  }

  .segmented button.active {
    background: var(--accent);
    color: var(--accent-contrast);
    font-weight: 600;
  }

  .busy {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted);
    font-size: 0.72rem;
    white-space: nowrap;
  }

  .state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    margin: auto;
    padding: 1rem;
    color: var(--muted);
  }

  .state.err {
    color: var(--err);
  }

  .side-tree-panel {
    display: flex;
    flex: none;
    flex-direction: column;
    min-height: 12rem;
    border-top: 1px solid var(--border);
  }

  .empty-main {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .empty-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    width: min(28rem, 90vw);
    padding: 2rem 1.5rem;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--panel);
    text-align: center;
    box-shadow: var(--shadow-sm);
  }

  .empty-card h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  .empty-card p {
    margin: 0 0 0.4rem;
    color: var(--muted);
    font-size: 0.82rem;
    line-height: 1.5;
  }

  /* -------------------------------------------------------------- statusbar */

  .statusbar {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.4rem 1rem;
    border-top: 1px solid var(--border);
    background: var(--panel);
    color: var(--muted);
    font-size: 0.67rem;
  }

  .statusbar-left,
  .statusbar-right {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
  }

  .dot-sep {
    color: var(--border-strong);
  }

  .truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay);
  }

  .overlay-card {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.9rem 1.2rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--panel);
    color: var(--text);
    font-size: 0.85rem;
    box-shadow: var(--shadow-lg);
  }

  .toast {
    position: fixed;
    right: 1rem;
    bottom: 2.6rem;
    z-index: 90;
    max-width: min(28rem, calc(100vw - 2rem));
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel-2);
    color: var(--text);
    font-size: 0.78rem;
    box-shadow: var(--shadow-lg);
  }

  /* ------------------------------------------------------------- responsive */

  @media (max-width: 1080px) {
    .split {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1.35fr) minmax(0, 1fr);
    }
  }

  @media (max-width: 900px) {
    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: min(18rem, 86vw);
      transform: translateX(-102%);
      transition: transform 180ms ease;
      box-shadow: var(--shadow-lg);
    }

    .sidebar.open {
      transform: translateX(0);
    }

    .sidebar-brand .sidebar-close,
    .topbar .menu-toggle {
      display: inline-flex;
    }

    .split {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      overflow: auto;
    }

    .panel-viz {
      min-height: 62vh;
    }

    .panel-tree {
      min-height: 46vh;
    }
  }

  @media (max-width: 720px) {
    .topbar {
      gap: 0.5rem;
      padding: 0 0.6rem;
    }

    .topbar-right {
      gap: 0.35rem;
    }

    .page-id .eyebrow {
      display: none;
    }

    .search-button .kbd {
      display: none;
    }

    .new-scan .btn-label {
      display: none;
    }

    .page-head {
      flex-direction: column;
    }

    .statusbar-right {
      display: none;
    }

    .stat-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 560px) {
    .theme-slot {
      display: none;
    }

    .page {
      padding: 0.75rem;
    }

    .split {
      padding: 0.5rem;
    }

    .stat-grid {
      grid-template-columns: 1fr;
    }

    .panel-tools .pill {
      display: none;
    }
  }
</style>
