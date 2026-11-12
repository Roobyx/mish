<script lang="ts">
  interface Props {
    size?: number;
    class?: string;
  }

  let { size = 28, class: className = "" }: Props = $props();
</script>

<svg
  class={className}
  width={size}
  height={size}
  viewBox="0 0 64 64"
  role="img"
  aria-label="Mish logo"
>
  <rect width="64" height="64" rx="14" fill="var(--logo-bg, #151517)" />
  <rect x="12" y="12" width="24" height="40" rx="4" fill="var(--accent)" />
  <rect x="40" y="12" width="12" height="18" rx="3" fill="var(--ok)" />
  <rect x="40" y="34" width="12" height="18" rx="3" fill="var(--warn)" />
</svg>
