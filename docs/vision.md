# NORD TRACE — Vision

> Provisional. This document describes intent, not shipped capability. It will
> change as the product takes shape.

## Why NORD TRACE exists

GPS tools answer a question of record: where did you go, how far, how fast.
Those answers are useful, and almost every product that gives them looks the
same — a line on a generic map, a panel of charts, a feed.

NORD TRACE starts from a different question: **what does a route feel like?**
A trace carries position, altitude, velocity, time and geography. Treated as
raw material — composed with typography, cartography and deliberate motion —
those signals can produce something closer to a title sequence or an editorial
spread than a dashboard.

NORD TRACE exists to build that instrument.

## The experience

The product direction, in one sentence: import a trace, and receive a
composition — a dark, precise, cinematic rendering of the movement that could
open a film or anchor an editorial piece about a ride, a hike, a flight or a
journey.

Over time, that means:

- GPX and GeoJSON import, normalized into a clean internal trace model
- animated playback along the real geometry, at real or scaled time
- a cinematic map camera — framing, easing and pacing, not just zoom buttons
- altitude and velocity rendered as thin, restrained telemetry graphics
- coordinates, timestamps and route progress as first-class typographic
  elements
- visual themes so the same trace can read technical, editorial or atmospheric
- cinematic widescreen first; vertical and social formats later
- eventual still-image and video output for sharing outside the app

None of this exists yet. It is the direction the phases in the
[README](../README.md#roadmap) build toward.

## Modes

Modes are product lenses — the same engine, tuned for a kind of movement:

- **RIDE** — cycling and road movement. Pace, gradient and distance matter;
  the composition should read speed and terrain.
- **WALK** — photo walks, hikes and urban exploration. Slower time; place and
  texture matter more than pace.
- **FLIGHT** — drone and aviation traces. Altitude becomes a primary axis;
  telemetry and airspace context matter.
- **JOURNEY** — long-form travel and road trips. The composition becomes
  narrative: distance compressed into story.

## What success feels like

- Someone who records every ride says the render is *nicer than the ride
  deserved*.
- A designer would screenshot it without knowing what it is.
- The output holds up as a social post or the opening frame of an edit with no
  additional tooling.
- Nothing on screen is decorative noise; every line is telemetry or typography.

## Non-goals

NORD TRACE is not:

- a training-analytics platform — no segments, leaderboards or power curves;
- a social network or feed;
- a navigation or routing product;
- a general-purpose GIS tool;
- an ad-supported consumer app;
- a replacement for mapping platforms — it builds on them.

## Relationship to NORD LABS and ISO NORD CA

NORD TRACE is developed by NORD LABS, the experimental software and
digital-systems work of Théodore Beaupré, under the ISO NORD CA licensing
framework. Licensing: [`../LICENSE.md`](../LICENSE.md). Contact:
info@theo-picture.com.
