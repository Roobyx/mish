import { describe, expect, test } from "vitest";

import { breadcrumbItems } from "./breadcrumb.js";

const crumb = (id: number, name = `dir-${id}`) => ({ id, name });

describe("breadcrumbItems", () => {
  test("renders nothing for an empty path", () => {
    expect(breadcrumbItems([])).toEqual([]);
  });

  test("marks the only crumb as current", () => {
    expect(breadcrumbItems([crumb(0)])).toEqual([
      { kind: "crumb", crumb: crumb(0), index: 0, current: true },
    ]);
  });

  test("keeps every crumb when the path is short", () => {
    const path = [crumb(0), crumb(1), crumb(2), crumb(3), crumb(4)];
    const items = breadcrumbItems(path);

    expect(items).toHaveLength(5);
    expect(items.map((item) => (item.kind === "crumb" ? item.index : -1))).toEqual([0, 1, 2, 3, 4]);
    expect(items.at(-1)).toEqual({ kind: "crumb", crumb: path[4], index: 4, current: true });
  });

  test("collapses the middle of a deep path and keeps the tail navigable", () => {
    const path = [
      crumb(0, "/"),
      crumb(1, "var"),
      crumb(2, "lib"),
      crumb(3, "docker"),
      crumb(4, "overlay2"),
      crumb(5, "layer"),
      crumb(6, "abc"),
    ];

    expect(breadcrumbItems(path)).toEqual([
      { kind: "crumb", crumb: path[0], index: 0, current: false },
      { kind: "gap", hidden: "var / lib / docker" },
      { kind: "crumb", crumb: path[4], index: 4, current: false },
      { kind: "crumb", crumb: path[5], index: 5, current: false },
      { kind: "crumb", crumb: path[6], index: 6, current: true },
    ]);
  });

  test("collapses exactly one hidden crumb once the limit is exceeded", () => {
    const path = [crumb(0), crumb(1), crumb(2), crumb(3), crumb(4), crumb(5)];

    expect(breadcrumbItems(path)).toEqual([
      { kind: "crumb", crumb: path[0], index: 0, current: false },
      { kind: "gap", hidden: "dir-1 / dir-2" },
      { kind: "crumb", crumb: path[3], index: 3, current: false },
      { kind: "crumb", crumb: path[4], index: 4, current: false },
      { kind: "crumb", crumb: path[5], index: 5, current: true },
    ]);
  });
});
