# NORD TRACE — Design Language

> Provisional working direction. Values below are working defaults, not final
> brand tokens. The governing feel: technical cartography, aviation-interface
> restraint, editorial typography, cinematic pacing.

## Foundations

**Surfaces.** Deep black and near-black only. The map is the hero; chrome
disappears into it.

```text
--surface:        #0A0B0D    (near-black, cold cast)
--surface-raised: #101216
--hairline:       rgba(232, 230, 223, 0.14)
```

**Ink.** Off-white, never pure white — pure white on black vibrates.

```text
--ink:      #E8E6DF    (warm off-white)
--ink-dim:  #8A8F98    (secondary, telemetry captions)
```

**Accent.** One cold blue, used sparingly — active states, progress, a single
highlight per composition. If accent appears everywhere, it means nothing.

```text
--accent:   #6F8FA8
```

**Grid.** A visible but faint technical grid grounds compositions; hairline
rules separate telemetry bands. Coordinates, when shown, are part of the grid
system, not floating labels.

## Typography

Typography-led hierarchy: size, weight and letterspacing do the work color and
boxes would otherwise do.

- Wordmark and headings: extended tracking, generous scale steps.
- Telemetry (coordinates, timestamps, speed): monospace, small, letterspaced
  capitals — instrument-panel voice.
- No decorative typefaces; no more than two families. Exact selections are
  deferred until licensing-clean choices are made.

## Graphic vocabulary

- topographic contour lines as texture and section dividers
- the graticule (coordinate grid) as an honest structural element
- thin telemetry: altitude and speed as hairline strokes, not chart junk
- route rendering as the brightest element in any composition
- restrained HUD framing — corner ticks, fine rules — never sci-fi kitsch

## Motion

Motion is deliberate and editorial. It has pacing, like a title sequence —
not ornament, like a demo reel.

- ease with intent: long, settled decelerations; nothing bounces or spins
- the camera leads the eye along the route; cuts are rare and motivated
- telemetry values count and settle; they do not flicker
- restraint is the default; expressiveness is earned by the composition

## Composition

- Cinematic widescreen is the primary format.
- Vertical (9:16) and square are composition modes for social edits —
  reframed and re-typeset, never a center-crop of the widescreen frame.
- Title cards, coordinates and timestamps are composed elements with their own
  hierarchy.

## Do and don’t

| Do | Don’t |
| --- | --- |
| deep black, hairlines, typography-led hierarchy | SaaS cards, shadows-on-white dashboard chrome |
| cold-blue accent, used once per composition | gradients, neon, glassmorphism, crypto-dashboard gloss |
| restrained HUD and instrument typography | cluttered fitness-app data panes |
| editorial, deliberate motion | flashy transitions, parallax gimmicks |
| coordinates and telemetry as design material | generic map-app UI copied onto a dark theme |

## References (direction, not imitation)

Technical cartography and survey maps; aviation flight instruments and HUD
graphics; film title sequences; premium editorial print layout; the NORD LABS /
ISO NORD visual language. No proprietary assets from any of these are used.
