import { describe, expect, test } from "vitest";

import {
  applyTheme,
  cssVarsFor,
  DEFAULT_THEME,
  isThemeId,
  readStoredTheme,
  storeTheme,
  THEME_STORAGE_KEY,
  THEME_VARS,
  THEMES,
  type ThemeRoot,
  type ThemeStorage,
  themeById,
} from "./theme.js";

function fakeStorage(initial: Record<string, string> = {}): ThemeStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function fakeRoot(): ThemeRoot & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    style: {
      colorScheme: "",
      setProperty: (property, value) => {
        values.set(property, value);
      },
    },
    dataset: {},
    values,
  };
}

describe("theme catalogue", () => {
  test("ships a default and several selectable themes", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(4);
    expect(THEMES[0]).toBe(DEFAULT_THEME);
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(THEMES.length);
  });

  test("every theme defines every token", () => {
    for (const theme of THEMES) {
      for (const key of THEME_VARS) {
        expect(theme.vars[key], `${theme.id} ${key}`).toMatch(/\S/);
      }
    }
  });

  test("recognises only known theme ids", () => {
    expect(isThemeId("obsidian")).toBe(true);
    expect(isThemeId("paper")).toBe(true);
    expect(isThemeId("solarized")).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(42)).toBe(false);
  });

  test("themeById falls back to the default", () => {
    expect(themeById("nord").name).toBe("Nord");
    expect(themeById("missing" as never)).toBe(DEFAULT_THEME);
  });
});

describe("theme persistence", () => {
  test("reads a stored theme", () => {
    const storage = fakeStorage({ [THEME_STORAGE_KEY]: "midnight" });
    expect(readStoredTheme(storage)).toBe("midnight");
  });

  test("falls back when storage is empty or invalid", () => {
    expect(readStoredTheme(fakeStorage())).toBe(DEFAULT_THEME.id);
    expect(readStoredTheme(fakeStorage({ [THEME_STORAGE_KEY]: "nope" }))).toBe(DEFAULT_THEME.id);
    expect(readStoredTheme(null)).toBe(DEFAULT_THEME.id);
  });

  test("survives a storage that throws", () => {
    const storage: ThemeStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoredTheme(storage)).toBe(DEFAULT_THEME.id);
    expect(() => storeTheme("paper", storage)).not.toThrow();
  });

  test("writes the chosen theme under the stable key", () => {
    const storage = fakeStorage();
    storeTheme("terminal", storage);
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe("terminal");
  });
});

describe("applying a theme", () => {
  test("sets every token, the colour scheme and data attributes", () => {
    const root = fakeRoot();
    const applied = applyTheme("paper", root);

    expect(applied).toBe("paper");
    expect(root.style.colorScheme).toBe("light");
    expect(root.dataset.theme).toBe("paper");
    expect(root.dataset.mode).toBe("light");
    for (const key of THEME_VARS) {
      expect(root.values.get(key)).toBe(cssVarsFor(themeById("paper"))[key]);
    }
  });

  test("uses the dark colour scheme for dark themes", () => {
    const root = fakeRoot();
    applyTheme("nord", root);
    expect(root.style.colorScheme).toBe("dark");
    expect(root.values.get("--accent")).toBe("#88c0d0");
  });
});
