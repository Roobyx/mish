export const THEME_STORAGE_KEY = "mish.theme";

export const THEME_VARS = [
  "--bg",
  "--panel",
  "--panel-2",
  "--panel-3",
  "--border",
  "--border-strong",
  "--text",
  "--muted",
  "--subtle",
  "--accent",
  "--accent-hover",
  "--accent-contrast",
  "--ok",
  "--warn",
  "--err",
  "--sidebar",
  "--sidebar-2",
  "--sidebar-active",
  "--logo-bg",
  "--overlay",
  "--shadow-sm",
  "--shadow-md",
  "--shadow-lg",
  "--ring",
] as const;

export type ThemeVar = (typeof THEME_VARS)[number];

export type ThemeId = "obsidian" | "midnight" | "nord" | "amber" | "paper" | "terminal";

export type ThemeMode = "dark" | "light";

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  mode: ThemeMode;
  vars: Record<ThemeVar, string>;
}

export const DEFAULT_THEME: Theme = {
  // An unknown stored id, including the theme's former id, falls back to this one.
  id: "obsidian",
  name: "Obsidian",
  description: "Near-black surfaces with a teal accent.",
  mode: "dark",
  vars: {
    "--bg": "#0a0a0b",
    "--panel": "#121214",
    "--panel-2": "#18181b",
    "--panel-3": "#212126",
    "--border": "#27272a",
    "--border-strong": "#3f3f46",
    "--text": "#f4f4f5",
    "--muted": "#a1a1aa",
    "--subtle": "#71717a",
    "--accent": "#00c9a7",
    "--accent-hover": "#2ee0c0",
    "--accent-contrast": "#04211d",
    "--ok": "#34d399",
    "--warn": "#fbbf24",
    "--err": "#f87171",
    "--sidebar": "#0d0d0f",
    "--sidebar-2": "#131316",
    "--sidebar-active": "#16201d",
    "--logo-bg": "#151517",
    "--overlay": "rgba(5, 5, 7, 0.72)",
    "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.35)",
    "--shadow-md": "0 8px 24px rgba(0, 0, 0, 0.4)",
    "--shadow-lg": "0 24px 60px rgba(0, 0, 0, 0.55)",
    "--ring": "rgba(0, 201, 167, 0.35)",
  },
};

