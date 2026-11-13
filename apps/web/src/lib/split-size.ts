export const TREE_SHARE_STORAGE_KEY = "mish.tree-share";

/** Tree panel share of the split content width, matching the old 2fr/1fr grid. */
export const DEFAULT_TREE_SHARE = 1 / 3;
export const MIN_TREE_SHARE = 0.28;
export const MAX_TREE_SHARE = 0.72;

export interface ShareStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): ShareStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Keep a share inside the usable range, falling back for non-finite values. */
export function clampTreeShare(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TREE_SHARE;
  return Math.min(MAX_TREE_SHARE, Math.max(MIN_TREE_SHARE, value));
}

/** The share saved in local storage, or the default when absent or invalid. */
export function readStoredTreeShare(storage: ShareStorage | null = browserStorage()): number {
  try {
    const raw = storage?.getItem(TREE_SHARE_STORAGE_KEY);
    if (raw === null || raw === undefined || raw.trim() === "") return DEFAULT_TREE_SHARE;
    return clampTreeShare(Number(raw));
  } catch {
    return DEFAULT_TREE_SHARE;
  }
}

/** Persist a tree share; storage failures (private mode, quota) are ignored. */
export function storeTreeShare(
  share: number,
  storage: ShareStorage | null = browserStorage(),
): void {
  try {
    storage?.setItem(TREE_SHARE_STORAGE_KEY, String(clampTreeShare(share)));
  } catch {
    // The split is cosmetic; never break the app because storage is unavailable.
  }
}

export interface SplitRect {
  left: number;
  width: number;
  paddingLeft?: number;
  paddingRight?: number;
}

/** Share implied by dragging the divider to `clientX` inside the split content box. */
export function treeShareFromPointer(clientX: number, rect: SplitRect): number {
  const left = rect.left + (rect.paddingLeft ?? 0);
  const width = rect.width - (rect.paddingLeft ?? 0) - (rect.paddingRight ?? 0);
  if (!(width > 0)) return DEFAULT_TREE_SHARE;
  return clampTreeShare((left + width - clientX) / width);
}
