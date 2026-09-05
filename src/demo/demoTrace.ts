/**
 * NORD TRACE — synthetic demo trace.
 *
 * Generated for this repository: no claim that it represents a real
 * recorded journey. A deterministic (seeded) river-valley loop with
 * modest hills, 2-second recording cadence, full timestamps and
 * elevation — sized to exercise every feature: playback, elevation
 * profile, speed readouts, camera modes.
 */

import { buildTrace, type RawPoint } from '../core/build';
import { EARTH_RADIUS_M } from '../core/geodesic';
import type { Trace } from '../core/types';

export const DEMO_TRACE_NAME = 'DEMO TRACE — Nord Loop';

/** Deterministic PRNG so the demo is byte-stable across loads/tests. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

export function generateDemoTrace(): Trace {
  const rand = lcg(0x2612_1963);
  const points: RawPoint[] = [];

  // Start in open country west of Québec City (synthetic, not a real trip).
  const lat0 = 46.845;
  const lon0 = -71.32;

  const loopPoints = 240;
  const timeStepMs = 2_000;
  const loopRadians = Math.PI * 2 * 0.86; // ~310° sweep, closed feel without overlap

  for (let i = 0; i <= loopPoints; i += 1) {
    const t = i / loopPoints;
    // Angular ease so the demo starts and ends gracefully.
    const theta = loopRadians * t - Math.PI * 0.07;
    // Radius breathes: a river loop with two wide bays.
    const radius =
      900 +
      420 * Math.sin(2 * theta + 0.6) +
      180 * Math.sin(5 * theta + 2.1) +
      40 * (rand() - 0.5);
    // Centre drifts so the shape is organic, not a circle.
    const cx = lon0 + 0.004 * Math.sin(theta * 1.7);
    const cy = lat0 + 0.003 * Math.cos(theta * 1.3);

    const lat = cy + (radius / EARTH_RADIUS_M) * (180 / Math.PI) * Math.sin(theta) * 1.18;
    const lon =
      cx +
      (radius / EARTH_RADIUS_M) * (180 / Math.PI) * Math.cos(theta) / Math.cos((lat0 * Math.PI) / 180);

    // Elevation: rolling valley profile, 40 m of relief, gentle noise.
    const elevation =
      92 +
      26 * Math.sin(3 * theta + 0.4) +
      9 * Math.sin(7 * theta + 1.9) +
      2.2 * (rand() - 0.5);

    points.push({
      lat,
      lon,
      elevation: Math.round(elevation * 10) / 10,
      time: Date.UTC(2026, 7, 14, 13, 5, 0) + i * timeStepMs,
    });
  }

  return buildTrace(points, { name: DEMO_TRACE_NAME, sourceFormat: 'demo' });
}
