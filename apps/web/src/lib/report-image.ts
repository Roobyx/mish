import type { Tile } from "@mish/api-types";

import { type ColorMode, colorForExtension, colorForKey, extensionOf } from "./color.js";
import { formatBytes } from "./format.js";
import type { ImagePayload } from "./report.js";

const MIN_CHART_AREA = 2_500;
const STYLE_CHUNK = 250;
const SVG_NS = "http://www.w3.org/2000/svg";
const XHTML_NS = "http://www.w3.org/1999/xhtml";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const SVG_STYLE_PROPERTIES = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "visibility",
  "display",
] as const;

const HTML_STYLE_PROPERTIES = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "box-sizing",
  "overflow",
  "overflow-x",
  "overflow-y",
  "flex",
  "flex-direction",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "align-items",
  "align-self",
  "justify-content",
  "gap",
  "row-gap",
  "column-gap",
  "grid-template-columns",
  "grid-template-rows",
  "grid-auto-flow",
  "grid-column",
  "grid-row",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "color",
  "border-color",
  "border-style",
  "border-width",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-radius",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-right-radius",
  "border-bottom-left-radius",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "text-decoration",
  "white-space",
  "text-overflow",
  "opacity",
  "visibility",
  "transform",
  "transform-origin",
  "box-shadow",
  "list-style",
  "vertical-align",
] as const;

function resolveBackground(element: HTMLElement): string {
  const computed = getComputedStyle(element);
  const own = computed.backgroundColor;
  if (own.length > 0 && own !== "transparent" && own !== "rgba(0, 0, 0, 0)") return own;
  const panel = computed.getPropertyValue("--panel").trim();
  if (panel.length > 0) return panel;
  const background = computed.getPropertyValue("--bg").trim();
  if (background.length > 0) return background;
  return "#0b0e14";
}

async function inlineSvgStyles(source: SVGSVGElement, target: SVGSVGElement): Promise<void> {
  const from = [source, ...source.querySelectorAll<SVGElement>("*")];
  const to = [target, ...target.querySelectorAll<SVGElement>("*")];
  const count = Math.min(from.length, to.length);
  for (let index = 0; index < count; index += 1) {
    const sourceElement = from[index];
    const targetElement = to[index];
    if (!sourceElement || !targetElement) continue;
    const computed = getComputedStyle(sourceElement);
    for (const property of SVG_STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (value.length > 0) targetElement.style.setProperty(property, value);
    }
    if (index > 0 && index % STYLE_CHUNK === 0) await yieldToMain();
  }
}

async function inlineHtmlStyles(source: HTMLElement, target: HTMLElement): Promise<void> {
  const from = [source, ...source.querySelectorAll<HTMLElement>("*")];
  const to = [target, ...target.querySelectorAll<HTMLElement>("*")];
  const count = Math.min(from.length, to.length);
  for (let index = 0; index < count; index += 1) {
    const sourceElement = from[index];
    const targetElement = to[index];
    if (!sourceElement || !targetElement) continue;
    const computed = getComputedStyle(sourceElement);
    for (const property of HTML_STYLE_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (value.length > 0) targetElement.style.setProperty(property, value);
    }
    if (index > 0 && index % STYLE_CHUNK === 0) await yieldToMain();
  }
}

function largestChartSvg(element: HTMLElement): SVGSVGElement | null {
  let best: SVGSVGElement | null = null;
  let bestArea = 0;
  for (const svg of element.querySelectorAll("svg")) {
    const box = svg.getBoundingClientRect();
    const area = box.width * box.height;
    const viewBoxWidth = svg.viewBox.baseVal.width;
    if (viewBoxWidth < 100 || area < MIN_CHART_AREA) continue;
    if (area > bestArea) {
      bestArea = area;
      best = svg;
    }
  }
  return best;
}

export interface TreemapCapture {
  tiles: Tile[];
  colorMode: ColorMode;
}

function treemapFill(tile: Tile, colorMode: ColorMode): string {
  if (colorMode === "ext") return colorForExtension(tile.colorKey ?? extensionOf(tile.name));
  return colorForKey(tile.name);
}

