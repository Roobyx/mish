//! The terminal views behind `mish tui`.
//!
//! Three renderers share one chrome: a header line, a breadcrumb, the chart
//! body and a footer. Bars print one line per child, the treemap lays children
//! out as squarified tiles, and the histogram draws size buckets as columns.
//! Navigation stays line-based rather than raw keystrokes, so it works over
//! SSH, inside pipes and on terminals where no termios layer is available:
//!
//! ```text
//! <enter> | j   page down        k        page up
//! u | ..        go to the parent g        go to the snapshot root
//! o | <n>       open child n     s        cycle the sort order
//! m             cycle the metric + | -    wider / narrower bars
//! v             cycle the view   d        cycle the histogram dimension
//! q             quit
//! ```

/// A rendered line: a label, the value the bar is scaled from, and a short
/// kind note.
#[derive(Debug, Clone)]
pub struct Row {
    pub label: String,
    pub value: u64,
    pub detail: String,
}

/// One chart in the terminal browser.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum View {
    Bars,
    Treemap,
    Histogram,
}

impl View {
    pub fn parse(value: &str) -> View {
        match value.trim().to_ascii_lowercase().as_str() {
            "treemap" | "tiles" | "map" => View::Treemap,
            "histogram" | "hist" | "dist" => View::Histogram,
            _ => View::Bars,
        }
    }

    pub fn next(self) -> View {
        match self {
            View::Bars => View::Treemap,
            View::Treemap => View::Histogram,
            View::Histogram => View::Bars,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            View::Bars => "bars",
            View::Treemap => "treemap",
            View::Histogram => "histogram",
        }
    }
}

/// One tile of a treemap, positioned in the unit square.
#[derive(Debug, Clone)]
pub struct Tile {
    pub name: String,
    pub value: u64,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// One column of a histogram.
#[derive(Debug, Clone)]
pub struct HistogramBucket {
    pub label: String,
    pub size: u64,
    pub count: u64,
}

/// A parsed line command.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Nav {
    Quit,
    Parent,
    Root,
    Open,
    Select(usize),
    PageDown,
    PageUp,
    Sort,
    Metric,
    Widen,
    Narrow,
    View,
    Dim,
    Unnown,
}

/// A bar of exactly `width` cells, filled in proportion to `max`.
pub fn bar(value: u64, max: u64, width: usize) -> String {
    let mut out = String::new();
    let filled = if max == 0 || width == 0 {
        0
    } else {
        ((value as f64 / max as f64) * width as f64) as usize
    };
    for i in 0..width {
        if i < filled {
            out.push('█');
        } else {
            out.push('░');
        }
    }
    out
}

/// Human-readable size in binary units.
pub fn human_size(bytes: u64) -> String {
    const UNITS: [&str; 6] = ["B", "KB", "MB", "GB", "TB", "PB"];
    let mut value = bytes as f64;
    let mut unit = 0;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    format!("{value:.1} {}", UNITS[unit])
}

/// Compact item count: `1.2k`, `3.4M`.
pub fn human_count(value: u64) -> String {
    let value = value as f64;
    if value >= 1_000_000.0 {
        format!("{:.1}M", value / 1_000_000.0)
    } else if value >= 1_000.0 {
        format!("{:.1}k", value / 1_000.0)
    } else {
        format!("{}", value as u64)
    }
}

/// Replace the control characters a terminal would execute (CSI/OSC sequences,
/// cursor moves, title writes) so an untrusted filename can only print, never
/// drive the terminal.
pub fn visible(value: &str) -> String {
    let mut out = String::new();
    for c in value.chars() {
        let code = c as u32;
        if code < 0x20 || code == 0x7f || (0x80..=0x9f).contains(&code) {
            out.push('?');
        } else {
            out.push(c);
        }
    }
    out
}

/// Sanitized text cut to `max` cells, with an ellipsis when it does not fit.
pub fn clip(value: &str, max: usize) -> String {
    if max == 0 {
        return String::new();
    }
    let clean = visible(value);
    let chars: Vec<char> = clean.chars().collect();
    if chars.len() <= max {
        return clean;
    }
    let mut out: String = chars.iter().take(max.saturating_sub(1)).collect();
    out.push('…');
    out
}

