<script lang="ts">
  import { onMount } from "svelte";

  import { LAYOUTS, type LayoutId } from "../lib/shell-layout.js";
  import { THEMES, themeById, type ThemeId } from "../lib/theme.js";

  import Icon from "./Icon.svelte";

  interface Props {
    theme: ThemeId;
    onselect: (id: ThemeId) => void;
    layout: LayoutId;
    onlayout: (id: LayoutId) => void;
  }

  let { theme, onselect, layout, onlayout }: Props = $props();

  let open = $state(false);
  let host = $state<HTMLDivElement | null>(null);

  const current = $derived(themeById(theme));

  function chooseTheme(id: ThemeId): void {
    open = false;
    onselect(id);
  }

  function chooseLayout(id: LayoutId): void {
    open = false;
    onlayout(id);
  }

  onMount(() => {
    function handlePointer(event: PointerEvent): void {
      if (!open) return;
      const target = event.target;
      if (host && target instanceof Node && !host.contains(target)) open = false;
    }
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  });
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === "Escape") open = false;
  }}
/>

<div class="switcher" bind:this={host}>
  <button
    type="button"
    class="trigger"
    class:open
    aria-haspopup="dialog"
    aria-expanded={open}
    title="Theme and layout"
    onclick={() => (open = !open)}
  >
    <Icon name="palette" size={15} />
    <span class="label">{current.name}</span>
    <span class="chevron"><Icon name="chevron-down" size={13} /></span>
  </button>

  {#if open}
    <div class="menu" role="dialog" aria-label="Theme and layout">
      <div class="section">
        <span class="section-label">Theme</span>
        <ul class="options" role="listbox" aria-label="Colour theme">
          {#each THEMES as entry (entry.id)}
            <li role="presentation">
              <button
                type="button"
                class="option"
                class:selected={entry.id === theme}
                role="option"
                aria-selected={entry.id === theme}
                onclick={() => chooseTheme(entry.id)}
              >
                <span class="swatches" aria-hidden="true">
                  <span style="background: {entry.vars['--bg']}"></span>
                  <span style="background: {entry.vars['--panel-2']}"></span>
                  <span style="background: {entry.vars['--accent']}"></span>
                  <span style="background: {entry.vars['--text']}"></span>
                </span>
                <span class="option-main">
                  <span class="option-title">{entry.name}</span>
                  <span class="option-meta">{entry.description}</span>
                </span>
                {#if entry.id === theme}
                  <span class="tick"><Icon name="check" size={14} /></span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </div>

      <div class="section">
        <span class="section-label">Layout</span>
        <div class="options" role="group" aria-label="Layout">
          {#each LAYOUTS as entry (entry.id)}
            <button
              type="button"
              class="option layout-option"
              class:selected={entry.id === layout}
              aria-pressed={entry.id === layout}
              onclick={() => chooseLayout(entry.id)}
            >
              <span class="layout-icon" aria-hidden="true">
                <Icon name={entry.id === "floating" ? "layers" : "grid"} size={14} />
              </span>
              <span class="option-main">
                <span class="option-title">{entry.name}</span>
                <span class="option-meta">{entry.description}</span>
              </span>
              {#if entry.id === layout}
                <span class="tick"><Icon name="check" size={14} /></span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .switcher {
    position: relative;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    height: 2.1rem;
    padding: 0 0.55rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    color: var(--muted);
    font: inherit;
    font-size: 0.74rem;
    cursor: pointer;
    transition:
      border-color 120ms ease,
      color 120ms ease,
      background 120ms ease;
  }

  .trigger:hover,
  .trigger.open {
    border-color: var(--border-strong);
    background: var(--panel-2);
    color: var(--text);
  }

  .label {
    white-space: nowrap;
  }

  .chevron {
    display: inline-flex;
    color: var(--subtle);
    transition: transform 120ms ease;
  }

  .trigger.open .chevron {
    transform: rotate(180deg);
  }

  .menu {
    position: absolute;
    top: calc(100% + 0.4rem);
    right: 0;
    z-index: 60;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    width: min(19.5rem, calc(100vw - 2rem));
    max-height: calc(100vh - 5rem);
    margin: 0;
    padding: 0.45rem;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    box-shadow: var(--shadow-lg);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .section + .section {
    padding-top: 0.4rem;
    border-top: 1px solid var(--border);
  }

  .section-label {
    padding: 0.1rem 0.55rem 0.2rem;
    color: var(--subtle);
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.45rem 0.55rem;
    border: 1px solid transparent;
    border-radius: 8px;
    background: none;
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .option:hover {
    background: var(--panel-2);
  }

  .option.selected {
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
    background: color-mix(in srgb, var(--accent) 9%, transparent);
  }

  .swatches {
    display: grid;
    flex: none;
    grid-template-columns: repeat(2, 0.6rem);
    grid-template-rows: repeat(2, 0.6rem);
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--panel-2);
  }

  .swatches span {
    border-radius: 2px;
  }

  .layout-icon {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 1.45rem;
    height: 1.45rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--panel-2);
    color: var(--muted);
  }

  .option.selected .layout-icon {
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
    color: var(--accent);
  }

  .option-main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.05rem;
    min-width: 0;
  }

  .option-title {
    font-size: 0.8rem;
    font-weight: 600;
  }

  .option-meta {
    color: var(--muted);
    font-size: 0.68rem;
    line-height: 1.35;
  }

  .tick {
    display: inline-flex;
    flex: none;
    color: var(--accent);
  }

  @media (max-width: 720px) {
    .label {
      display: none;
    }

    .trigger {
      padding: 0 0.5rem;
    }
  }
</style>
