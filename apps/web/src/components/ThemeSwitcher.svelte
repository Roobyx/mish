<script lang="ts">
  import { onMount } from "svelte";

  import { THEMES, themeById, type ThemeId } from "../lib/theme.js";

  import Icon from "./Icon.svelte";

  interface Props {
    theme: ThemeId;
    onselect: (id: ThemeId) => void;
  }

  let { theme, onselect }: Props = $props();

  let open = $state(false);
  let host = $state<HTMLDivElement | null>(null);

  const current = $derived(themeById(theme));

  function choose(id: ThemeId): void {
    open = false;
    onselect(id);
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
    aria-haspopup="listbox"
    aria-expanded={open}
    title="Colour theme"
    onclick={() => (open = !open)}
  >
    <Icon name="palette" size={15} />
    <span class="label">{current.name}</span>
    <span class="chevron"><Icon name="chevron-down" size={13} /></span>
  </button>

  {#if open}
    <ul class="menu" role="listbox" aria-label="Colour theme">
      {#each THEMES as entry (entry.id)}
        <li role="presentation">
          <button
            type="button"
            class="option"
            class:selected={entry.id === theme}
            role="option"
            aria-selected={entry.id === theme}
            onclick={() => choose(entry.id)}
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
    gap: 0.15rem;
    width: min(19rem, calc(100vw - 2rem));
    margin: 0;
    padding: 0.35rem;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    box-shadow: var(--shadow-lg);
    list-style: none;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.5rem 0.55rem;
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
