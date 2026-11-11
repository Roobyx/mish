import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Coolify serves the app under /app behind NetBird and passes MISH_WEB_BASE=/app/
// to the image build. Standalone builds keep the root base.
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const base = env?.MISH_WEB_BASE?.trim() || "/";

export default defineConfig({
  base,
  plugins: [svelte()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:9543",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
