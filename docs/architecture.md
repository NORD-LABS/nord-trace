# NORD TRACE — Architecture

> V1. This document describes the system as actually implemented on the
> `feat/nord-trace-v1` branch: modules, data flow, rendering strategy,
> performance decisions and known limitations.

## Guiding principles

1. **Local-first.** Route parsing and processing happen entirely in the
   browser. A user's GPS traces are personal data; they never leave the
   machine. There is no backend to disable.
2. **Minimal dependency surface.** Two runtime dependencies exist: MapLibre GL
   JS (BSD-2) and nothing else. Every other line is hand-rolled, typed and
   tested — parsing, geodesy, playback, UI.
3. **Strict TypeScript.** The trace model is the product's spine. `strict`,
   `noUncheckedLocals`/`Parameters`, no `any`, no `@ts-ignore`.
4. **Rendering is the core problem.** Camera choreography, the reveal
   primitive and export compositing got the engineering time; everything else
   is deliberately boring.
5. **No framework.** The interface is bespoke and rendering-driven; React et
   al. would add weight without solving any actual problem. Vanilla DOM with
   small view classes keeps the whole UI legible.

## Stack

| Layer | Choice | Status |
| --- | --- | --- |
| Language | TypeScript 5.9 (strict) | in place |
| Build / dev server | Vite 7 | in place |
| Mapping | MapLibre GL JS 5.x, lazy-loaded | in place |
| Tests | Vitest 5 + happy-dom | in place |
| UI framework | none — vanilla DOM | intentional |
| Backend | none | intentional |

`package.json` stays `"private": true, "license": "UNLICENSED"` (the
project licence is `LicenseRef-ISO-NORD-CA-1.0`, see `LICENSE.md`).

## Module layout

```text
src/
├── app/          controller.ts (orchestration), state.ts (store), import.ts (file boundary)
├── core/         types.ts, geodesic.ts, build.ts (normalization + stats), sample.ts, formatters.ts, errors.ts
├── gpx/          parser.ts
├── geojson/      parser.ts
├── playback/     engine.ts — the single source of truth for progress
├── map/          traceMap.ts (runtime), style.ts (cartography), traceLayers.ts (trace rendering),
│                 camera.ts (rig), markers.ts, maplibreLoader.ts (lazy import)
├── modes/        modes.ts — RIDE/WALK/FLIGHT/JOURNEY presets
├── ui/           landingView, workspaceView, telemetry, transport, settingsPanel,
│                 elevationProfile, emptyBackground, toast, icons
├── export/       stillExport.ts
└── demo/         demoTrace.ts — deterministic synthetic route
```

## Trace data model

```ts
interface TracePoint {
  lat: number; lon: number;
  elevation: number | null;   // metres, absent stays null
  time: number | null;        // epoch ms, absent stays null
  distanceFromStart: number;  // cumulative geodesic metres
}

interface Trace {
  name: string;
  points: readonly TracePoint[];
  times: readonly number[] | null;  // cumulative recorded seconds, clamped monotonic
  stats: TraceStats;                // computed once, read-only
  sourceFormat: 'gpx' | 'geojson' | 'demo';
}
```

The `Trace` is immutable after construction. Playback, camera, UI and export
are all pure readers. `TraceStats` carries honest nulls: a statistic the data
cannot support does not exist (no fabricated zeros).

### Normalization (`core/build.ts`)

- Consecutive points closer than 0.5 m are collapsed (stationary GPS jitter);
  the freshest elevation/time wins.
- Timestamps are never trusted blindly: deltas are clamped to a monotonic
  curve bounded by 4× the median sampling step, so a GPS outage or a clock
  jump becomes a pause instead of a 3-hour sprint. Median steps below 0.1 s
  are treated as clock noise and disable time playback.
- Elevation totals use a noise threshold of max(1 m, 2 % of the elevation
  range): sensor jitter is not climbed.
- A recording pause longer than 5 minutes increments `segmentCount`.
- Distance is geodesic (haversine on a mean-Earth sphere, R = 6 371 008.8 m),
  never Cartesian lat/lon.

## Parsers

**GPX** (`gpx/parser.ts`): `DOMParser` on `application/xml`, `parsererror`
detection, `getElementsByTagName` lookups (qualified-name matching behaves
identically across browsers and DOM emulations, unlike
`getElementsByTagNameNS('*')` which is not portable). Reads
`trk > trkseg > trkpt` with optional `ele`/`time`; falls back to `rte > rtept`;
waypoints are not routes. Names: first `trk > name`, then `rte > name`,
then `metadata > name`, then file name. All file-derived text is treated as
untrusted: it is rendered exclusively via `textContent`, never HTML.

