import type { HierarchyNode, NodeKind } from "@mish/api-types";

import { formatBytes } from "./format.js";

export type ReportType = "image" | "tree" | "mixed";

export const REPORT_FORMAT = "mish.report";
export const REPORT_VERSION = 1;
export const REPORT_EXTENSION = "mish";
export const MAX_REPORT_BYTES = 64 * 1024 * 1024;

const MAX_TREE_NODES = 200_000;
const MAX_TREE_DEPTH = 64;
const MAX_LOG_LINES = 200_000;
const MAX_TREE_TEXT_CHARS = 8 * 1024 * 1024;
const MAX_SVG_CHARS = 8 * 1024 * 1024;
const MAX_IMAGES = 8;
const MAX_IMAGE_DIMENSION = 8_192;
const NODE_KINDS: ReadonlySet<string> = new Set<NodeKind>([
  "file",
  "directory",
  "symlink",
  "special",
]);

export interface ReportScope {
  id: number;
  path: string[];
}

export interface ReportSnapshot {
  id: string | null;
  root: string | null;
}

export interface ImagePayload {
  mime: "image/svg+xml";
  /** SVG markup. */
  svg: string;
  width: number;
  height: number;
}

interface ReportBase {
  format: typeof REPORT_FORMAT;
  version: typeof REPORT_VERSION;
  createdAt: string;
  view: string;
  scope: ReportScope;
  snapshot: ReportSnapshot;
  generator: string;
}

export interface TreeReport extends ReportBase {
  type: "tree";
  tree: HierarchyNode;
  /** Human-readable, indented rendering of `tree`. */
  treeText: string;
}

export interface ImageReport extends ReportBase {
  type: "image";
  images: ImagePayload[];
}

export interface MixedReport extends ReportBase {
  type: "mixed";
  images: ImagePayload[];
  tree: HierarchyNode;
  /** Human-readable, indented rendering of `tree`. */
  treeText: string;
}

export type MishReport = TreeReport | ImageReport | MixedReport;

export class ReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportError";
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Local `YYYY-MM-DD_HH-mm-ss` stamp used in report file names. */
export function reportTimestamp(date: Date): string {
  return [
    date.getFullYear(),
    "-",
    pad2(date.getMonth() + 1),
    "-",
    pad2(date.getDate()),
    "_",
    pad2(date.getHours()),
    "-",
    pad2(date.getMinutes()),
    "-",
    pad2(date.getSeconds()),
  ].join("");
}

export function reportFileName(type: ReportType, date = new Date()): string {
  return `mish-report-${type}-${reportTimestamp(date)}.${REPORT_EXTENSION}`;
}

export function reportTypeLabel(type: ReportType): string {
  switch (type) {
    case "image":
      return "Chart image";
    case "tree":
      return "Tree log";
    case "mixed":
      return "Mixed report";
  }
}

interface TreeTextFrame {
  node: HierarchyNode;
  prefix: string;
  last: boolean;
  depth: number;
}

function pushChildren(
  stack: TreeTextFrame[],
  node: HierarchyNode,
  prefix: string,
  depth: number,
): void {
  const children = node.children ?? [];
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];
    if (!child) continue;
    stack.push({ node: child, prefix, last: index === children.length - 1, depth });
  }
}

/** Indented log rendering of a hierarchy tree, one node per line. */
export function treeToText(root: HierarchyNode): string {
  const lines = [`${root.name}  ${formatBytes(root.size)}`];
  const stack: TreeTextFrame[] = [];
  pushChildren(stack, root, "", 1);

  while (stack.length > 0 && lines.length < MAX_LOG_LINES) {
    const frame = stack.pop();
    if (!frame) break;
    const branch = frame.last ? "└─ " : "├─ ";
    lines.push(`${frame.prefix}${branch}${frame.node.name}  ${formatBytes(frame.node.size)}`);
    const childPrefix = `${frame.prefix}${frame.last ? "   " : "│  "}`;
    if (frame.depth >= MAX_TREE_DEPTH) {
      if ((frame.node.children?.length ?? 0) > 0) lines.push(`${childPrefix}└─ …`);
      continue;
    }
    pushChildren(stack, frame.node, childPrefix, frame.depth + 1);
  }

  if (stack.length > 0) lines.push("…");
  return `${lines.join("\n")}\n`;
}

