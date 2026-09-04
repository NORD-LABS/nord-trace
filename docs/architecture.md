# NORD TRACE — Architecture

> **Provisional.** Nothing in this document is a commitment. The stack and
> layout below are the current best small starting point; they will be revised
> as Phase 0 experiments produce evidence.

## Guiding principles

1. **Local-first.** Route parsing and processing happen in the browser wherever
   practical. A user’s GPS traces are personal data; they should not need a
   server to become a visualization.
2. **Minimal dependency surface.** Every dependency is a licensing, supply-chain
   and maintenance liability for a proprietary project. Add one only when
   hand-rolling is clearly worse.
3. **Strict TypeScript.** The trace model is the product’s spine; it should be
   typed precisely and validated at the boundary (file input), never mutated
   ad hoc downstream.
4. **Rendering is the core problem.** Cinematic map camera work, overlay
   typography and eventual video output dominate the technical risk. Everything
   else is plumbing.
5. **No backend at this stage.** No authentication, database, payments or
   analytics. None are justified before there is a product to protect or meter.

## Proposed stack

| Layer | Choice | Status |
| --- | --- | --- |
| Language | TypeScript (strict) | in place |
| Build / dev server | Vite | in place |
| Mapping | MapLibre GL JS | planned |
| 3D / cinematic rendering | Three.js, selectively | planned |
| Heavy parsing / processing | Web Workers, if needed | future |
| Backend | none | intentional |

Notes:

- **MapLibre GL JS** is BSD-2-licensed, styleable down to the dark technical
  cartography NORD TRACE wants, and supports custom layers — the likely bridge
  to Three.js content. The basemap *style and tile source* are an open question
  with licensing implications (see below).
- **Three.js** is for the parts a map engine cannot do: abstract camera moves,
  altitude sculpture, non-geographic composition. It is not automatically in
  the hot path for every view.
- Parsing GPX/GeoJSON is XML/JSON + geometry math — genuinely feasible with
  browser-native APIs and a small amount of code. A dedicated parsing library
  would need to earn its place.

## Proposed module layout

Future structure, once Phase 1 begins. Not present today beyond the minimal
foundation.

```text
src/
├── core/          # trace model, normalization, statistics (distance, gain)
├── parsers/       # gpx.ts, geojson.ts — boundary validation, browser-native
├── geo/           # projection helpers, bounds, interpolation
├── render/        # map layer, 3d layer, overlays, themes
├── playback/      # timeline, camera choreography, easing, presets
├── composition/   # typography overlays, aspect ratios, title cards
└── export/        # still frames, video experiments
```

Data flow, conceptually:

```text
file → parse → normalize → TraceModel → render / playback → composition → export
```

The `TraceModel` is the single source of truth: geometry, time (optional per
point), elevation (optional), and derived statistics — computed once,
read everywhere.

## Open questions (Phase 0 research)

- **Basemap style and tiles.** Which raster/vector source is licensing-clean
  for a proprietary product, renders beautifully dark, and works keyless or
  self-hosted? Candidates include OpenFreeMap, Protomaps and self-hosted
  tilesets. This decision is licensing-sensitive, not just aesthetic.
- **GPX edge cases.** Multiple `<trkseg>`, pauses and gaps, missing timestamps
  or elevation, waypoints vs. tracks, clock skew. Normalization rules need to
  be explicit and testable.
- **Time model.** Some traces have no timestamps; some users want scaled time
  (a 6-hour ride in 30 seconds). The model must treat time as optional and
  playback time as distinct from recorded time.
- **Export path.** Deterministic stills point toward canvas capture from a
  fixed seed and camera state. Video is harder: `MediaRecorder` capture vs.
  frame-by-frame offscreen rendering. Browser-first is the bias; nothing is
  decided.
- **Worker boundaries.** Parsing and statistics move to a worker only when a
  real trace size justifies the plumbing.
- **When Three.js, when not.** Evaluate per feature; MapLibre custom layers may
  cover more than expected.

## Rejected for now

React/Vue/Svelte and large UI frameworks — the interface is bespoke and
rendering-driven; a framework adds weight without solving the actual problem.
Node-based processing — breaks local-first for no current gain. Any backend
service — see principles.