/// One full frame: a header line, a breadcrumb, one line per row, a footer.
pub fn frame(
    header: &str,
    crumb: &str,
    rows: &[Row],
    max: u64,
    width: usize,
    selected: usize,
    footer: &str,
) -> String {
    let mut out = String::new();
    out.push_str(&visible(header));
    out.push_str("  ");
    out.push_str(&visible(crumb));
    out.push('\n');
    for i in 0..rows.len() {
        if let Some(row) = rows.get(i) {
            if i == selected {
                out.push_str("› ");
            } else {
                out.push_str("  ");
            }
            let size = format!("{:>10}  ", human_size(row.value));
            out.push_str(size.as_str());
            out.push_str(&bar(row.value, max, width));
            out.push_str("  ");
            out.push_str(&visible(row.label.as_str()));
            if !row.detail.is_empty() {
                out.push_str("  (");
                out.push_str(&visible(row.detail.as_str()));
                out.push(')');
            }
            out.push('\n');
        }
    }
    out.push_str(&visible(footer));
    out.push('\n');
    out
}

/// Header, breadcrumb, chart body and footer for the chart views.
fn chart_frame(header: &str, crumb: &str, body: &[String], footer: &str) -> String {
    let mut out = String::new();
    out.push_str(&visible(header));
    out.push_str("  ");
    out.push_str(&visible(crumb));
    out.push('\n');
    for line in body {
        out.push_str(line);
        out.push('\n');
    }
    out.push_str(&visible(footer));
    out.push('\n');
    out
}

/// A squarified treemap of `tiles` inside a `width` x `height` frame.
pub fn treemap_frame(
    header: &str,
    crumb: &str,
    tiles: &[Tile],
    width: usize,
    height: usize,
    footer: &str,
) -> String {
    let rows = height.saturating_sub(3).max(3);
    chart_frame(header, crumb, &treemap_body(tiles, width, rows), footer)
}

/// A column chart of size buckets inside a `width` x `height` frame.
pub fn histogram_frame(
    header: &str,
    crumb: &str,
    buckets: &[HistogramBucket],
    width: usize,
    height: usize,
    footer: &str,
) -> String {
    let rows = height.saturating_sub(3).max(4);
    chart_frame(header, crumb, &histogram_body(buckets, width, rows), footer)
}

fn key(row: usize, col: usize, width: usize) -> usize {
    row * (width + 1) + col
}

fn put_text(grid: &mut [Vec<char>], row: usize, col: usize, text: &str) {
    if row >= grid.len() {
        return;
    }
    for (offset, ch) in text.chars().enumerate() {
        let target = col + offset;
        if target < grid[row].len() {
            grid[row][target] = ch;
        }
    }
}

fn put_centered(row: &mut [char], start: usize, span: usize, text: &str) {
    let chars: Vec<char> = text.chars().collect();
    if chars.is_empty() || span == 0 {
        return;
    }
    let used = chars.len().min(span);
    let offset = start + (span - used) / 2;
    for (i, ch) in chars.iter().take(used).enumerate() {
        let target = offset + i;
        if target < row.len() {
            row[target] = *ch;
        }
    }
}

/// Cell rectangle of a normalized tile: columns are square cells, rows are
/// half as tall, so a tile is laid out in `2 * rows` vertical units.
fn tile_cells(tile: &Tile, width: usize, rows: usize) -> (usize, usize, usize, usize) {
    let px = width as f32;
    let py = (rows * 2) as f32;
    let clamp_col = |value: f32| (value.clamp(0.0, 1.0) * px).floor() as usize;
    let clamp_row = |value: f32| (value.clamp(0.0, 1.0) * py / 2.0).floor() as usize;
    let c0 = clamp_col(tile.x).min(width - 1);
    let c1 = clamp_col(tile.x + tile.w).min(width - 1).max(c0);
    let r0 = clamp_row(tile.y).min(rows - 1);
    let r1 = clamp_row(tile.y + tile.h).min(rows - 1).max(r0);
    (c0, c1, r0, r1)
}

fn shade(value: u64, max: u64) -> char {
    let ratio = if max == 0 {
        0.0
    } else {
        value as f64 / max as f64
    };
    if ratio >= 0.5 {
        '█'
    } else if ratio >= 0.15 {
        '▓'
    } else if ratio >= 0.03 {
        '▒'
    } else {
        '░'
    }
}

fn junction(up: bool, down: bool, left: bool, right: bool) -> char {
    match (up, down, left, right) {
        (true, true, true, true) => '┼',
        (true, true, true, false) => '┤',
        (true, true, false, true) => '├',
        (true, false, true, true) => '┴',
        (true, false, false, true) => '└',
        (true, false, true, false) => '┘',
        (false, true, true, true) => '┬',
        (false, true, false, true) => '┌',
        (false, true, true, false) => '┐',
        (false, false, true, true) => '─',
        (true, true, false, false) | (true, false, false, false) | (false, true, false, false) => {
            '│'
        }
        _ => '─',
    }
}

