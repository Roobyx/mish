<script lang="ts">
  import { onMount } from "svelte";

  import App from "./App.svelte";
  import { errorMessage, getConfig, isUnauthorized, setToken } from "./lib/api.js";

  let phase = $state<"checking" | "login" | "ready">("checking");
  let token = $state("");
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function probe(): Promise<void> {
    try {
      await getConfig();
      phase = "ready";
    } catch (cause) {
      phase = isUnauthorized(cause) ? "login" : "ready";
    }
  }

  onMount(() => {
    void probe();
  });

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    busy = true;
    error = null;
    setToken(token.trim());
    try {
      await getConfig();
      phase = "ready";
    } catch (cause) {
      setToken("");
      error = isUnauthorized(cause) ? "That token was rejected." : errorMessage(cause);
    } finally {
      busy = false;
    }
  }
</script>

{#if phase === "checking"}
  <main class="gate">
    <p class="muted">Connecting to mish…</p>
  </main>
{:else if phase === "login"}
  <main class="gate">
    <form class="card" onsubmit={submit}>
      <h1>mish</h1>
      <p class="muted">This server requires an access token.</p>
      <label>
        <span>Token</span>
        <input type="password" bind:value={token} autocomplete="off" spellcheck="false" />
      </label>
      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}
      <button type="submit" disabled={busy || token.trim().length === 0}>
        {busy ? "Checking…" : "Unlock"}
      </button>
    </form>
  </main>
{:else}
  <App />
{/if}

<style>
  .gate {
    min-height: 100%;
    display: grid;
    place-items: center;
    padding: 1.5rem;
  }

  .card {
    width: min(380px, 100%);
    display: grid;
    gap: 0.9rem;
    padding: 1.4rem;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
  }

  h1 {
    margin: 0;
    font-size: 1.25rem;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    line-height: 1.45;
  }

  label {
    display: grid;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--muted);
  }

  input {
    width: 100%;
    padding: 0.6rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel-2);
    color: var(--text);
    font: inherit;
  }

  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  button {
    padding: 0.65rem 0.8rem;
    border: 0;
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .muted {
    color: var(--muted);
  }

  .error {
    color: var(--err);
    font-size: 0.82rem;
  }
</style>