**GeoJSON** (`geojson/parser.ts`): recursive walk over FeatureCollection /
Feature / GeometryCollection collecting LineString and MultiLineString (≥ 2
positions). Polygons, points and unknown types are skipped explicitly — a
polygon is never reinterpreted as a route. Positions are `[lon, lat]` and
validated; `[2]` becomes elevation when numeric. Names from
`properties.name|title` (Feature, then first named feature).

**Ingestion** (`app/import.ts`): extension sniffing (`.gpx`, `.geojson`,
`.json`), 40 MB ceiling, content sniffing for mislabeled files, and
normalization of every failure into `TraceInputError` with a
user-presentable message and a machine kind (`empty`, `unsupported`,
`malformed`, `too-large`, `no-route`).

## Playback model

`playback/engine.ts` owns normalized progress:

- `fraction ∈ [0,1]` advanced by `requestAnimationFrame` against a
  visualization duration (RIDE 60 s, WALK 90 s, FLIGHT 75 s, JOURNEY 120 s).
  Recorded duration is display metadata only — a 6-hour ride and a 20-minute
  walk both get a title-sequence-length animation.
- Frame deltas are clamped to 1 s so tab suspension cannot teleport the
  playhead.
- `play / pause / toggle / restart / seek / setSpeed (0.5–8×) / setDuration`.
  Seek and mode changes preserve fraction; `setDuration` re-times without
  losing position.
- State machine: `idle → playing ⇄ paused → completed → (play) → playing`;
  `onTick/onComplete/onStateChange` are the only outputs.

`core/sample.ts` maps `fraction → TraceSample` (position, elevation, time,
speed, heading, segment index) with binary search over the monotonic basis
array (`times` when present, otherwise `distanceFromStart`) and linear
interpolation. Scrubbing a 10 000-point trace is a binary search + one
allocation per frame.

## Map and rendering

**Style** (`map/style.ts`): a bespoke StyleSpecification over the
OpenMapTiles schema — not a stock dark theme. Land reads near-black
(`#050607`), water a colder black with a faint shoreline, roads a hierarchy
of hairlines, buildings one step above ground, labels sparse uppercase
Noto Sans with dark halos. The trace is always the brightest element.

**Tiles: OpenFreeMap** (public instance). Chosen for licensing and technical
fit: free without keys or registration, no view limits, explicitly permits
commercial use, MIT-licensed infrastructure, CORS-open (`access-control-allow-origin: *`),
OpenMapTiles schema served as vector tiles. Attribution (OpenMapTiles /
OpenStreetMap) is mandatory and preserved: MapLibre's attribution control on
screen, baked into every still export. No API key exists in the repository.

**Trace layers** (`map/traceLayers.ts`): four line layers built once per
trace — glow (blurred cold-blue), casing (black), base (thin off-white),
progress (bright off-white) — plus a direction-chevron symbol layer
(canvas-registered `tick-chev` image). Playback mutates exactly one thing:
the progress GeoJSON source receives the coordinate prefix up to the current
index, only when the rounded index changes. No layer rebuilds, no per-frame
source recreation, no DOM nodes per point.

The container is observed with a `ResizeObserver`; the canvas must not be
allowed to initialize at zero height (see known limitations for the bug this
fixed).

**Camera** (`map/camera.ts`): OVERVIEW frames the route bounds (fitBounds,
responsive padding). FOLLOW rides the point directly after one eased
settle-in (`easeTo` 900 ms; per-tick `setCenter` — the tick loop is the
tween). CINEMATIC adds a damped bearing drift toward travel direction
(0.012 smoothing on the target bearing, 0.06 per-tick map approach — bounded,
never violent) and a mid-route zoom arc (14.6 → ~11.8 → back, weighted to
skip the first and last 4–8 % of playback). `prefers-reduced-motion`
collapses both modes to gentle pan-only tracking (4 % center-lerp), never
rotation; the landing animation freezes at a composed frame.

**Markers** (`map/markers.ts`): ringed dots for start/end, a bright current
position dot with a soft pulse while playing. DOM elements over the map.

## UI structure

`app/state.ts` is a tiny explicit store (immutable patches, subscribers) for
mode, camera, speed, settings and presentation flags. Playback progress is
**not** in the store — the engine is its single source of truth, and the
controller fans engine ticks out to transport, telemetry, HUD, elevation
cursor and map. No component invents its own progress.