export interface FlatTreeNode {
  node: HierarchyNode;
  depth: number;
}

export interface FlatTree {
  rows: FlatTreeNode[];
  total: number;
  truncated: boolean;
}

/** Depth-first flattening for the report viewer; stops collecting at `limit`. */
export function flattenTree(root: HierarchyNode, limit = 5_000): FlatTree {
  const rows: FlatTreeNode[] = [];
  let total = 0;
  const stack: FlatTreeNode[] = [{ node: root, depth: 0 }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) break;
    total += 1;
    if (rows.length < limit) rows.push(frame);
    if (frame.depth >= MAX_TREE_DEPTH) continue;
    const children = frame.node.children ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child) stack.push({ node: child, depth: frame.depth + 1 });
    }
  }

  return { rows, total, truncated: total > rows.length };
}

export interface BuildTreeReportInput {
  view: string;
  scope: ReportScope;
  snapshot: ReportSnapshot;
  tree: HierarchyNode;
  createdAt?: Date;
  treeText?: string;
}

export function buildTreeReport(input: BuildTreeReportInput): TreeReport {
  const createdAt = input.createdAt ?? new Date();
  return {
    format: REPORT_FORMAT,
    version: REPORT_VERSION,
    type: "tree",
    createdAt: createdAt.toISOString(),
    view: input.view,
    scope: input.scope,
    snapshot: input.snapshot,
    generator: "mish",
    tree: input.tree,
    treeText: input.treeText ?? treeToText(input.tree),
  };
}

export interface BuildImageReportInput {
  view: string;
  scope: ReportScope;
  snapshot: ReportSnapshot;
  images: ImagePayload[];
  createdAt?: Date;
}

export function buildImageReport(input: BuildImageReportInput): ImageReport {
  const createdAt = input.createdAt ?? new Date();
  return {
    format: REPORT_FORMAT,
    version: REPORT_VERSION,
    type: "image",
    createdAt: createdAt.toISOString(),
    view: input.view,
    scope: input.scope,
    snapshot: input.snapshot,
    generator: "mish",
    images: input.images,
  };
}

export interface BuildMixedReportInput extends BuildImageReportInput {
  tree: HierarchyNode;
  treeText?: string;
}

export function buildMixedReport(input: BuildMixedReportInput): MixedReport {
  const createdAt = input.createdAt ?? new Date();
  return {
    format: REPORT_FORMAT,
    version: REPORT_VERSION,
    type: "mixed",
    createdAt: createdAt.toISOString(),
    view: input.view,
    scope: input.scope,
    snapshot: input.snapshot,
    generator: "mish",
    images: input.images,
    tree: input.tree,
    treeText: input.treeText ?? treeToText(input.tree),
  };
}

export function encodeReport(report: MishReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new ReportError(`Report field "${field}" must be a string.`);
  return value;
}

function asFiniteNumber(value: unknown, field: string, min = Number.NEGATIVE_INFINITY): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) {
    throw new ReportError(`Report field "${field}" must be a number >= ${min}.`);
  }
  return value;
}

function parseDate(value: unknown): string {
  const text = asString(value, "createdAt");
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) throw new ReportError('Report field "createdAt" is not a valid date.');
  return new Date(ms).toISOString();
}

function parseScope(value: unknown): ReportScope {
  if (!isRecord(value)) throw new ReportError('Report field "scope" must be an object.');
  const id = asFiniteNumber(value.id, "scope.id", 0);
  const path = Array.isArray(value.path)
    ? value.path.map((entry) => asString(entry, "scope.path"))
    : [];
  return { id: Math.floor(id), path };
}

function parseSnapshot(value: unknown): ReportSnapshot {
  if (!isRecord(value)) throw new ReportError('Report field "snapshot" must be an object.');
  const id = value.id === null || value.id === undefined ? null : asString(value.id, "snapshot.id");
  const root =
    value.root === null || value.root === undefined ? null : asString(value.root, "snapshot.root");
  return { id, root };
}

