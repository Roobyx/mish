<script lang="ts">
  import type { Tile } from "@mish/api-types";

  import { errorMessage, getTree } from "../lib/api.js";
  import type { ColorMode } from "../lib/color.js";
  import {
    buildImageReport,
    buildMixedReport,
    buildTreeReport,
    type MishReport,
    reportFileName,
  } from "../lib/report.js";
  import { captureChart, type TreemapCapture } from "../lib/report-image.js";
  import { downloadReport, readReportFile } from "../lib/report-io.js";

  import Icon from "./Icon.svelte";

  interface Crumb {
    id: number;
    name: string;
  }

  interface Props {
    view: string;
    snapshotId: string | null;
    snapshotRoot: string | null;
    scopeId: number;
    scopePath: Crumb[];
    chartHost: HTMLElement | null;
    canExportImage: boolean;
    tiles: Tile[];
    colorMode: ColorMode;
    onimport: (report: MishReport) => void;
    onnotice: (message: string) => void;
  }

  let {
    view,
    snapshotId,
    snapshotRoot,
    scopeId,
    scopePath,
    chartHost,
    canExportImage,
    tiles,
    colorMode,
    onimport,
    onnotice,
  }: Props = $props();

  let open = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let root = $state<HTMLDivElement | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  const canExportTree = $derived(snapshotId !== null);
  const canExportChart = $derived(canExportImage && snapshotId !== null && chartHost !== null);
  const canExportMixed = $derived(canExportChart && canExportTree);

  function toggle(): void {
    open = !open;
    error = null;
  }

  function scopeNames(): string[] {
    return scopePath.map((crumb) => crumb.name);
  }

  function treemapCapture(): TreemapCapture | undefined {
    return view === "treemap" ? { tiles, colorMode } : undefined;
  }

  async function exportImage(): Promise<void> {
    if (!snapshotId || !chartHost || busy) return;
    const target = {
      view,
      scope: { id: scopeId, path: scopeNames() },
      snapshot: { id: snapshotId, root: snapshotRoot },
    };
    const host = chartHost;
    const treemap = treemapCapture();
    busy = true;
    error = null;
    try {
      const image = await captureChart(host, { treemap });
      const createdAt = new Date();
      const report = buildImageReport({ ...target, images: [image], createdAt });
      const fileName = reportFileName("image", createdAt);
      downloadReport(report, fileName);
      onnotice(`Saved ${fileName}`);
      open = false;
    } catch (cause) {
      error = errorMessage(cause);
    } finally {
      busy = false;
    }
  }

  async function exportMixed(): Promise<void> {
    if (!snapshotId || !chartHost || busy) return;
    const target = {
      view,
      snapshotId,
      scopeId,
      scope: { id: scopeId, path: scopeNames() },
      snapshot: { id: snapshotId, root: snapshotRoot },
    };
    const host = chartHost;
    const treemap = treemapCapture();
    busy = true;
    error = null;
    try {
      const [image, response] = await Promise.all([
        captureChart(host, { treemap }),
        getTree(target.snapshotId, target.scopeId, 4, 5_000),
      ]);
      const createdAt = new Date();
      const report = buildMixedReport({
        view: target.view,
        scope: target.scope,
        snapshot: target.snapshot,
        images: [image],
        tree: response.root,
        createdAt,
      });
      const fileName = reportFileName("mixed", createdAt);
      downloadReport(report, fileName);
      onnotice(`Saved ${fileName}`);
      open = false;
    } catch (cause) {
      error = errorMessage(cause);
    } finally {
      busy = false;
    }
  }

  async function exportTree(): Promise<void> {
    if (!snapshotId || busy) return;
    const target = {
      view,
      snapshotId,
      scopeId,
      scope: { id: scopeId, path: scopeNames() },
      snapshot: { id: snapshotId, root: snapshotRoot },
    };
    busy = true;
    error = null;
    try {
      const response = await getTree(target.snapshotId, target.scopeId, 4, 5_000);
      const createdAt = new Date();
      const report = buildTreeReport({
        view: target.view,
        scope: target.scope,
        snapshot: target.snapshot,
        tree: response.root,
        createdAt,
      });
      const fileName = reportFileName("tree", createdAt);
      downloadReport(report, fileName);
      onnotice(`Saved ${fileName}`);
      open = false;
    } catch (cause) {
      error = errorMessage(cause);
    } finally {
      busy = false;
    }
  }

  function pickFile(): void {
    error = null;
    fileInput?.click();
  }

  async function handleFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    busy = true;
    error = null;
    try {
      const report = await readReportFile(file);
      open = false;
      onimport(report);
      onnotice(`Opened ${file.name}`);
    } catch (cause) {
      error = errorMessage(cause);
    } finally {
      busy = false;
    }
  }

  $effect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (target instanceof Node && root && !root.contains(target)) open = false;
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });
</script>

