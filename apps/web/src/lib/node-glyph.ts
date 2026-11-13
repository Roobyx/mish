import type { NodeKind } from "@mish/api-types";

/** A filled silhouette plus an optional detail line, both on a 16×16 grid. */
export interface NodeGlyph {
  body: string;
  detail?: string;
  /** Whether the detail line should match the surface behind it or the glyph ink. */
  detailStroke?: "cut" | "ink";
}

const GLYPHS: Record<NodeKind, NodeGlyph> = {
  file: {
    body: "M4 1.6 h5.4 L12.6 5.1 V14.4 H4 Z",
    detail: "M9.4 1.6 V5.1 H12.6",
    detailStroke: "cut",
  },
  directory: {
    body: "M1.4 4.2 h4.4 l1.5 1.7 H14.6 V12.7 H1.4 Z",
  },
  symlink: {
    body: "M4 1.6 h5.4 L12.6 5.1 V14.4 H4 Z",
    detail: "M6.2 8.6 h4.1 M8.7 7 l1.6 1.6 l-1.6 1.6",
    detailStroke: "ink",
  },
  special: {
    body: "M8 1.4 L14.6 8 L8 14.6 L1.4 8 Z",
  },
};

/** Geometry for a node kind, shared by the inline icon and canvas renderers. */
export function nodeGlyph(kind: NodeKind): NodeGlyph {
  return GLYPHS[kind];
}

/** Human label for a node kind, e.g. for tooltips and accessibility text. */
export function kindLabel(kind: NodeKind): string {
  switch (kind) {
    case "directory":
      return "Folder";
    case "symlink":
      return "Symlink";
    case "special":
      return "Special";
    default:
      return "File";
  }
}