export const THEMES: readonly Theme[] = [
  DEFAULT_THEME,
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep navy surfaces with a cool blue accent.",
    mode: "dark",
    vars: {
      "--bg": "#070a12",
      "--panel": "#0e1422",
      "--panel-2": "#141c2e",
      "--panel-3": "#1b253a",
      "--border": "#22304a",
      "--border-strong": "#33456a",
      "--text": "#e9efff",
      "--muted": "#94a3c4",
      "--subtle": "#6b7c9e",
      "--accent": "#6d9bff",
      "--accent-hover": "#8fb4ff",
      "--accent-contrast": "#061229",
      "--ok": "#3ddc97",
      "--warn": "#fbbf24",
      "--err": "#fb7185",
      "--sidebar": "#0a0f1b",
      "--sidebar-2": "#101728",
      "--sidebar-active": "#15213a",
      "--logo-bg": "#111a2c",
      "--overlay": "rgba(3, 6, 14, 0.72)",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.4)",
      "--shadow-md": "0 8px 24px rgba(0, 0, 0, 0.45)",
      "--shadow-lg": "0 24px 60px rgba(0, 0, 0, 0.6)",
      "--ring": "rgba(109, 155, 255, 0.35)",
    },
  },
  {
    id: "nord",
    name: "Nord",
    description: "Muted arctic blue-grey with frost accents.",
    mode: "dark",
    vars: {
      "--bg": "#242933",
      "--panel": "#2e3440",
      "--panel-2": "#3b4252",
      "--panel-3": "#434c5e",
      "--border": "#434c5e",
      "--border-strong": "#4c566a",
      "--text": "#eceff4",
      "--muted": "#a9b4c6",
      "--subtle": "#8793a6",
      "--accent": "#88c0d0",
      "--accent-hover": "#9fd3e2",
      "--accent-contrast": "#17202b",
      "--ok": "#a3be8c",
      "--warn": "#ebcb8b",
      "--err": "#bf616a",
      "--sidebar": "#282e39",
      "--sidebar-2": "#2f3642",
      "--sidebar-active": "#3a465a",
      "--logo-bg": "#2e3440",
      "--overlay": "rgba(20, 24, 31, 0.7)",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.28)",
      "--shadow-md": "0 8px 24px rgba(0, 0, 0, 0.32)",
      "--shadow-lg": "0 24px 60px rgba(0, 0, 0, 0.45)",
      "--ring": "rgba(136, 192, 208, 0.4)",
    },
  },
  {
    id: "amber",
    name: "Amber",
    description: "Warm charcoal with a golden accent.",
    mode: "dark",
    vars: {
      "--bg": "#0c0a06",
      "--panel": "#14110a",
      "--panel-2": "#1b170e",
      "--panel-3": "#252015",
      "--border": "#312a1a",
      "--border-strong": "#4a3f28",
      "--text": "#fbf4e3",
      "--muted": "#bfae8b",
      "--subtle": "#8d7d5f",
      "--accent": "#f5c542",
      "--accent-hover": "#ffd76a",
      "--accent-contrast": "#2a1e00",
      "--ok": "#8fcf8a",
      "--warn": "#fb923c",
      "--err": "#f87171",
      "--sidebar": "#0f0c07",
      "--sidebar-2": "#17130b",
      "--sidebar-active": "#2a2211",
      "--logo-bg": "#1a150c",
      "--overlay": "rgba(10, 8, 4, 0.74)",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.4)",
      "--shadow-md": "0 8px 24px rgba(0, 0, 0, 0.45)",
      "--shadow-lg": "0 24px 60px rgba(0, 0, 0, 0.6)",
      "--ring": "rgba(245, 197, 66, 0.35)",
    },
  },
  {
    id: "paper",
    name: "Paper",
    description: "Warm light theme with a burnt-orange accent.",
    mode: "light",
    vars: {
      "--bg": "#f5f4f0",
      "--panel": "#ffffff",
      "--panel-2": "#f3f1ec",
      "--panel-3": "#eae7e0",
      "--border": "#ddd9d1",
      "--border-strong": "#c5c0b5",
      "--text": "#201f1b",
      "--muted": "#6b675e",
      "--subtle": "#928d82",
      "--accent": "#b23c0a",
      "--accent-hover": "#d0490f",
      "--accent-contrast": "#fff8f2",
      "--ok": "#15803d",
      "--warn": "#a16207",
      "--err": "#b91c1c",
      "--sidebar": "#eeece6",
      "--sidebar-2": "#e7e4dc",
      "--sidebar-active": "#f7e3d8",
      "--logo-bg": "#201f1b",
      "--overlay": "rgba(40, 36, 28, 0.45)",
      "--shadow-sm": "0 1px 2px rgba(30, 26, 20, 0.08)",
      "--shadow-md": "0 8px 24px rgba(30, 26, 20, 0.12)",
      "--shadow-lg": "0 24px 60px rgba(30, 26, 20, 0.18)",
      "--ring": "rgba(178, 60, 10, 0.28)",
    },
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Monochrome black and phosphor green.",
    mode: "dark",
    vars: {
      "--bg": "#050805",
      "--panel": "#0a100a",
      "--panel-2": "#0f180f",
      "--panel-3": "#142014",
      "--border": "#1e2e1e",
      "--border-strong": "#2c442c",
      "--text": "#d8f6d8",
      "--muted": "#84a684",
      "--subtle": "#5f7d5f",
      "--accent": "#4ade80",
      "--accent-hover": "#6ee79a",
      "--accent-contrast": "#04140a",
      "--ok": "#4ade80",
      "--warn": "#facc15",
      "--err": "#f87171",
      "--sidebar": "#070c07",
      "--sidebar-2": "#0b130b",
      "--sidebar-active": "#10240f",
      "--logo-bg": "#0b130b",
      "--overlay": "rgba(2, 6, 2, 0.75)",
      "--shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.45)",
      "--shadow-md": "0 8px 24px rgba(0, 0, 0, 0.5)",
      "--shadow-lg": "0 24px 60px rgba(0, 0, 0, 0.65)",
      "--ring": "rgba(74, 222, 128, 0.35)",
    },
  },
];

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): ThemeStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** True when a persisted or user-supplied value names a known theme. */
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((theme) => theme.id === value);
}

/** The theme for an id, falling back to the default when the id is unknown. */
export function themeById(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? DEFAULT_THEME;
}

/** The theme saved in local storage, or the default when absent or invalid. */
export function readStoredTheme(storage: ThemeStorage | null = browserStorage()): ThemeId {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY);
    return isThemeId(raw) ? raw : DEFAULT_THEME.id;
  } catch {
    return DEFAULT_THEME.id;
  }
}

/** Persist a theme choice; storage failures (private mode, quota) are ignored. */
export function storeTheme(id: ThemeId, storage: ThemeStorage | null = browserStorage()): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // A theme is cosmetic; never break the app because storage is unavailable.
  }
}

/** Flat map of CSS custom properties for a theme. */
export function cssVarsFor(theme: Theme): Record<ThemeVar, string> {
  return { ...theme.vars };
}

/** The subset of the document root that theming needs, so it stays testable. */
export interface ThemeRoot {
  style: {
    colorScheme: string;
    setProperty(property: string, value: string): void;
  };
  dataset: Record<string, string | undefined>;
}

function rootElement(): ThemeRoot | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

function themeColorMeta(): Element | null {
  return typeof document === "undefined"
    ? null
    : document.querySelector('meta[name="theme-color"]');
}

/** Apply a theme's variables and colour scheme to the document root. */
export function applyTheme(id: ThemeId, root: ThemeRoot | null = rootElement()): ThemeId {
  const theme = themeById(id);
  if (root) {
    for (const key of THEME_VARS) root.style.setProperty(key, theme.vars[key]);
    root.style.colorScheme = theme.mode;
    root.dataset.theme = theme.id;
    root.dataset.mode = theme.mode;
  }
  themeColorMeta()?.setAttribute("content", theme.vars["--bg"]);
  return theme.id;
}

/** Read the saved theme, apply it, and return the id that was applied. */
export function applyStoredTheme(root: ThemeRoot | null = rootElement()): ThemeId {
  return applyTheme(readStoredTheme(), root);
}