/// The treemap body: one string per row, trailing blanks trimmed.
pub fn treemap_body(tiles: &[Tile], width: usize, rows: usize) -> Vec<String> {
    let width = width.max(8);
    let rows = rows.max(3);
    let mut grid: Vec<Vec<char>> = vec![vec![' '; width]; rows];
    let mut h_edge = std::collections::HashSet::new();
    let mut v_edge = std::collections::HashSet::new();
    let max = tiles.iter().map(|tile| tile.value).max().unwrap_or(0);

    for tile in tiles {
        let (c0, c1, r0, r1) = tile_cells(tile, width, rows);
        let cols = c1 - c0 + 1;
        let lines = r1 - r0 + 1;
        if cols >= 8 && lines >= 3 {
            for col in c0..=c1 {
                h_edge.insert(key(r0, col, width));
                h_edge.insert(key(r1, col, width));
            }
            for row in r0..=r1 {
                v_edge.insert(key(row, c0, width));
                v_edge.insert(key(row, c1, width));
            }
            put_text(&mut grid, r0 + 1, c0 + 2, &clip(&tile.name, cols - 4));
            if lines >= 4 {
                put_text(&mut grid, r0 + 2, c0 + 2, &human_size(tile.value));
            }
        } else {
            let fill = shade(tile.value, max);
            for line in grid.iter_mut().take(r1 + 1).skip(r0) {
                for cell in line.iter_mut().take(c1 + 1).skip(c0) {
                    *cell = fill;
                }
            }
            // A label on the last body row would sit flush against the footer,
            // and one on a one-row tile would read as an overflow of the tile
            // above it, so small tiles only label when there is room.
            if cols >= 6 && lines >= 2 && r0 + 1 < rows {
                put_text(&mut grid, r0, c0 + 1, &clip(&tile.name, cols - 2));
            }
        }
    }

    for (row, line) in grid.iter_mut().enumerate() {
        for (col, cell) in line.iter_mut().enumerate() {
            let horizontal = h_edge.contains(&key(row, col, width));
            let vertical = v_edge.contains(&key(row, col, width));
            if !horizontal && !vertical {
                continue;
            }
            *cell = if horizontal && vertical {
                let up = row > 0 && v_edge.contains(&key(row - 1, col, width));
                let down = row + 1 < rows && v_edge.contains(&key(row + 1, col, width));
                let left = col > 0 && h_edge.contains(&key(row, col - 1, width));
                let right = col + 1 < width && h_edge.contains(&key(row, col + 1, width));
                junction(up, down, left, right)
            } else if horizontal {
                '─'
            } else {
                '│'
            };
        }
    }

    grid.into_iter()
        .map(|line| {
            let text: String = line.into_iter().collect();
            text.trim_end().to_string()
        })
        .collect()
}

/// The histogram body: columns grown from a shared baseline.
pub fn histogram_body(buckets: &[HistogramBucket], width: usize, rows: usize) -> Vec<String> {
    if buckets.is_empty() {
        return vec!["  no data".to_string()];
    }
    let width = width.max(8);
    let rows = rows.max(4);
    let count_rows = if rows >= 7 { 1 } else { 0 };
    let bar_rows = rows.saturating_sub(2 + count_rows).max(1);
    let columns = buckets.len().min((width / 5).max(1));
    let span = (width / columns).max(4);
    let bar_width = (span - 1).max(1);
    let max = buckets
        .iter()
        .map(|bucket| bucket.size)
        .max()
        .unwrap_or(0)
        .max(1);
    let mut grid: Vec<Vec<char>> = vec![vec![' '; width]; rows];

    for (index, bucket) in buckets.iter().take(columns).enumerate() {
        let start = index * span;
        if start >= width {
            break;
        }
        let end = (start + bar_width).min(width);
        let eighths = ((bucket.size as f64 / max as f64) * (bar_rows * 8) as f64).round() as usize;
        let full = (eighths / 8).min(bar_rows);
        let part = eighths % 8;

        for level in 0..full {
            let row = bar_rows - 1 - level;
            for cell in grid[row].iter_mut().take(end).skip(start) {
                *cell = '█';
            }
        }
        if part > 0 && full < bar_rows {
            let glyph = ['▁', '▂', '▃', '▄', '▅', '▆', '▇'][part - 1];
            let row = bar_rows - 1 - full;
            for cell in grid[row].iter_mut().take(end).skip(start) {
                *cell = glyph;
            }
        }

        for cell in grid[bar_rows].iter_mut().take(end).skip(start) {
            *cell = '─';
        }
        let mid = start + bar_width / 2;
        if mid < width {
            grid[bar_rows][mid] = '┴';
        }

        let label = clip(&bucket.label, bar_width);
        put_centered(&mut grid[bar_rows + 1], start, bar_width, &label);
        if count_rows == 1 {
            let count = human_count(bucket.count);
            put_centered(&mut grid[bar_rows + 2], start, bar_width, &count);
        }
    }

    grid.into_iter()
        .map(|line| {
            let text: String = line.into_iter().collect();
            text.trim_end().to_string()
        })
        .collect()
}

