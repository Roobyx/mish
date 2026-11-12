<script lang="ts">
  import { THEMES, type ThemeId } from "../lib/theme.js";

  import Icon from "./Icon.svelte";

  interface Props {
    theme: ThemeId;
    onselect: (id: ThemeId) => void;
  }

  let { theme, onselect }: Props = $props();
</script>

<div class="grid" role="group" aria-label="Colour theme">
  {#each THEMES as entry (entry.id)}
    <button
      type="button"
      class="card"
      class:active={entry.id === theme}
      aria-pressed={entry.id === theme}
      onclick={() => onselect(entry.id)}
    >
      <span class="preview" style="background: {entry.vars['--bg']}">
        <span
          class="preview-panel"
          style="background: {entry.vars['--panel']}; border-color: {entry.vars['--border']}"
        >
          <span class="preview-side" style="background: {entry.vars['--sidebar']}"></span>
          <span class="preview-body">
            <span class="preview-bar" style="background: {entry.vars['--accent']}"></span>
            <span class="preview-line" style="background: {entry.vars['--muted']}"></span>
            <span
              class="preview-line short"
              style="background: {entry.vars['--border-strong']}"
            ></span>
          </span>
        </span>
      </span>
      <span class="meta">
        <span class="name">
          {entry.name}
          {#if entry.id === theme}
            <span class="tick"><Icon name="check" size={13} /></span>
          {/if}
        </span>
        <span class="desc">{entry.description}</span>
      </span>
    </button>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: 0.65rem;
    padding: 0.85rem;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel-2);
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 120ms ease,
      background 120ms ease,
      transform 120ms ease;
  }

  .card:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }

  .card.active {
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
    background: color-mix(in srgb, var(--accent) 7%, var(--panel-2));
  }

  .preview {
    display: block;
    padding: 0.45rem;
    border-radius: 7px;
  }

  .preview-panel {
    display: flex;
    gap: 0.3rem;
    height: 3.6rem;
    padding: 0.3rem;
    overflow: hidden;
    border: 1px solid;
    border-radius: 5px;
  }

  .preview-side {
    flex: none;
    width: 22%;
    border-radius: 3px;
  }

  .preview-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .preview-bar {
    display: block;
    height: 0.55rem;
    border-radius: 2px;
  }

  .preview-line {
    display: block;
    height: 0.3rem;
    border-radius: 2px;
    opacity: 0.6;
  }

  .preview-line.short {
    width: 62%;
  }

  .meta {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0 0.2rem 0.15rem;
    min-width: 0;
  }

  .name {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .tick {
    display: inline-flex;
    color: var(--accent);
  }

  .desc {
    color: var(--muted);
    font-size: 0.68rem;
    line-height: 1.35;
  }
</style>
