import { describe, expect, test } from "vitest";

import {
  applyLayout,
  DEFAULT_LAYOUT,
  isLayoutId,
  LAYOUT_STORAGE_KEY,
  LAYOUTS,
  type LayoutRoot,
  type LayoutStorage,
  layoutById,
  readStoredLayout,
  storeLayout,
} from "./shell-layout.js";

function fakeStorage(initial: Record<string, string> = {}): LayoutStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function fakeRoot(): LayoutRoot {
  return { dataset: {} };
}

describe("layout catalogue", () => {
  test("ships a default and a floating layout", () => {
    expect(LAYOUTS.length).toBeGreaterThanOrEqual(2);
    expect(LAYOUTS[0]).toBe(DEFAULT_LAYOUT);
    expect(new Set(LAYOUTS.map((layout) => layout.id)).size).toBe(LAYOUTS.length);
    expect(layoutById("floating").name).toBe("Floating");
  });

  test("recognises only known layout ids", () => {
    expect(isLayoutId("classic")).toBe(true);
    expect(isLayoutId("floating")).toBe(true);
    expect(isLayoutId("compact")).toBe(false);
    expect(isLayoutId(null)).toBe(false);
    expect(isLayoutId(42)).toBe(false);
  });

  test("layoutById falls back to the default", () => {
    expect(layoutById("missing" as never)).toBe(DEFAULT_LAYOUT);
  });
});

describe("layout persistence", () => {
  test("reads a stored layout", () => {
    const storage = fakeStorage({ [LAYOUT_STORAGE_KEY]: "floating" });
    expect(readStoredLayout(storage)).toBe("floating");
  });

  test("falls back when storage is empty or invalid", () => {
    expect(readStoredLayout(fakeStorage())).toBe(DEFAULT_LAYOUT.id);
    expect(readStoredLayout(fakeStorage({ [LAYOUT_STORAGE_KEY]: "nope" }))).toBe(DEFAULT_LAYOUT.id);
    expect(readStoredLayout(null)).toBe(DEFAULT_LAYOUT.id);
  });

  test("survives a storage that throws", () => {
    const storage: LayoutStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoredLayout(storage)).toBe(DEFAULT_LAYOUT.id);
    expect(() => storeLayout("floating", storage)).not.toThrow();
  });

  test("writes the chosen layout under the stable key", () => {
    const storage = fakeStorage();
    storeLayout("floating", storage);
    expect(storage.getItem(LAYOUT_STORAGE_KEY)).toBe("floating");
  });
});

describe("applying a layout", () => {
  test("marks the document root with the layout id", () => {
    const root = fakeRoot();
    expect(applyLayout("floating", root)).toBe("floating");
    expect(root.dataset.layout).toBe("floating");
  });

  test("falls back to the default id for an unknown layout", () => {
    const root = fakeRoot();
    expect(applyLayout("missing" as never, root)).toBe(DEFAULT_LAYOUT.id);
    expect(root.dataset.layout).toBe(DEFAULT_LAYOUT.id);
  });
});
