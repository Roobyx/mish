import type { HierarchyNode } from "@mish/api-types";
import { describe, expect, test } from "vitest";

import {
  buildImageReport,
  buildMixedReport,
  buildTreeReport,
  decodeReport,
  encodeReport,
  flattenTree,
  REPORT_FORMAT,
  REPORT_VERSION,
  ReportError,
  reportFileName,
  reportTimestamp,
  treeToText,
} from "./report.js";

const TREE: HierarchyNode = {
  id: 0,
  name: "root",
  kind: "directory",
  size: 100,
  children: [
    { id: 1, name: "a", kind: "file", size: 60 },
    {
      id: 2,
      name: "b",
      kind: "directory",
      size: 40,
      children: [{ id: 3, name: "c", kind: "file", size: 40 }],
    },
  ],
};

const SCOPE = { id: 0, path: ["root"] };
const SNAPSHOT = { id: "scan-1", root: "/host/root" };

describe("report file names", () => {
  const date = new Date(2026, 10, 13, 12, 1, 16);

  test("stamp is local and filesystem-safe", () => {
    expect(reportTimestamp(date)).toBe("2026-11-13_12-01-16");
  });

  test("uses the mish-report-type-date_time pattern", () => {
    expect(reportFileName("image", date)).toBe("mish-report-image-2026-11-13_12-01-16.mish");
    expect(reportFileName("tree", date)).toBe("mish-report-tree-2026-11-13_12-01-16.mish");
  });
});

describe("treeToText", () => {
  test("renders an indented log with sizes", () => {
    expect(treeToText(TREE)).toBe(
      ["root  100 B", "├─ a  60 B", "└─ b  40 B", "   └─ c  40 B", ""].join("\n"),
    );
  });
});

describe("flattenTree", () => {
  test("walks depth-first and reports truncation", () => {
    const flat = flattenTree(TREE, 2);
    expect(flat.rows.map((row) => row.node.name)).toEqual(["root", "a"]);
    expect(flat.total).toBe(4);
    expect(flat.truncated).toBe(true);
  });

  test("keeps the full tree when under the limit", () => {
    const flat = flattenTree(TREE);
    expect(flat.rows.map((row) => row.node.name)).toEqual(["root", "a", "b", "c"]);
    expect(flat.truncated).toBe(false);
  });
});

describe("tree reports", () => {
  test("round-trip through encode and decode", () => {
    const report = buildTreeReport({
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      tree: TREE,
      createdAt: new Date(2026, 10, 13, 12, 1, 16),
    });
    expect(report.type).toBe("tree");
    expect(report.treeText).toContain("root  100 B");
    expect(decodeReport(encodeReport(report))).toEqual(report);
  });

  test("regenerates a missing tree log", () => {
    const report = buildTreeReport({
      view: "sunburst",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      tree: TREE,
    });
    const raw = JSON.parse(encodeReport(report)) as Record<string, unknown>;
    delete raw.treeText;
    const decoded = decodeReport(JSON.stringify(raw));
    expect(decoded.type).toBe("tree");
    if (decoded.type === "tree") expect(decoded.treeText).toBe(treeToText(TREE));
  });

  test("rejects an invalid node kind", () => {
    const report = buildTreeReport({
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      tree: TREE,
    });
    const raw = JSON.parse(encodeReport(report)) as Record<string, unknown>;
    const tree = raw.tree as Record<string, unknown>;
    const children = tree.children as Array<Record<string, unknown>>;
    if (children[0]) children[0].kind = "socket";
    expect(() => decodeReport(JSON.stringify(raw))).toThrow(ReportError);
  });

  test("rejects a tree that is too deep", () => {
    const root: HierarchyNode = { id: 0, name: "n0", kind: "directory", size: 1 };
    let current = root;
    for (let index = 1; index <= 66; index += 1) {
      const child: HierarchyNode = { id: index, name: `n${index}`, kind: "file", size: 1 };
      current.children = [child];
      current = child;
    }
    const report = buildTreeReport({
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      tree: root,
    });
    expect(() => decodeReport(encodeReport(report))).toThrow(/too deep/);
  });
});