<svelte:window
  onkeydown={(event) => {
    if (open && event.key === "Escape") open = false;
  }}
/>

<div class="report-menu" bind:this={root}>
  <button
    type="button"
    class="trigger"
    class:active={open}
    aria-haspopup="menu"
    aria-expanded={open}
    title="Export or import a .mish report"
    onclick={toggle}
  >
    <Icon name="download" size={15} />
    <span class="label">Export</span>
  </button>

  {#if open}
    <div class="menu" role="menu" aria-label="Reports">
      <p class="menu-title">Export report</p>
      <button
        type="button"
        role="menuitem"
        class="item"
        disabled={!canExportChart || busy}
        title={canExportChart
          ? "Save the current chart as a .mish SVG image report"
          : "Available on chart views"}
        onclick={() => void exportImage()}
      >
        <Icon name="pie-chart" size={14} />
        <span class="item-label">Chart image</span>
        <span class="ext">.mish</span>
      </button>
      <button
        type="button"
        role="menuitem"
        class="item"
        disabled={!canExportMixed || busy}
        title={canExportMixed
          ? "Save the chart SVG and tree log in one .mish report"
          : "Available on chart views with a selected snapshot"}
        onclick={() => void exportMixed()}
      >
        <Icon name="layers" size={14} />
        <span class="item-label">Mixed report</span>
        <span class="ext">.mish</span>
      </button>
      <button
        type="button"
        role="menuitem"
        class="item"
        disabled={!canExportTree || busy}
        title={canExportTree
          ? "Save the current scope tree as a .mish log report"
          : "Select a snapshot first"}
        onclick={() => void exportTree()}
      >
        <Icon name="list" size={14} />
        <span class="item-label">Tree log</span>
        <span class="ext">.mish</span>
      </button>
      <div class="separator"></div>
      <button type="button" role="menuitem" class="item" disabled={busy} onclick={pickFile}>
        <Icon name="upload" size={14} />
        <span class="item-label">Import report…</span>
      </button>
      {#if busy}
        <p class="status" role="status">Working…</p>
      {/if}
      {#if error}
        <p class="status error" role="alert">{error}</p>
      {/if}
    </div>
  {/if}

  <input
    bind:this={fileInput}
    class="file"
    type="file"
    accept=".mish,application/json"
    onchange={handleFile}
  />
</div>

<style>
  .report-menu {
    position: relative;
    display: inline-flex;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    height: 2.1rem;
    padding: 0 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--panel);
    color: var(--muted);
    font: inherit;
    font-size: 0.74rem;
    cursor: pointer;
    transition:
      background 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .trigger:hover,
  .trigger.active {
    border-color: var(--border-strong);
    background: var(--panel-2);
    color: var(--text);
  }

  .trigger.active {
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
    color: var(--accent);
  }

  .menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    width: 232px;
    padding: 0.35rem;
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--panel);
    box-shadow: var(--shadow-lg);
  }

  .menu-title {
    margin: 0;
    padding: 0.3rem 0.45rem 0.15rem;
    color: var(--subtle);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    width: 100%;
    padding: 0.42rem 0.45rem;
    border: none;
    border-radius: 6px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 0.78rem;
    text-align: left;
    cursor: pointer;
  }

  .item:hover:not(:disabled) {
    background: var(--panel-2);
  }

  .item:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .item-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ext {
    color: var(--subtle);
    font-family: var(--font-mono);
    font-size: 0.62rem;
  }

  .separator {
    height: 1px;
    margin: 0.25rem 0.2rem;
    background: var(--border);
  }

  .status {
    margin: 0;
    padding: 0.3rem 0.45rem;
    color: var(--muted);
    font-size: 0.7rem;
    line-height: 1.4;
  }

  .status.error {
    color: var(--err);
  }

  .file {
    display: none;
  }

  @media (max-width: 960px) {
    .label {
      display: none;
    }

    .trigger {
      padding: 0 0.5rem;
    }
  }
</style>
