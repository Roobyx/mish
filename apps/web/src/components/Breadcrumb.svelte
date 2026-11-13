<script lang="ts">
  import { breadcrumbItems, type Crumb } from "../lib/breadcrumb.js";

  interface Props {
    path: Crumb[];
    onnavigate: (index: number) => void;
  }

  let { path, onnavigate }: Props = $props();

  const items = $derived(breadcrumbItems(path));
</script>

<nav aria-label="Breadcrumb">
  {#each items as item (item.kind === "gap" ? "gap" : item.crumb.id)}
    {#if item.kind === "gap"}
      <span class="sep" aria-hidden="true">/</span>
      <span class="gap" title={item.hidden} aria-hidden="true">…</span>
    {:else}
      {#if item.index > 0}<span class="sep" aria-hidden="true">/</span>{/if}
      {#if item.current}
        <span class="current" title={item.crumb.name}>{item.crumb.name}</span>
      {:else}
        <button type="button" onclick={() => onnavigate(item.index)} title={item.crumb.name}>
          {item.crumb.name}
        </button>
      {/if}
    {/if}
  {/each}
</nav>

<style>
  nav {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
    overflow: hidden;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  button {
    flex: 0 2 auto;
    min-width: 0;
    max-width: 12rem;
    padding: 0.1rem 0.15rem;
    overflow: hidden;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--accent);
    font: inherit;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  button:hover {
    background: var(--panel-2);
  }

  .current {
    flex: 0 0 auto;
    min-width: 0;
    max-width: min(20rem, 45vw);
    overflow: hidden;
    color: var(--text);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gap {
    flex: none;
    padding: 0 0.1rem;
    color: var(--muted);
  }

  .sep {
    flex: none;
    color: var(--muted);
  }

  @container (max-width: 26rem) {
    nav > :not(:nth-last-child(-n + 3)) {
      display: none;
    }

    .current {
      max-width: calc(100% - 2rem);
    }
  }

  @container (max-width: 12rem) {
    nav > :not(:last-child) {
      display: none;
    }

    .current {
      max-width: 100%;
    }
  }
</style>
