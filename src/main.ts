import "./style.css";

import { AppController } from "./app/controller";

/**
 * NORD TRACE — entry point.
 *
 * Turn routes into stories. A NORD LABS instrument.
 * Everything runs locally in this browser: route files are parsed
 * here, visualized here, and never uploaded anywhere.
 */

const app = document.querySelector<HTMLElement>("#app");

if (app) {
  const controller = new AppController(app);
  controller.attachRootDropHandlers();
} else {
  document.body.textContent = "NORD TRACE could not start: missing app root.";
}
