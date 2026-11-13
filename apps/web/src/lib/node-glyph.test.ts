import { describe, expect, test } from "vitest";

import { kindLabel, nodeGlyph } from "./node-glyph.js";

describe("nodeGlyph", () => {
  test("every kind has a silhouette", () => {
    for (const kind of ["file", "directory", "symlink", "special"] as const) {
      expect(nodeGlyph(kind).body.length).toBeGreaterThan(0);
    }
  });

  test("only file folds cut into the surface", () => {
    expect(nodeGlyph("file").detailStroke).toBe("cut");
    expect(nodeGlyph("symlink").detailStroke).toBe("ink");
    expect(nodeGlyph("directory").detail).toBeUndefined();
  });
});

describe("kindLabel", () => {
  test("uses display names", () => {
    expect(kindLabel("directory")).toBe("Folder");
    expect(kindLabel("file")).toBe("File");
    expect(kindLabel("symlink")).toBe("Symlink");
    expect(kindLabel("special")).toBe("Special");
  });
});
