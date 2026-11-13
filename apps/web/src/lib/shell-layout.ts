export const LAYOUT_STORAGE_KEY = "mish.layout";

export type LayoutId = "classic" | "floating";

export interface Layout {
  id: LayoutId;
  name: string;
  description: string;
}

export const DEFAULT_LAYOUT: Layout = {
  id: "classic",
  name: "Classic",
  description: "Edge-to-edge workspace with flat panels.",
};

export const LAYOUTS: readonly Layout[] = [
  DEFAULT_LAYOUT,
  {
    id: "floating",
    name: "Floating",
    description: "Dotted canvas, rounded cards and a gradient rail.",
  },
];

export interface LayoutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): LayoutStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** True when a persisted or user-supplied value names a known layout. */
export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === "string" && LAYOUTS.some((layout) => layout.id === value);
}

/** The layout for an id, falling back to the default when the id is unknown. */
export function layoutById(id: LayoutId): Layout {
  return LAYOUTS.find((layout) => layout.id === id) ?? DEFAULT_LAYOUT;
}

/** The layout saved in local storage, or the default when absent or invalid. */
export function readStoredLayout(storage: LayoutStorage | null = browserStorage()): LayoutId {
  try {
    const raw = storage?.getItem(LAYOUT_STORAGE_KEY);
    return isLayoutId(raw) ? raw : DEFAULT_LAYOUT.id;
  } catch {
    return DEFAULT_LAYOUT.id;
  }
}

/** Persist a layout choice; storage failures (private mode, quota) are ignored. */
export function storeLayout(id: LayoutId, storage: LayoutStorage | null = browserStorage()): void {
  try {
    storage?.setItem(LAYOUT_STORAGE_KEY, id);
  } catch {
    // A layout is cosmetic; never break the app because storage is unavailable.
  }
}

/** The subset of the document root that layout switching needs, so it stays testable. */
export interface LayoutRoot {
  dataset: Record<string, string | undefined>;
}

function rootElement(): LayoutRoot | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

/** Mark the document root with the chosen layout for global styling. */
export function applyLayout(id: LayoutId, root: LayoutRoot | null = rootElement()): LayoutId {
  const layout = layoutById(id);
  if (root) root.dataset.layout = layout.id;
  return layout.id;
}

/** Read the saved layout, apply it, and return the id that was applied. */
export function applyStoredLayout(root: LayoutRoot | null = rootElement()): LayoutId {
  return applyLayout(readStoredLayout(), root);
}