function validateTree(value: unknown): HierarchyNode {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let count = 0;

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) break;
    if (frame.depth > MAX_TREE_DEPTH) throw new ReportError("Report tree is too deep.");
    if (!isRecord(frame.value)) throw new ReportError("Report tree node must be an object.");
    const node = frame.value;
    asFiniteNumber(node.id, "tree.id", 0);
    asString(node.name, "tree.name");
    const kind = asString(node.kind, "tree.kind");
    if (!NODE_KINDS.has(kind)) throw new ReportError(`Unknown tree node kind "${kind}".`);
    asFiniteNumber(node.size, "tree.size", 0);
    count += 1;
    if (count > MAX_TREE_NODES) throw new ReportError("Report tree has too many nodes.");
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) {
        throw new ReportError("Report tree node children must be an array.");
      }
      for (const child of node.children) {
        stack.push({ value: child, depth: frame.depth + 1 });
      }
    }
  }

  return value as HierarchyNode;
}

function parseTreeText(value: unknown, tree: HierarchyNode): string {
  const provided = typeof value === "string" ? value : "";
  return provided.length > 0 && provided.length <= MAX_TREE_TEXT_CHARS
    ? provided
    : treeToText(tree);
}

function assertSafeSvg(svg: string): void {
  const tags = svg.match(/<[^>]*>/g) ?? [];
  for (const tag of tags) {
    if (/^<script[\s>]/i.test(tag) || /\son\w+\s*=/i.test(tag)) {
      throw new ReportError("Report image contains unsafe SVG content.");
    }
    if (
      /\b(?:src|href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/|javascript:)/i.test(tag) ||
      /url\(\s*["']?\s*(?:https?:|\/\/|javascript:)/i.test(tag)
    ) {
      throw new ReportError("Report image references an external resource.");
    }
  }
}

function parseImage(value: unknown): ImagePayload {
  if (!isRecord(value)) throw new ReportError('Report field "image" must be an object.');
  if (value.mime !== "image/svg+xml") {
    throw new ReportError("Only SVG image reports are supported.");
  }
  const svg = asString(value.svg, "image.svg");
  if (svg.length === 0 || svg.length > MAX_SVG_CHARS) {
    throw new ReportError("Report image SVG is empty or too large.");
  }
  const trimmed = svg.trimStart();
  if (!trimmed.startsWith("<svg") && !(trimmed.startsWith("<?xml") && trimmed.includes("<svg"))) {
    throw new ReportError("Report image is not valid SVG.");
  }
  assertSafeSvg(svg);
  const width = Math.floor(asFiniteNumber(value.width, "image.width", 1));
  const height = Math.floor(asFiniteNumber(value.height, "image.height", 1));
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new ReportError("Report image dimensions are too large.");
  }
  return { mime: "image/svg+xml", svg, width, height };
}

function parseImages(value: unknown): ImagePayload[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_IMAGES) {
    throw new ReportError(`Report must contain between 1 and ${MAX_IMAGES} images.`);
  }
  return value.map(parseImage);
}

/** Parse and validate a `.mish` report. Throws {@link ReportError} on bad input. */
export function decodeReport(text: string): MishReport {
  if (text.trim().length === 0) throw new ReportError("The report is empty.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ReportError("The report is not valid JSON.");
  }

  if (!isRecord(parsed)) throw new ReportError("The report must be a JSON object.");
  if (parsed.format !== REPORT_FORMAT) {
    throw new ReportError("This file is not a mish report.");
  }
  if (parsed.version !== REPORT_VERSION) {
    throw new ReportError(`Unsupported report version "${String(parsed.version)}".`);
  }

  const common = {
    format: REPORT_FORMAT,
    version: REPORT_VERSION,
    createdAt: parseDate(parsed.createdAt),
    view: asString(parsed.view, "view"),
    scope: parseScope(parsed.scope),
    snapshot: parseSnapshot(parsed.snapshot),
    generator: typeof parsed.generator === "string" ? parsed.generator : "mish",
  } as const;

  if (parsed.type === "tree") {
    const tree = validateTree(parsed.tree);
    return { ...common, type: "tree", tree, treeText: parseTreeText(parsed.treeText, tree) };
  }

  if (parsed.type === "mixed") {
    const tree = validateTree(parsed.tree);
    return {
      ...common,
      type: "mixed",
      images: parseImages(parsed.images),
      tree,
      treeText: parseTreeText(parsed.treeText, tree),
    };
  }

  if (parsed.type === "image") {
    return { ...common, type: "image", images: parseImages(parsed.images) };
  }

  throw new ReportError(`Unknown report type "${String(parsed.type)}".`);
}
