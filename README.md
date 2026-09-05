# NORD TRACE

```text
N O R D   T R A C E
────────────────────────────────────────────
Turn routes into stories.
```

NORD TRACE is a cinematic route-visualization instrument by NORD LABS.
It treats GPS movement as visual material: position, elevation, velocity, time,
coordinates and geography — composed with the restraint of technical cartography
and the pacing of a cinematic title sequence.

Not a fitness dashboard. Not a map with a line on it. A visual instrument for
routes.

**Status: V1.** The core experience is implemented, tested and verified in the
browser: import a trace, see it on a dark cinematic map, inspect its statistics,
play it, scrub it, change camera and presentation modes, present fullscreen and
export a still. See [V1](#v1).

---

## Concept

Routes usually end up as static lines drawn over generic maps — an afterthought
behind the data.

NORD TRACE starts from the opposite premise: the movement itself is the visual
material. A trace already carries position, altitude, speed, timestamps and
geography. Those signals can be composed — the way a title sequence composes
type and motion — into something that reads as a story of the route rather than
a record of it.

The intent is a premium creative instrument for people who move with a GPS
logger and care about how that movement is presented: cyclists, hikers, photo
walkers, drone pilots, travellers.

## V1

Implemented and verified (typechecked, unit-tested, exercised in a real
browser at desktop and mobile sizes):

- **GPX import** — `<trk>/<trkseg>/<trkpt>` with optional elevation and
  timestamps, multiple segments, `<rtept>` fallback; malformed XML, empty
  tracks and missing metadata fail cleanly, never crash.
- **GeoJSON import** — LineString, MultiLineString, Feature and
  FeatureCollection; polygons and non-route geometries are rejected cleanly;
  names read from `name`/`title` properties.
- **Local processing** — files are read and parsed entirely in the browser.
  Nothing is uploaded; there is no server, account or telemetry.
- **Route visualization** — a bespoke dark vector style over
  [OpenFreeMap](https://openfreemap.org) tiles (keyless, CORS-open; attribution
  preserved on screen and in exports). Thin cold-white base trace, brighter
  animated progress stroke, restrained glow, direction chevrons, ringed
  endpoint markers.
- **Route statistics** — geodesic distance, recorded duration, min/max
  elevation, noise-resistant ascent/descent, average speed, bounds. Statistics
  the data cannot support simply don't appear.
- **Animated playback** — single-source-of-truth engine at 0.5×–8×, with
  recorded-time progress when timestamps exist and distance-based progress
  when they don't.
- **Timeline scrubbing** — native range input under a custom hairline;
  pointer, touch and keyboard operable; live telemetry follows.
- **Camera modes** — OVERVIEW (full-route frame), FOLLOW (damped tracking),
  CINEMATIC (slow bearing drift + mid-route zoom arc). Reduced-motion users
  get pan-only, never rotation.
- **Presentation modes** — RIDE, WALK, FLIGHT, JOURNEY presets changing
  pacing, camera default, telemetry emphasis and route treatment. FLIGHT
  carries a "visualization only — not for navigation" disclaimer.
- **Elevation profile** — a restrained SVG area profile with a playback
  cursor, shown only when the trace carries elevation.
- **Cinematic presentation** — fullscreen mode hiding all chrome, subtle
  transport on hover, Escape to exit.
- **Still export** — current composition as a 16:9, 9:16 or 1:1 PNG,
  composited client-side with route overlay, typography and required map
  attribution. Verified working.
- **Demo trace** — a deterministic, repository-generated synthetic route
  (`LOAD DEMO`); no claim that it represents a real journey.
- **Responsive interface** — desktop through mobile (verified at 1440 and
  390 px), no horizontal overflow, touch-friendly controls.
- **Accessibility** — semantic buttons, labeled controls, keyboard playback
  (Space/R/F/E/M/C), visible focus states, `prefers-reduced-motion` support.

Not yet (future work — see [Roadmap](#roadmap)):

- **Video export** — not implemented. The render path (normalized progress →
  sample → frame state) is already a pure function, which is the groundwork
  deterministic frame-by-frame video rendering will need. MediaRecorder
  capture is deliberately not shipped as a unreliable stopgap.
- Visual themes, typography overlays, aspect-ratio composition frames,
  user-audio timing workflows.

## Modes

Product lenses over the same engine — presentation only, route data is never
mutated:

| Mode | Intent |
| --- | --- |
| **RIDE** | Cycling and road movement — pace, gradient, distance. |
| **WALK** | Photo walks, hikes and urban exploration — slower time, a sense of place. |
| **FLIGHT** | Drone and aviation route visualization — altitude, telemetry, airspace. *Visualization only — not for navigation.* |
| **JOURNEY** | Longer travel and road-trip traces — narrative over distance. |

## Design language

Deep black surfaces. Off-white typography. Restrained cold-blue accents.
Technical grid systems. Geographic coordinates, thin telemetry graphics and
hairline rules treated as first-class design elements. Typography-led
hierarchy, minimal controls, cinematic motion that feels deliberate and
editorial rather than flashy.

The full system — palette, type, spacing, controls, motion, camera behavior,
mobile adaptation — lives in
[`docs/design-language.md`](docs/design-language.md).

## Architecture

TypeScript (strict), Vite, browser-first, no backend, no framework.

- **MapLibre GL JS** (lazy-loaded; ~19 kB gzip of app code before the map
  chunk is fetched) rendering a custom OpenMapTiles-schema dark style
- **Vanilla DOM** UI — no React, no component library
- **Web Workers**: not needed at V1 trace sizes; module boundary is ready
- Local-first GPX/GeoJSON parsing with `DOMParser`/`JSON.parse`

Data flow: `file → parse → normalize → Trace (immutable) → playback + map +
UI`, with playback progress owned by a single engine and consumed by
everything else. Rationale, trace model, performance strategy and known
limitations: [`docs/architecture.md`](docs/architecture.md).

## Privacy

Route files are processed locally in your browser and are never uploaded.
There is no account, no database, no analytics, no server-side anything. The
only network requests are map tiles from OpenFreeMap (keyless public
infrastructure) and fonts/sprites referenced by the map style.

## Repository status

| State | Items |
| --- | --- |
| Implemented | V1 experience (see [V1](#v1)), documentation, licence |
| Planned | video export, themes, composition overlays (see [Roadmap](#roadmap)) |
| Experimental | mode tuning, camera pacing constants |

## Roadmap

Directional phases. **No release dates are promised.**

**Phase 2 — Motion** (current)
Camera choreography refinements. Altitude/speed-driven visual treatments.
Mode tuning from real traces.

**Phase 3 — Composition**
Typography overlays. Coordinates/timestamps as composed elements.
Aspect-ratio frames. Social formats as reframed compositions.

**Phase 4 — Export**
Deterministic still rendering at fixed seeds/frames. Video-rendering
experiments building on the pure render path.

## Development

```bash
npm install
npm run dev        # dev server
npm run build      # typecheck + production build
npm run preview    # serve the production build
npm test           # vitest suite (90 tests)
npm run typecheck  # tsc --noEmit
```

CI (`.github/workflows/ci.yml`) runs typecheck, tests and the production
build on every push and pull request.

## Repository layout

```text
nord-trace/
├── docs/
│   ├── vision.md
│   ├── architecture.md
│   └── design-language.md
├── src/
│   ├── app/          # controller, state, file ingestion
│   ├── core/         # trace model, geodesic math, sampling, formatters
│   ├── demo/         # deterministic synthetic demo trace
│   ├── export/       # still composition export
│   ├── geojson/      # GeoJSON parsing/normalization
│   ├── gpx/          # GPX parsing
│   ├── map/          # MapLibre runtime, style, trace layers, camera, markers
│   ├── modes/        # product mode presets
│   ├── playback/     # playback engine (single source of truth)
│   ├── ui/           # landing, workspace, telemetry, transport, settings
│   ├── main.ts
│   └── style.css     # the design system
├── tests/            # vitest: parsers, geo math, playback, formatters
├── index.html
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .github/workflows/ci.yml
├── CONTRIBUTING.md
├── LICENSE.md
└── SECURITY.md
```

## Licensing

**Proprietary Source-Available Software**

Copyright © 2026 Théodore Beaupré, operating as ISO NORD CA. All rights
reserved.

This repository is publicly visible for limited viewing and evaluation. It is
**not open source**.

No permission is granted to use, copy, modify, distribute, deploy, sell,
sublicense, reverse engineer, scrape, or use this repository for
artificial-intelligence or machine-learning training except where expressly
authorized in writing by ISO NORD CA or unavoidably permitted by applicable law.

Public GitHub repositories remain subject to GitHub's Terms of Service,
including GitHub's platform-level viewing and forking permissions.

Commercial and other licensing requests: **info@theo-picture.com**

Full terms: [`LICENSE.md`](LICENSE.md) — ISO NORD CA Commercial & Source-Available
License v1.0 (`LicenseRef-ISO-NORD-CA-1.0`).

## NORD LABS

NORD TRACE is part of NORD LABS, the experimental software and digital-systems
work developed by Théodore Beaupré. NORD TRACE is developed by NORD LABS under
the ISO NORD CA licensing framework.

## Contact

**info@theo-picture.com**
