import { mount } from "svelte";

import App from "./AuthGate.svelte";
import { applyStoredLayout } from "./lib/shell-layout.js";
import { applyStoredTheme } from "./lib/theme.js";
import "./app.css";

applyStoredTheme();
applyStoredLayout();

const target = document.getElementById("app");
if (!target) {
  throw new Error("#app mount point not found");
}

const app = mount(App, { target });

export default app;
