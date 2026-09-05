# NORD TRACE — Design Language

> The V1 system as built. Values below are the working defaults shipped in
> `src/style.css` and `src/map/style.ts` — they are the source of truth, not
> an aspiration. The governing feel remains: technical cartography,
> aviation-interface restraint, editorial typography, cinematic pacing.

## Foundations

**Surfaces.** Deep black and near-black only. The map is the hero; chrome
disappears into it. Panels float on near-black with hairline borders — no
card grids, no shadows-on-white dashboard chrome.

```css
--nt-bg:            #050607;   /* app ground, map background */
--nt-surface:       #0a0b0d;
--nt-surface-raised:#101216;   /* panels, toasts */
--nt-hairline:      rgba(232, 230, 223, 0.14);
--nt-hairline-soft: rgba(232, 230, 223, 0.07);
```

**Ink.** Off-white, never pure white as body text — pure white on black
vibrates. Pure white is reserved for the trace, the playhead and the
current-position dot.

```css
--nt-ink:       #f2f1ec;
--nt-ink-dim:   #8a8f98;
--nt-ink-faint: #565b63;
```

**Accent.** One cold blue, used sparingly — the mode voice, focus rings,
switch state, the glow beneath the trace. If accent appears everywhere, it
means nothing.

```css
--nt-accent:      #6f8fa8;
--nt-accent-soft: rgba(111, 143, 168, 0.35);
--nt-trace:       #f2f1ec;   /* route stroke */
--nt-trace-ember: #8fb2ce;   /* glow */
```

**Grid.** A faint technical grid grounds the landing (5 % hairlines, 72 px
cells). Corner ticks frame the map stage — restrained HUD, never sci-fi
kitsch.

## Typography

System stack, no webfont licensing questions:

```css
--nt-font: "Inter", "SF Pro Text", -apple-system, "Helvetica Neue",
           "Segoe UI", Arial, sans-serif;
--nt-font-mono: ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono",
                Menlo, monospace;
```

- **Wordmark/headings**: heavy weight, wide tracking (`0.16em`), tracked
  caps optically recentered with `text-indent`.
- **Section labels**: 9 px, `0.28em` tracking, faint ink — instrument-panel
  voice.
- **Telemetry values**: large steps (15–24 px), `font-variant-numeric:
  tabular-nums` so digits never jitter during playback.
- **Monospace** only for genuinely technical metadata: HUD coordinates,
  clock/time readouts. The UI as a whole is never monospace.

## Spacing and structure

- Header 56 px desktop / 50 px mobile; dock padding 24 px / 14 px.
- Radii: 2 px — everything stays crisp; nothing is a pill except switches.
- Gaps between telemetry cells: `clamp(20px, 4vw, 56px)` — the strip breathes
  with the viewport.
- Hairlines separate zones (header, dock edges); boxes are the exception.

## Controls

- **Buttons**: quiet — icon + dimmed ink, brightening on hover/focus. The
  primary landing button is an off-white outline that fills on hover.
- **Segmented controls** (camera, mode): a single hairline box; the active
  segment fills off-white with ground-colored text. One visible selection
  per group.
- **Switches**: 30×16 hairline track, ink knob, accent fill when on.
- **Timeline**: a native range input, invisible, laid over a 1 px hairline
  track with a glowing fill and a 9 px knob (12 px on hover). The native
  input keeps keyboard/touch/screen-reader behavior real.
- **Speed**: a hairline chip cycling 0.5×→8×; tabular numerals.

## Telemetry

- The strip shows only what the data supports — no data, no cell, no dashes
  posing as data.
- Labels in faint 9 px caps; values in large tabular figures.
- Live cells (position, altitude, speed, elapsed) update per tick; static
  totals (distance, ascent) render once per trace.
- The HUD (top-right of the stage) carries LAT/LON/ALT/HDG in small
  monospace with a dark text-shadow for map legibility; on mobile it folds
  to LAT + ALT.

## Map cartography

- Ground `#050607`; water `#080b0f` with a `#0d1218` shoreline line; urban
  texture `#090b0e`; buildings `#0a0c10`.