function treemapSvg(
  capture: TreemapCapture,
  width: number,
  height: number,
  background: string,
): ImagePayload {
  const context = document.createElement("canvas").getContext("2d");
  const truncate = (text: string, maxWidth: number, font: string): string => {
    if (!context) return text;
    context.font = font;
    if (context.measureText(text).width <= maxWidth) return text;
    let end = text.length;
    while (end > 1 && context.measureText(`${text.slice(0, end)}…`).width > maxWidth) {
      end -= 1;
    }
    return `${text.slice(0, end)}…`;
  };

  const parts = [
    `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${escapeXml(background)}"/>`,
  ];
  for (const tile of capture.tiles) {
    const x = tile.x * width;
    const y = tile.y * height;
    const w = tile.w * width;
    const h = tile.h * height;
    if (w <= 0 || h <= 0) continue;
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${escapeXml(
        treemapFill(tile, capture.colorMode),
      )}"/>`,
    );
    parts.push(
      `<rect x="${x + 0.5}" y="${y + 0.5}" width="${Math.max(0, w - 1)}" ` +
        `height="${Math.max(0, h - 1)}" fill="none" stroke="rgba(11, 14, 20, 0.85)" ` +
        `stroke-width="1"/>`,
    );
    if (w >= 48 && h >= 20) {
      const name = truncate(tile.name, w - 8, "600 12px ui-sans-serif, system-ui, sans-serif");
      parts.push(
        `<text x="${x + 4}" y="${y + 4}" fill="rgba(11, 14, 20, 0.92)" ` +
          `font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="600" ` +
          `dominant-baseline="hanging">${escapeXml(name)}</text>`,
      );
      parts.push(
        `<text x="${x + 4}" y="${y + 20}" fill="rgba(11, 14, 20, 0.92)" ` +
          `font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" ` +
          `dominant-baseline="hanging">${escapeXml(formatBytes(tile.size))}</text>`,
      );
      if (tile.label && h >= 36) {
        const label = truncate(
          tile.label,
          w - 8,
          "italic 11px ui-sans-serif, system-ui, sans-serif",
        );
        parts.push(
          `<text x="${x + 4}" y="${y + 36}" fill="rgba(11, 14, 20, 0.72)" ` +
            `font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" font-style="italic" ` +
            `dominant-baseline="hanging">${escapeXml(label)}</text>`,
        );
      }
    }
  }
  parts.push("</svg>");
  return { mime: "image/svg+xml", svg: parts.join(""), width, height };
}

function canvasToSvg(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  background: string,
): ImagePayload {
  const dataUrl = canvas.toDataURL("image/png");
  const svg =
    `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="${escapeXml(background)}"/>` +
    `<image href="${escapeXml(dataUrl)}" width="${width}" height="${height}"/>` +
    `</svg>`;
  return { mime: "image/svg+xml", svg, width, height };
}

async function svgToPayload(
  svg: SVGSVGElement,
  width: number,
  height: number,
  background: string,
): Promise<ImagePayload> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  await inlineSvgStyles(svg, clone);
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const backgroundRect = document.createElementNS(SVG_NS, "rect");
  backgroundRect.setAttribute("width", "100%");
  backgroundRect.setAttribute("height", "100%");
  backgroundRect.setAttribute("fill", background);
  clone.insertBefore(backgroundRect, clone.firstChild);
  const markup = new XMLSerializer().serializeToString(clone);
  return { mime: "image/svg+xml", svg: markup, width, height };
}

async function domToPayload(
  element: HTMLElement,
  width: number,
  height: number,
  background: string,
): Promise<ImagePayload> {
  const clone = element.cloneNode(true) as HTMLElement;
  await inlineHtmlStyles(element, clone);
  for (const tooltip of clone.querySelectorAll(".tooltip")) tooltip.remove();
  clone.setAttribute("xmlns", XHTML_NS);
  clone.style.margin = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.overflow = "hidden";
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg =
    `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="${escapeXml(background)}"/>` +
    `<foreignObject x="0" y="0" width="${width}" height="${height}">${serialized}</foreignObject>` +
    `</svg>`;
  return { mime: "image/svg+xml", svg, width, height };
}

/** Capture the chart inside `element` as an SVG payload. */
export async function captureChart(
  element: HTMLElement,
  options?: { treemap?: TreemapCapture },
): Promise<ImagePayload> {
  const box = element.getBoundingClientRect();
  if (box.width < 2 || box.height < 2) {
    throw new Error("The chart has no visible area to export.");
  }
  const width = Math.max(1, Math.round(box.width));
  const height = Math.max(1, Math.round(box.height));
  const background = resolveBackground(element);

  const canvas = element.querySelector("canvas");
  if (canvas) {
    if (options?.treemap) return treemapSvg(options.treemap, width, height, background);
    return canvasToSvg(canvas, width, height, background);
  }

  const svg = largestChartSvg(element);
  if (svg) return svgToPayload(svg, width, height, background);

  return domToPayload(element, width, height, background);
}
