<script lang="ts">
  import type { HierarchyNode } from "@mish/api-types";

  import { formatBytes } from "../lib/format.js";
  import {
    flattenTree,
    type ImagePayload,
    type MishReport,
    reportTypeLabel,
  } from "../lib/report.js";

  interface Props {
    report: MishReport;
  }

  let { report }: Props = $props();

  let showLog = $state(false);

  const LOG_PREVIEW_LINES = 2_000;
  const flat = $derived.by(() => {
    if (report.type === "image") return null;
    return flattenTree(report.tree);
  });
  const logPreview = $derived.by(() => {
    if (!showLog || report.type === "image") return "";
    const lines = report.treeText.split("\n");
    if (lines.length <= LOG_PREVIEW_LINES) return report.treeText;
    return `${lines.slice(0, LOG_PREVIEW_LINES).join("\n")}\n…`;
  });
  const scopeLabel = $derived(report.scope.path.length > 0 ? report.scope.path.join(" / ") : "/");
  const createdLabel = $derived(new Date(report.createdAt).toLocaleString());

  function imageUrl(image: ImagePayload): string {
    return `data:${image.mime};charset=utf-8,${encodeURIComponent(image.svg)}`;
  }

  function kindLabel(node: HierarchyNode): string {
    return node.kind === "directory" ? "dir" : node.kind;
  }
</script>

<div class="report">
  <dl class="meta">
    <div>
      <dt>Type</dt>
      <dd>{reportTypeLabel(report.type)}</dd>
    </div>
    <div>
      <dt>View</dt>
      <dd>{report.view}</dd>
    </div>
    <div>
      <dt>Created</dt>
      <dd>{createdLabel}</dd>
    </div>
    <div>
      <dt>Snapshot</dt>
      <dd title={report.snapshot.id ?? ""}>{report.snapshot.root ?? report.snapshot.id ?? "—"}</dd>
    </div>
    <div class="wide">
      <dt>Scope</dt>
      <dd title={scopeLabel}>{scopeLabel}</dd>
    </div>
  </dl>

  {#if report.type === "image" || report.type === "mixed"}
    <div class="images">
      {#each report.images as image, index (index)}
        <figure class="image-wrap">
          <img
            src={imageUrl(image)}
            alt={`Chart image report for the ${report.view} view`}
            width={image.width}
            height={image.height}
          />
          <figcaption>
            {image.width} × {image.height} px · SVG
          </figcaption>
        </figure>
      {/each}
    </div>
  {/if}

  {#if report.type === "tree" || report.type === "mixed"}
    {#if flat}
      <div class="tree-head">
        <h3>Tree</h3>
        <span class="muted">
          {flat.total.toLocaleString()} node{flat.total === 1 ? "" : "s"}
          {#if flat.truncated}
            · showing {flat.rows.length.toLocaleString()}
          {/if}
        </span>
        <button type="button" class="toggle" onclick={() => (showLog = !showLog)}>
          {showLog ? "Hide log" : "Show log"}
        </button>
      </div>

      {#if showLog}
        <pre class="log">{logPreview}</pre>
        {#if report.treeText.length > logPreview.length}
          <p class="muted more">
            Log preview truncated; the full log is in the report file.
          </p>
        {/if}
      {:else}
        <ol class="rows">
          {#each flat.rows as row, index (index)}
            <li class="row" style="padding-left: {row.depth * 14 + 4}px">
              <span class="name" title={row.node.name}>{row.node.name}</span>
              <span class="kind">{kindLabel(row.node)}</span>
              <span class="size">{formatBytes(row.node.size)}</span>
            </li>
          {/each}
        </ol>
        {#if flat.truncated}
          <p class="muted more">
            {flat.total - flat.rows.length} more node{flat.total - flat.rows.length === 1 ? "" : "s"} not
            shown.
          </p>
        {/if}
      {/if}
    {/if}
  {/if}
</div>

<style>
  .report {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    min-height: 0;
  }

  .meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.5rem;
    margin: 0;
  }

  .meta div {
    min-width: 0;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel-2);
  }

  .meta .wide {
    grid-column: 1 / -1;
  }

  dt {
    color: var(--subtle);
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  dd {
    margin: 0.2rem 0 0;
    overflow: hidden;
    font-size: 0.78rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .images {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .image-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
  }

  .image-wrap img {
    display: block;
    width: 100%;
    max-height: 58vh;
    object-fit: contain;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel-2);
  }

  figcaption {
    color: var(--muted);
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
  }

  .tree-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tree-head h3 {
    margin: 0;
    color: var(--muted);
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .tree-head .muted {
    flex: 1;
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
  }

  .toggle {
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 0.72rem;
    cursor: pointer;
  }

  .toggle:hover {
    border-color: var(--accent);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    max-height: 54vh;
    margin: 0;
    padding: 0.35rem;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
    list-style: none;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 0.6rem;
    padding-top: 0.16rem;
    padding-bottom: 0.16rem;
    padding-right: 0.35rem;
    border-radius: 5px;
    font-size: 0.75rem;
  }

  .row:hover {
    background: var(--panel-2);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kind {
    padding: 0.02rem 0.3rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--subtle);
    font-size: 0.6rem;
    text-transform: uppercase;
  }

  .size {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .log {
    max-height: 54vh;
    margin: 0;
    padding: 0.6rem 0.7rem;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel-2);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    line-height: 1.45;
    white-space: pre;
  }

  .muted {
    color: var(--muted);
  }

  .more {
    margin: 0;
    font-size: 0.72rem;
  }
</style>
