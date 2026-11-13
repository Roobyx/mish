<script lang="ts">
  import type { HierarchyNode } from "@mish/api-types";

  import { colorForKey } from "../lib/color.js";
  import { formatBytes } from "../lib/format.js";
  import { sunburstArcs } from "../lib/layout.js";
  import { kindLabel, nodeGlyph } from "../lib/node-glyph.js";
  import { tooltipStyle } from "../lib/tooltip.js";

  import NodeIcon from "./NodeIcon.svelte";

  interface Props {
    root: HierarchyNode;
    onselect: (node: HierarchyNode) => void;
  }

  let { root, onselect }: Props = $props();

  const SIZE = 640;
  const arcs = $derived(sunburstArcs(root, { size: SIZE, rings: 2 }));
  let hovered = $state<{ node: HierarchyNode; x: number; y: number } | null>(null);
  let container = $state<HTMLDivElement | null>(null);
  let width = $state(0);
  let height = $state(0);

  function handleKeydown(event: KeyboardEvent, node: HierarchyNode): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onselect(node);
  }

  function handleMove(event: MouseEvent, node: HierarchyNode): void {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    hovered = { node, x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  $effect(() => {
    if (!container) return;
    const element = container;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      width = entry.contentRect.width;
      height = entry.contentRect.height;
    });
    observer.observe(element);
    return () => observer.disconnect();
  });
</script>

<div class="sunburst" bind:this={container}>
  <svg viewBox="0 0 {SIZE} {SIZE}" role="group" aria-label="Sunburst chart of disk usage">
    {#each arcs as arc (arc.node.id)}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_static_element_interactions a11y_no_noninteractive_tabindex -->
      <path
        class="arc"
        d={arc.path}
        fill={colorForKey(arc.node.name)}
        stroke="var(--bg)"
        stroke-width="1.5"
        role="button"
        tabindex="0"
        aria-label={`${arc.node.name}, ${kindLabel(arc.node.kind)}, ${formatBytes(arc.node.size)}`}
        onclick={() => onselect(arc.node)}
        onkeydown={(event) => handleKeydown(event, arc.node)}
        onmousemove={(event) => handleMove(event, arc.node)}
        onmouseleave={() => (hovered = null)}
      />
    {/each}
    {#each arcs as arc (arc.node.id)}
      {#if arc.depth === 1 && arc.angle > 0.2}
        {@const glyph = nodeGlyph(arc.node.kind)}
        <g
          class="kind"
          transform={`translate(${arc.labelX - 5}, ${arc.labelY - 18}) scale(0.625)`}
          aria-hidden="true"
        >
          <path d={glyph.body} fill="rgba(11, 14, 20, 0.82)" />
          {#if glyph.detail}
            <path
              d={glyph.detail}
              fill="none"
              stroke={glyph.detailStroke === "cut"
                ? colorForKey(arc.node.name)
                : "rgba(11, 14, 20, 0.82)"}
              stroke-width="1.2"
            />
          {/if}
        </g>
        <text
          class="label"
          x={arc.labelX}
          y={arc.labelY}
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {arc.node.name}
        </text>
      {/if}
    {/each}
  </svg>
  {#if hovered}
    <div
      class="tooltip"
      style={tooltipStyle({ x: hovered.x, y: hovered.y, width, height })}
    >
      <strong>
        <NodeIcon kind={hovered.node.kind} size={12} decorative />
        <span class="tooltip-name">{hovered.node.name}</span>
      </strong>
      <span>{kindLabel(hovered.node.kind)} · {formatBytes(hovered.node.size)}</span>
    </div>
  {/if}
</div>

<style>
  .sunburst {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .arc {
    cursor: pointer;
  }

  .arc:hover {
    opacity: 0.86;
  }

  .arc:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .label {
    fill: rgba(11, 14, 20, 0.92);
    font-size: 12px;
    font-weight: 600;
    pointer-events: none;
  }

  .kind {
    pointer-events: none;
  }

  .tooltip {
    position: absolute;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    max-width: 240px;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--panel-2);
    font-size: 0.75rem;
    pointer-events: none;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
  }

  .tooltip strong {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    min-width: 0;
  }

  .tooltip-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tooltip > span {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>
