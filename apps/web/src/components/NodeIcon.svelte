<script lang="ts">
  import type { NodeKind } from "@mish/api-types";

  import { nodeGlyph } from "../lib/node-glyph.js";

  interface Props {
    kind: NodeKind;
    /** Optional tint, e.g. an extension colour for a file. */
    color?: string;
    /** Rendered size in pixels; defaults to 14. */
    size?: number;
    /** Hide the icon from assistive tech when adjacent text already names the kind. */
    decorative?: boolean;
  }

  let { kind, color, size = 14, decorative = false }: Props = $props();

  const tint = $derived(color ?? "var(--muted)");
  const glyph = $derived(nodeGlyph(kind));
</script>

<span
  class="icon"
  role={decorative ? undefined : "img"}
  aria-label={decorative ? undefined : kind}
  aria-hidden={decorative ? "true" : undefined}
  style="width: {size}px; height: {size}px"
>
  <svg viewBox="0 0 16 16" style="width: {size}px; height: {size}px">
    <path d={glyph.body} fill={tint} />
    {#if glyph.detail}
      <path
        d={glyph.detail}
        fill="none"
        stroke={glyph.detailStroke === "cut" ? "var(--bg)" : "var(--text)"}
        stroke-width="1.2"
      />
    {/if}
  </svg>
</span>

<style>
  .icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
  }

  svg {
    display: block;
  }
</style>