Views are classes building real DOM (`createElement` + `textContent` for all
file-derived strings). The timeline is a native `<input type="range">`
(0–1000) under a styled hairline: keyboard arrows, Home/End, touch and
screen readers work for free. Keyboard shortcuts (Space/R/F/E/M/C, Escape)
are bound at document level and skip typing targets.

**Elevation profile**: an SVG polygon+polyline binned to 140 columns by
distance, a hairline cursor tracking progress. Rendered only when the trace
carries elevation; hidden otherwise (never a fake axis).

**Errors**: one toast region, `aria-live`, `textContent` only. All parser and
ingestion failures surface as short human sentences; no `alert()`, no stack
traces.

## Still export

`export/stillExport.ts` composites client-side: the MapLibre canvas is
created with `canvasContextAttributes: { preserveDrawingBuffer: true }`, the
frame is cover-cropped into the target aspect (16:9 / 9:16 / 1:1 at 1920 px
long edge), a vignette is applied, then glow/base/progress passes and the
markers are redrawn in 2D over the frame using `map.project` scaled by the
canvas buffer ratio. Typography (trace name, coordinates, distance,
progress) and the mandatory attribution line are drawn last. Output is a PNG
blob downloaded as `nord-trace_<slug>_<aspect>_<date>.png`.

OpenFreeMap tiles are CORS-enabled, so the WebGL buffer is not tainted and
no server-side rendering is involved. Verified in-browser (desktop 16:9 and
mobile 9:16).

**Video export is not implemented.** The render path — progress fraction →
sample → (camera state, layer state, telemetry) — is already a pure function
of inputs, which is the groundwork deterministic frame-by-frame video
rendering needs. `MediaRecorder` capture was deliberately not shipped as an
unreliable stopgap.

## Local-first design

No account, no database, no analytics, no server component. Route bytes are
read with `file.text()` and stay in memory. The only network traffic is
map tiles, fonts and sprites from OpenFreeMap infrastructure. The landing
says so in one line: "Processed locally in your browser."

## Performance strategy

- **Lazy MapLibre**: `maplibreLoader.ts` dynamic-imports the library and its
  CSS on first trace load. Production build: **60.7 kB (19.2 kB gzip) app
  entry**, MapLibre as a separate 1 053 kB (284.7 kB gzip) chunk fetched only
  when a trace is loaded. Landing is therefore fast even on weak networks.
- **One normalized model**: parsing and statistics run once at import;
  playback is array math.
- **Per-frame cost**: one binary search + one interpolated sample + one
  `GeoJSONSource.setData` of a coordinate prefix (only when the index
  advances). Tested with the 241-point demo; the structure is flat-array and
  index-based precisely so 10⁴-point traces behave the same.
- **No animation of DOM nodes**: the trace lives in GPU-composited map
  layers; markers are three elements.
- **Fonts**: system stack for UI (no webfont download); glyph rendering for
  map labels uses OpenFreeMap's served Noto Sans PBF ranges.

## Known limitations

- **Speed readouts** derive from clamped recorded time; traces with GPS
  outages show pauses at outage positions rather than interpolated motion
  (correct, but visible as a stall).
- **Cinematic bearing** follows segment bearing; switchback-heavy traces
  produce gentle oscillation by design (bounded damping prevents whip).
- **Still export** letterbox-crops the live viewport; the composition uses
  the current camera, so a badly framed viewport exports badly framed.
- **Zero-height map init**: MapLibre's own `.maplibregl-map { position:
  relative }` rule outranks a single-class rule and collapses the container
  before the stylesheet cascade settles; the container rule uses two-class
  specificity plus a `ResizeObserver` to guarantee correct sizing. Any new
  map host element must keep `absolute` positioning inside `.nt-stage`.
- **Workers**: not used; parsing a pathological >40 MB file blocks the main
  thread for a moment before the size gate rejects it. The module boundary
  (`importTraceFile`) is where a worker would slot in.
- MapLibre is pinned to 5.x: the 6.x worker bundle breaks under Vite's
  ESM worker handling (`importScripts` in a module worker), observed as a
  fully black map with style resources loading fine.

## Verification

- `npm run typecheck` — strict, clean.
- `npm test` — 90 unit tests (geodesy, normalization, GPX, GeoJSON,
  playback engine, sampler, formatters).
- `npm run build` — production bundle, sizes above.
- Browser QA: headless Chromium against the production build — landing,
  demo load, play/pause, scrub, speeds, camera modes, product modes,
  FLIGHT disclaimer, presentation, still export (desktop + mobile),
  malformed-input toasts, no-elevation GeoJSON handling, 1440 px and
  390 px layouts, zero uncaught page errors.
