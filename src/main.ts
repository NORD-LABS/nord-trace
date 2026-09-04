import "./style.css";

/**
 * NORD TRACE — Phase 0 foundation shell.
 *
 * This is intentionally minimal: the identity and status surface for the
 * repository while the real product (trace import, rendering, playback) is
 * built in later phases. See docs/architecture.md.
 */

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <main class="stage">
      <header class="masthead">
        <p class="kicker">NORD LABS</p>
        <h1 class="wordmark">NORD&nbsp;TRACE</h1>
        <p class="tagline">Turn routes into stories.</p>
      </header>

      <section class="status" aria-label="Project status">
        <p class="status-line">PHASE 0 — FOUNDATION</p>
        <p class="status-note">
          Cinematic route visualization for GPS traces. Early development:
          route import, rendering and playback are not implemented yet.
        </p>
      </section>

      <footer class="baseline">
        <p>
          © 2026 Théodore Beaupré, operating as ISO NORD CA — proprietary,
          source-available software.
        </p>
      </footer>
    </main>
  `;
}