/// Parse one line command. An empty line pages down, a bare number selects a
/// row by its 1-based position.
pub fn parse_nav(line: &str) -> Nav {
    let trimmed = line.trim();
    match trimmed {
        "q" | "quit" => Nav::Quit,
        "u" | ".." | "up" => Nav::Parent,
        "g" | "top" | "root" => Nav::Root,
        "o" | "open" => Nav::Open,
        "" | "j" | "down" => Nav::PageDown,
        "k" | "up-page" => Nav::PageUp,
        "s" | "sort" => Nav::Sort,
        "m" | "metric" => Nav::Metric,
        "+" | "widen" => Nav::Widen,
        "-" | "narrow" => Nav::Narrow,
        "v" | "view" => Nav::View,
        "d" | "dim" => Nav::Dim,
        other => match parse_index(other) {
            Some(n) => Nav::Select(n),
            None => Nav::Unnown,
        },
    }
}

fn parse_index(s: &str) -> Option<usize> {
    if s.is_empty() {
        return None;
    }
    let mut value = 0usize;
    for c in s.chars() {
        if !c.is_ascii_digit() {
            return None;
        }
        value = value * 10 + (c as usize - '0' as usize);
    }
    Some(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tile(name: &str, value: u64, x: f32, y: f32, w: f32, h: f32) -> Tile {
        Tile {
            name: name.to_string(),
            value,
            x,
            y,
            w,
            h,
        }
    }

    #[test]
    fn bar_fills_in_proportion_to_the_maximum() {
        assert_eq!(bar(0, 0, 4).as_str(), "░░░░");
        assert_eq!(bar(10, 10, 4).as_str(), "████");
        assert_eq!(bar(5, 10, 4).as_str(), "██░░");
        assert_eq!(bar(1, 1000, 2).as_str(), "░░");
        assert!(bar(7, 10, 0).is_empty());
    }

    #[test]
    fn human_size_reads_binary_units() {
        assert_eq!(human_size(0).as_str(), "0.0 B");
        assert_eq!(human_size(2048).as_str(), "2.0 KB");
        assert_eq!(human_size(1_073_741_824).as_str(), "1.0 GB");
    }

    #[test]
    fn human_count_compacts_thousands() {
        assert_eq!(human_count(42).as_str(), "42");
        assert_eq!(human_count(1500).as_str(), "1.5k");
        assert_eq!(human_count(2_400_000).as_str(), "2.4M");
    }

    #[test]
    fn parse_nav_reads_line_commands() {
        assert!(matches!(parse_nav("q"), Nav::Quit));
        assert!(matches!(parse_nav(""), Nav::PageDown));
        assert!(matches!(parse_nav("j"), Nav::PageDown));
        assert!(matches!(parse_nav("u"), Nav::Parent));
        assert!(matches!(parse_nav(".."), Nav::Parent));
        assert!(matches!(parse_nav("v"), Nav::View));
        assert!(matches!(parse_nav("dim"), Nav::Dim));
        assert!(matches!(parse_nav("7"), Nav::Select(7)));
        assert!(matches!(parse_nav("zap"), Nav::Unnown));
    }

    #[test]
    fn view_parses_and_cycles() {
        assert_eq!(View::parse("treemap"), View::Treemap);
        assert_eq!(View::parse("HIST"), View::Histogram);
        assert_eq!(View::parse("nope"), View::Bars);
        assert_eq!(View::Bars.next(), View::Treemap);
        assert_eq!(View::Treemap.next(), View::Histogram);
        assert_eq!(View::Histogram.next(), View::Bars);
    }

    #[test]
    fn visible_replaces_control_chars() {
        assert_eq!(visible("plain").as_str(), "plain");
        assert_eq!(visible("\x1b[2J").as_str(), "?[2J");
        assert_eq!(visible("a\x07b").as_str(), "a?b");
        assert_eq!(visible("dir/na\tme").as_str(), "dir/na?me");
    }

    #[test]
    fn clip_keeps_short_text_and_ellipsizes_long_text() {
        assert_eq!(clip("abc", 4).as_str(), "abc");
        assert_eq!(clip("abcd", 4).as_str(), "abcd");
        assert_eq!(clip("abcde", 4).as_str(), "abc…");
        assert_eq!(clip("abc", 0).as_str(), "");
    }

    #[test]
    fn frame_has_one_line_per_row_plus_header_and_footer() {
        let empty: Vec<Row> = Vec::new();
        assert_eq!(frame("h", "/", &empty, 0, 4, 0, "f").as_str(), "h  /\nf\n");
    }

    #[test]
    fn frame_marks_the_selected_row() {
        let rows = vec![
            Row {
                label: "a".into(),
                value: 10,
                detail: "file".into(),
            },
            Row {
                label: "b".into(),
                value: 5,
                detail: "dir".into(),
            },
        ];
        let selected = frame("h", "/", &rows, 10, 4, 1, "f");
        let beyond = frame("h", "/", &rows, 10, 4, 9, "f");
        assert!(selected != beyond);
    }

    #[test]
    fn treemap_draws_borders_and_labels() {
        let tiles = vec![
            tile("alpha", 75, 0.0, 0.0, 0.75, 1.0),
            tile("beta", 25, 0.75, 0.0, 0.25, 1.0),
        ];
        let body = treemap_body(&tiles, 40, 10);
        let text = body.join("\n");
        assert!(text.contains('┌') && text.contains('┘'));
        assert!(text.contains("alpha"));
        assert!(text.contains("75"));
        assert_eq!(body.len(), 10);
        assert!(body.iter().all(|line| line.chars().count() <= 40));
    }

    #[test]
    fn treemap_gives_more_cells_to_the_bigger_tile() {
        let tiles = vec![
            tile("big", 90, 0.0, 0.0, 0.9, 1.0),
            tile("small", 10, 0.9, 0.0, 0.1, 1.0),
        ];
        let body = treemap_body(&tiles, 40, 10);
        let big = body
            .iter()
            .filter(|line| line.contains('│') && line.find('│').unwrap_or(0) < 30)
            .count();
        assert!(big > 0);
        let first = body.first().cloned().unwrap_or_default();
        assert!(first.chars().filter(|c| *c == '─').count() > 20);
    }

    #[test]
    fn treemap_handles_no_tiles() {
        let body = treemap_body(&[], 20, 4);
        assert_eq!(body.len(), 4);
        assert!(body.iter().all(|line| line.trim().is_empty()));
    }

    #[test]
    fn histogram_grows_the_largest_bucket_to_full_height() {
        let buckets = vec![
            HistogramBucket {
                label: "small".into(),
                size: 10,
                count: 2,
            },
            HistogramBucket {
                label: "large".into(),
                size: 100,
                count: 1,
            },
        ];
        let body = histogram_body(&buckets, 40, 8);
        assert_eq!(body.len(), 8);
        assert!(body[0].contains('█'));
        assert!(body.iter().all(|line| line.chars().count() <= 40));
        assert!(body.iter().any(|line| line.contains('┴')));
        assert!(body.iter().any(|line| line.contains("large")));
    }

    #[test]
    fn histogram_leaves_zero_buckets_empty() {
        let buckets = vec![
            HistogramBucket {
                label: "empty".into(),
                size: 0,
                count: 0,
            },
            HistogramBucket {
                label: "full".into(),
                size: 10,
                count: 1,
            },
        ];
        let body = histogram_body(&buckets, 40, 6);
        // Two columns of 20 cells: the first holds the zero bucket.
        for line in &body {
            let cells: Vec<char> = line.chars().collect();
            assert!(
                !cells.iter().take(19).any(|cell| *cell == '█'),
                "zero bucket drew a bar: {line:?}"
            );
        }
        assert!(body.iter().any(|line| line.contains('█')));
    }

    #[test]
    fn histogram_handles_no_buckets() {
        assert_eq!(histogram_body(&[], 20, 4).len(), 1);
    }

    #[test]
    fn chart_frame_keeps_header_breadcrumb_and_footer() {
        let frame = treemap_frame("head", "/var", &[], 20, 6, "foot");
        let lines: Vec<&str> = frame.lines().collect();
        assert!(lines.first().unwrap().starts_with("head  /var"));
        assert_eq!(lines.last().unwrap(), &"foot");
    }
}