- Roads: minor `#14161b`, major `#1b1e25`, rail `#15181e` — a hierarchy of
  hairlines that never competes with the trace.
- Labels: sparse city/town caps, `#4c545e` with dark halos; water names in
  italic. The route outshines everything.
- Route: black-cased, thin `#f2f1ec` base at 42 % opacity, bright full-opacity
  progress stroke, cold-blue blurred glow beneath. Direction chevrons at
  zoom 11+, 50 % opacity. Endpoints: 9 px ringed dots.
- Current position: 11 px white dot, halo ring, soft pulse only while
  playing; static when paused.
- Elevation shading (WALK/FLIGHT): the base stroke swaps to a
  `line-progress` gradient, cold blue valleys → off-white peaks.
- Attribution stays visible and quiet (dark chip, bottom-right), on screen
  and in exports.

## Motion

- Landing fades in 900 ms; workspace 600 ms; both `cubic-bezier(0.22, 0.61,
  0.36, 1)` — long settled decelerations, nothing bounces.
- Camera: the tick loop is the tween. FOLLOW settles once (900 ms ease-out)
  then rides the point; CINEMATIC drifts bearing (damped, ≤ ~2°/s effective)
  and arcs zoom 14.6 → ~11.8 → back across the middle 80 % of playback.
- Playback marker pulses at 2.2 s only while playing.
- Toasts translate 6 px and fade over 260 ms.
- `prefers-reduced-motion`: all transitions/animations collapse to 0.01 ms,
  the marker never pulses, the landing animation holds a composed frame,
  and camera programs degrade to pan-only tracking (no rotation, no zoom
  arcs).

## Camera behavior

| Program | Zoom | Rotation | Behavior |
| --- | --- | --- | --- |
| OVERVIEW | fit-to-bounds (max 15) | none | holds the composed frame |
| FOLLOW | eases to ~14.2 | none | rides the current point |
| CINEMATIC | 14.6 with mid-route arc to ~11.8 | drifts toward heading, heavily damped | slow tracking with anticipation |

Motion-sickness guardrails: no pitch (max 0), rotation exists only in
CINEMATIC, all bearing changes pass through a double damping stage, and the
zoom arc skips the first and last 4–8 % of playback so openings and endings
stay stable.

## Mode voices

Each mode prints its name (accent caps) and one tagline in the header —
the lens is named, the chrome stays quiet:

| Mode | Tagline | Pacing | Camera default |
| --- | --- | --- | --- |
| RIDE | Pace, gradient, distance. | 60 s | FOLLOW |
| WALK | Slower time, a sense of place. | 90 s | OVERVIEW |
| FLIGHT | Altitude, telemetry, airspace. | 75 s | CINEMATIC |
| JOURNEY | Distance compressed into story. | 120 s | CINEMATIC |

FLIGHT additionally shows, bottom-left: "VISUALIZATION ONLY — NOT FOR
NAVIGATION."

## Mobile adaptation

- 768 px: header tightens, coordinates and mode voice fold away, HUD drops
  to two fields, the timeline wraps onto its own full-width row, dock
  padding tightens.
- 430 px: telemetry becomes a 2-column grid; landing actions stack
  full-width; the settings panel spans edge-to-edge minus 8 px margins.
- Touch targets stay ≥ 38 px; the dropzone is a focusable, Enter/Space
  operable surface.
- No horizontal overflow at 1440, 1024, 768 or 390 px (verified in browser).

## Do and don’t

| Do | Don’t |
| --- | --- |
| deep black, hairlines, typography-led hierarchy | SaaS cards, shadows-on-white dashboard chrome |
| cold-blue accent, used once per composition | gradients, neon, glassmorphism, crypto-dashboard gloss |
| restrained HUD and instrument typography | cluttered fitness-app data panes |
| editorial, deliberate motion | flashy transitions, parallax gimmicks |
| coordinates and telemetry as design material | generic map-app UI copied onto a dark theme |
| tabular numerals for anything that ticks | proportional digits jittering at 60 fps |

## References (direction, not imitation)

Technical cartography and survey maps; aviation flight instruments and HUD
graphics; film title sequences; premium editorial print layout; the NORD
LABS / ISO NORD visual language. No proprietary assets from any of these are
used.