describe("image reports", () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><rect width="10" height="10" fill="#4f8cff"/></svg>';
  const image = { mime: "image/svg+xml" as const, svg: SVG, width: 10, height: 10 };

  test("round-trip through encode and decode", () => {
    const report = buildImageReport({
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      images: [image],
      createdAt: new Date(2026, 10, 13, 12, 1, 16),
    });
    expect(decodeReport(encodeReport(report))).toEqual(report);
  });

  test("accepts multiple images", () => {
    const report = buildImageReport({
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      images: [image, image],
    });
    const decoded = decodeReport(encodeReport(report));
    expect(decoded.type).toBe("image");
    if (decoded.type === "image") expect(decoded.images).toHaveLength(2);
  });

  test("rejects non-SVG payloads", () => {
    const report = buildImageReport({
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      images: [image],
    });
    const raw = JSON.parse(encodeReport(report)) as Record<string, unknown>;
    const images = raw.images as Array<Record<string, unknown>>;
    if (images[0]) images[0].mime = "image/png";
    expect(() => decodeReport(JSON.stringify(raw))).toThrow(/SVG/);
  });

  test("rejects markup that is not SVG", () => {
    const report = buildImageReport({
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      images: [{ ...image, svg: "<div>not svg</div>" }],
    });
    expect(() => decodeReport(encodeReport(report))).toThrow(/valid SVG/);
  });

  test("rejects unsafe SVG content", () => {
    const report = buildImageReport({
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      images: [
        {
          ...image,
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        },
      ],
    });
    expect(() => decodeReport(encodeReport(report))).toThrow(/unsafe/);
  });

  test("allows text that looks like an event handler", () => {
    const report = buildImageReport({
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      images: [
        {
          ...image,
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>onload=javascript:alert(1)</text></svg>',
        },
      ],
    });
    expect(() => decodeReport(encodeReport(report))).not.toThrow();
  });

  test("rejects external SVG references", () => {
    const report = buildImageReport({
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      images: [
        {
          ...image,
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/x.png"/></svg>',
        },
      ],
    });
    expect(() => decodeReport(encodeReport(report))).toThrow(/external/);
  });

  test("rejects an empty image list", () => {
    const report = buildImageReport({
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      images: [],
    });
    expect(() => decodeReport(encodeReport(report))).toThrow(/between 1 and/);
  });
});

describe("mixed reports", () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"><rect width="10" height="10" fill="#3ddc97"/></svg>';
  const image = { mime: "image/svg+xml" as const, svg: SVG, width: 10, height: 10 };

  test("round-trip keeps images and the tree log", () => {
    const report = buildMixedReport({
      view: "sunburst",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      images: [image],
      tree: TREE,
      createdAt: new Date(2026, 10, 13, 12, 1, 16),
    });
    const decoded = decodeReport(encodeReport(report));
    expect(decoded).toEqual(report);
    expect(decoded.type).toBe("mixed");
    if (decoded.type === "mixed") {
      expect(decoded.images).toHaveLength(1);
      expect(decoded.treeText).toContain("root  100 B");
    }
  });

  test("requires a valid tree", () => {
    const report = buildMixedReport({
      view: "sunburst",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      images: [image],
      tree: TREE,
    });
    const raw = JSON.parse(encodeReport(report)) as Record<string, unknown>;
    raw.tree = { id: 0, name: "bad", kind: "socket", size: 1 };
    expect(() => decodeReport(JSON.stringify(raw))).toThrow(/kind/);
  });
});

describe("decodeReport validation", () => {
  test("rejects non-JSON and empty input", () => {
    expect(() => decodeReport("")).toThrow(/empty/);
    expect(() => decodeReport("nope")).toThrow(/valid JSON/);
  });

  test("rejects another format and unsupported versions", () => {
    const base = {
      format: REPORT_FORMAT,
      version: REPORT_VERSION,
      type: "tree",
      createdAt: new Date().toISOString(),
      view: "treemap",
      scope: SCOPE,
      snapshot: SNAPSHOT,
      tree: TREE,
      treeText: "root",
    };
    expect(() => decodeReport(JSON.stringify({ ...base, format: "other" }))).toThrow(
      /not a mish report/,
    );
    expect(() => decodeReport(JSON.stringify({ ...base, version: 99 }))).toThrow(
      /Unsupported report version/,
    );
    expect(() => decodeReport(JSON.stringify({ ...base, type: "video" }))).toThrow(
      /Unknown report type/,
    );
  });
});
