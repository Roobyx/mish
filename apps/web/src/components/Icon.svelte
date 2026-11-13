<script lang="ts">
  import type { IconName } from "../lib/icons.js";

  interface Props {
    name: IconName;
    size?: number;
    stroke?: number;
    class?: string;
  }

  let { name, size = 16, stroke = 2, class: className = "" }: Props = $props();
</script>

<svg
  class={className}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  {#if name === "plus"}
    <path d="M12 5v14M5 12h14" />
  {:else if name === "settings"}
    <path
      d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
    />
    <circle cx="12" cy="12" r="3" />
  {:else if name === "search"}
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  {:else if name === "chevron-down"}
    <path d="m6 9 6 6 6-6" />
  {:else if name === "chevron-up"}
    <path d="m18 15-6-6-6 6" />
  {:else if name === "check"}
    <path d="M20 6 9 17l-5-5" />
  {:else if name === "check-circle"}
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <path d="m9 11 3 3L22 4" />
  {:else if name === "loader"}
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  {:else if name === "clock"}
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  {:else if name === "x-circle"}
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6M9 9l6 6" />
  {:else if name === "ban"}
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  {:else if name === "hard-drive"}
    <path d="M22 12H2" />
    <path
      d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
    />
    <path d="M6 16h.01M10 16h.01" />
  {:else if name === "server"}
    <rect x="2" y="2" width="20" height="8" rx="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" />
    <path d="M6 6h.01M6 18h.01" />
  {:else if name === "trash"}
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6M14 11v6" />
  {:else if name === "download"}
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5M12 15V3" />
  {:else if name === "upload"}
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 8 5-5 5 5M12 3v12" />
  {:else if name === "refresh"}
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  {:else if name === "folder"}
    <path
      d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
    />
  {:else if name === "scan"}
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
  {:else if name === "pie-chart"}
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
    <path d="M22 12A10 10 0 0 0 12 2v10z" />
  {:else if name === "file"}
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
  {:else if name === "plug"}
    <path d="M12 22v-5M9 8V2M15 8V2M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
  {:else if name === "shield"}
    <path
      d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
    />
  {:else if name === "thermometer"}
    <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
  {:else if name === "chevron-left"}
    <path d="m15 18-6-6 6-6" />
  {:else if name === "chevron-right"}
    <path d="m9 18 6-6-6-6" />
  {:else if name === "x"}
    <path d="M18 6 6 18M6 6l12 12" />
  {:else if name === "menu"}
    <path d="M4 6h16M4 12h16M4 18h16" />
  {:else if name === "list"}
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  {:else if name === "box"}
    <path d="m21 8-9-5-9 5v8l9 5 9-5V8Z" />
    <path d="m3 8 9 5 9-5M12 13v8" />
  {:else if name === "copy"}
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  {:else if name === "treemap"}
    <rect x="3" y="3" width="8" height="8" rx="1" />
    <rect x="13" y="3" width="8" height="5" rx="1" />
    <rect x="13" y="10" width="8" height="11" rx="1" />
    <rect x="3" y="13" width="8" height="8" rx="1" />
  {:else if name === "layers"}
    <path d="m12 2 9 5-9 5-9-5 9-5Z" />
    <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
  {:else if name === "bubbles"}
    <circle cx="8" cy="8" r="4" />
    <circle cx="17" cy="7" r="3" />
    <circle cx="15" cy="16" r="5" />
    <circle cx="6" cy="17" r="2" />
  {:else if name === "bar-chart"}
    <path d="M3 3v18h18" />
    <path d="M7 17v-4M12 17V8M17 17v-6" />
  {:else if name === "activity"}
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  {:else if name === "grid"}
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  {:else if name === "users"}
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  {:else if name === "git-compare"}
    <circle cx="6" cy="6" r="3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7M11 18H8a2 2 0 0 1-2-2V9" />
  {:else if name === "calendar"}
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  {:else if name === "palette"}
    <path
      d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2 2 2 0 0 1 2-2h2a4 4 0 0 0 4-4 10 10 0 0 0-10-10Z"
    />
    <circle cx="13.5" cy="6.5" r=".5" />
    <circle cx="17.5" cy="10.5" r=".5" />
    <circle cx="8.5" cy="7.5" r=".5" />
    <circle cx="6.5" cy="12.5" r=".5" />
  {:else if name === "info"}
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  {:else if name === "alert-triangle"}
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4M12 17h.01" />
  {/if}
</svg>
