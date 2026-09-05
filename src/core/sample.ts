/**
 * NORD TRACE — sampling the trace at a progress fraction.
 *
 * Playback is a pure function of progress → TraceSample. Interpolation
 * runs on the precomputed cumulative arrays so scrubbing stays smooth
 * even on large traces.
 */

import { bearing, haversineDistance } from './geodesic';
import type { Trace, TraceSample } from './types';

/**
 * Locate the segment containing `target` on a monotonic array.
 * Returns [lo, hi] with value(lo) <= target <= value(hi), hi = lo+1,
 * clamped to the array ends.
 */
function bracketSearch(
  values: ArrayLike<number>,
  count: number,
  target: number,
): number {
  let lo = 0;
  let hi = count - 1;
  if (target <= values[0]) return 0;
  if (target >= values[hi]) return hi - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (values[mid] <= target) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Sample the trace at progress fraction 0..1.
 *
 * `fraction` is interpreted on the trace's time basis: recorded-time
 * progress when timestamps are usable, cumulative-distance progress
 * otherwise. Both are monotonic arrays, so the same sampler serves.
 */
export function sampleAtFraction(trace: Trace, fraction: number): TraceSample {
  const clamped = Math.max(0, Math.min(1, fraction));
  const points = trace.points;
  const count = points.length;
  const last = points[count - 1];

  const basisValues = trace.times ?? points.map((p) => p.distanceFromStart);
  const maxBasis = basisValues[count - 1];

  if (count === 1 || maxBasis <= 0) {
    return {
      lat: last.lat,
      lon: last.lon,
      elevation: last.elevation,
      distanceFromStart: last.distanceFromStart,
      time: last.time,
      speed: null,
      heading: null,
      segmentIndex: 0,
    };
  }

  const target = clamped * maxBasis;
  const i = bracketSearch(basisValues, count, target);
  const a = points[i];
  const b = points[i + 1];
  const span = basisValues[i + 1] - basisValues[i];
  const t = span > 0 ? (target - basisValues[i]) / span : 0;

  const lat = a.lat + (b.lat - a.lat) * t;
  const lon = a.lon + (b.lon - a.lon) * t;
  const elevation =
    a.elevation != null && b.elevation != null ? a.elevation + (b.elevation - a.elevation) * t : a.elevation ?? b.elevation;
  const distanceFromStart = a.distanceFromStart + (b.distanceFromStart - a.distanceFromStart) * t;

  let time: number | null = null;
  if (a.time != null && b.time != null) {
    time = a.time + (b.time - a.time) * t;
  }

  let speed: number | null = null;
  if (trace.times !== null) {
    const dt = trace.times[i + 1] - trace.times[i];
    const dd = b.distanceFromStart - a.distanceFromStart;
    if (dt > 0 && dd >= 0) speed = dd / dt;
  }

  const segLength = haversineDistance(a, b);
  const heading = segLength > 0.5 ? bearing(a, b) : null;

  return {
    lat,
    lon,
    elevation,
    distanceFromStart,
    time,
    speed,
    heading,
    segmentIndex: i,
  };
}

/**
 * Headings for the whole route, per segment — precomputed once for the
 * map's direction ticks. `null` where the segment is too short to have
 * a meaningful direction.
 */
export function segmentHeadings(trace: Trace): (number | null)[] {
  const points = trace.points;
  const out: (number | null)[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const len = haversineDistance(a, b);
    out.push(len > 0.5 ? bearing(a, b) : null);
  }
  return out;
}
