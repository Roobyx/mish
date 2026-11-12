import { mount } from "svelte";

import App from "./AuthGate.svelte";
import { applyStoredTheme } from "./lib/theme.js";
import "./app.css";

applyStoredTheme();

const target = document.getElementById("app");
if (!target) {
  throw new Error("#app mount point not found");
}

const app = mount(App, { target });

export default app;
