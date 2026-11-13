import { describe, expect, test } from "vitest";

import {
  clampTreeShare,
  DEFAULT_TREE_SHARE,
  MAX_TREE_SHARE,
  MIN_TREE_SHARE,
  readStoredTreeShare,
  type ShareStorage,
  storeTreeShare,
  TREE_SHARE_STORAGE_KEY,
  treeShareFromPointer,
} from "./split-size.js";

function fakeStorage(initial: Record<string, string> = {}): ShareStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("tree share bounds", () => {
  test("clamps to the usable range", () => {
    expect(clampTreeShare(0.1)).toBe(MIN_TREE_SHARE);
    expect(clampTreeShare(0.9)).toBe(MAX_TREE_SHARE);
    expect(clampTreeShare(0.5)).toBe(0.5);
    expect(clampTreeShare(Number.NaN)).toBe(DEFAULT_TREE_SHARE);
  });
});

describe("tree share persistence", () => {
  test("reads a stored share", () => {
    const storage = fakeStorage({ [TREE_SHARE_STORAGE_KEY]: "0.42" });
    expect(readStoredTreeShare(storage)).toBe(0.42);
  });

  test("falls back when storage is empty or invalid", () => {
    expect(readStoredTreeShare(fakeStorage())).toBe(DEFAULT_TREE_SHARE);
    expect(readStoredTreeShare(fakeStorage({ [TREE_SHARE_STORAGE_KEY]: "wide" }))).toBe(
      DEFAULT_TREE_SHARE,
    );
    expect(readStoredTreeShare(null)).toBe(DEFAULT_TREE_SHARE);
  });

  test("survives a storage that throws", () => {
    const storage: ShareStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoredTreeShare(storage)).toBe(DEFAULT_TREE_SHARE);
    expect(() => storeTreeShare(0.5, storage)).not.toThrow();
  });

  test("writes the clamped share under the stable key", () => {
    const storage = fakeStorage();
    storeTreeShare(0.9, storage);
    expect(storage.getItem(TREE_SHARE_STORAGE_KEY)).toBe(String(MAX_TREE_SHARE));
  });
});

describe("dragging the divider", () => {
  const rect = { left: 100, width: 1000, paddingLeft: 12, paddingRight: 12 };
  const contentLeft = 112;
  const contentRight = 1088;
  const contentWidth = 976;

  test("measures the tree share from the right edge", () => {
    expect(treeShareFromPointer(contentRight - contentWidth * 0.4, rect)).toBeCloseTo(0.4);
    expect(treeShareFromPointer(contentRight, rect)).toBe(MIN_TREE_SHARE);
    expect(treeShareFromPointer(contentLeft, rect)).toBe(MAX_TREE_SHARE);
  });

  test("falls back when the content box has no width", () => {
    expect(treeShareFromPointer(0, { left: 0, width: 0 })).toBe(DEFAULT_TREE_SHARE);
  });
});
