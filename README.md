# NORD TRACE

```text
N O R D   T R A C E
────────────────────────────────────────────
Turn routes into stories.
```

NORD TRACE is an experimental cinematic route-visualization system by NORD LABS.
It treats GPS movement as visual material: position, elevation, velocity, time,
coordinates and geography — composed with the restraint of technical cartography
and the pacing of a cinematic title sequence.

Not a fitness dashboard. Not a map with a line on it. A visual instrument for
routes.

**Status: early development / experimental.** The architecture, APIs and product
direction described here are provisional and will change. See
[Repository status](#repository-status).

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

## Vision

Long-term product direction. **These are roadmap concepts, not current
features** — each lands only when it exists in this repository:

- GPX and GeoJSON trace import
- animated route playback with a cinematic map camera
- altitude and velocity visualization
- telemetry readouts — timestamps, coordinates, route progress
- customizable visual themes
- vertical and social formats alongside cinematic widescreen
- eventual still-image and video output

## Modes

Planned product lenses for different kinds of movement. These are product
concepts, not implemented features.

| Mode | Intent |
| --- | --- |
| **RIDE** | Cycling and road movement — pace, gradient, distance. |
| **WALK** | Photo walks, hikes and urban exploration — slower time, a sense of place. |
| **FLIGHT** | Drone and aviation route visualization — altitude, telemetry, airspace. |
| **JOURNEY** | Longer travel and road-trip traces — narrative over distance. |

## Design language

Deep black surfaces. Off-white typography. Restrained cold-blue accents.
Technical grid systems. Geographic coordinates, topographic lines and thin
telemetry graphics treated as first-class design elements. Typography-led
hierarchy, minimal controls, cinematic motion that feels deliberate and
editorial rather than flashy.

The full direction — surfaces, type, motion principles, do-and-don’t list —
lives in [`docs/design-language.md`](docs/design-language.md).

## Architecture

**Provisional.** Deliberately small until implementation requirements justify
more:

- **TypeScript**, strict mode
- **Vite** as the minimal web foundation
- **MapLibre GL JS** for mapping
- **Three.js**, selectively, where custom 3D or cinematic rendering earns its place
- **Web Workers** if route processing eventually needs them
- local-first, browser-native GPX/GeoJSON parsing where practical

No authentication, database, backend service, analytics or large UI framework —
none are justified at this stage. Rationale and open questions:
[`docs/architecture.md`](docs/architecture.md).

## Repository status

**Early development / experimental.** The licence and documentation are real and
current; the code is a minimal web foundation. APIs, architecture and product
direction may change at any time, without notice or migration.

| State | Items |
| --- | --- |
| Implemented | repository, documentation, licence, minimal Vite + TypeScript foundation |
| Planned | everything in the [roadmap](#roadmap) below |
| Experimental | architecture decisions in [`docs/architecture.md`](docs/architecture.md) |

Nothing else should be assumed to work.

## Roadmap

Directional phases. **No release dates are promised.**

**Phase 0 — Foundation**
Repository, design direction, GPX/GeoJSON file-format research, architecture
experiments.

**Phase 1 — Trace**
GPX import. GeoJSON import. Route normalization. Basic route rendering.
Timeline playback.

**Phase 2 — Motion**
Cinematic camera. Altitude visualization. Speed visualization. Playback
controls. Animation presets.

**Phase 3 — Composition**
Design presets. Typography overlays. Coordinates and timestamps. Aspect-ratio
presets. Social-media composition modes.

**Phase 4 — Export**
Still-image export. Video-rendering experiments. Deterministic visual output.

## Repository layout

```text
nord-trace/
├── docs/
│   ├── vision.md
│   ├── architecture.md
│   └── design-language.md
├── src/
│   ├── main.ts
│   └── style.css
├── index.html
├── package.json
├── tsconfig.json
├── .editorconfig
├── .gitignore
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

Public GitHub repositories remain subject to GitHub’s Terms of Service,
including GitHub’s platform-level viewing and forking permissions.

Commercial and other licensing requests: **info@theo-picture.com**

Full terms: [`LICENSE.md`](LICENSE.md) — ISO NORD CA Commercial & Source-Available
License v1.0 (`LicenseRef-ISO-NORD-CA-1.0`).

## NORD LABS

NORD TRACE is part of NORD LABS, the experimental software and digital-systems
work developed by Théodore Beaupré. NORD TRACE is developed by NORD LABS under
the ISO NORD CA licensing framework.

## Contact

**info@theo-picture.com**
