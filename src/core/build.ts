/**
 * NORD TRACE — trace normalization and statistics.
 *
 * Parsers hand over raw points; `buildTrace` turns them into the
 * normalized, defensible Trace: deduped geometry, monotonic clamped
 * time, noise-resistant elevation totals and honest nulls when the
 * data does not support a statistic. Nothing here is fabricated:
 * what is absent stays absent.
 */

import {
  accumulateBounds,
  haversineDistance,
  newBoundsAccumulator,
} from './geodesic';
import type { TimeBasis, Trace, TracePoint, TraceStats } from './types';
import { TraceInputError } from './errors';

/** Consecutive points closer than this are treated as duplicates. */
const DUPLICATE_EPSILON_M = 0.5;
/** Below this, elevation jitter is treated as sensor noise, not climb. */
const MIN_ELEVATION_NOISE_M = 1.0;
/** Recordings with a median sampling step under this are too sparse for time playback. */
const MIN_MEDIAN_STEP_S = 0.1;
/** A single jump larger than this many median steps is a GPS outage, clamped to it. */
const MAX_STEP_MULTIPLE = 4;

export interface RawPoint {
  lat: number;
  lon: number;
  elevation: number | null;
  time: number | null;
}

export interface BuildTraceOptions {
  name?: string;
  sourceFormat: Trace['sourceFormat'];
  /** Keep tiny traces (even a single point) instead of rejecting them. */
  allowSinglePoint?: boolean;
}

/**
 * Normalize raw parsed points into a Trace. Throws TraceInputError for
 * input that cannot be visualized at all (no valid points).
 */
export function buildTrace(raw: RawPoint[], options: BuildTraceOptions): Trace {
  const name = (options.name ?? '').trim() || 'Untitled trace';
  const points = dedupeAndMeasure(raw);

  if (points.length === 0) {
    throw new TraceInputError('No valid route points found in this file.');
  }
  if (points.length === 1 && !options.allowSinglePoint) {
    throw new TraceInputError(
      'This trace contains a single point — there is no route to play.',
    );
  }

  const { times, recordedDuration } = buildTimes(points);
  const stats = computeStats(points, times, recordedDuration);
  return { name, points, times, stats, sourceFormat: options.sourceFormat };
}

/** Drop duplicates and compute cumulative geodesic distance. */
function dedupeAndMeasure(raw: RawPoint[]): TracePoint[] {
  const points: TracePoint[] = [];
  let cumulative = 0;
  let prev: RawPoint | null = null;

  for (const p of raw) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    if (prev !== null) {
      const step = haversineDistance(prev, p);
      if (step < DUPLICATE_EPSILON_M) {
        // Same physical location: keep the freshest metadata, don't grow the route.
        const last = points[points.length - 1];
        points[points.length - 1] = {
          ...last,
          elevation: p.elevation ?? last.elevation,
          time: p.time ?? last.time,
        };
        continue;
      }
      cumulative += step;
    }
    points.push({
      lat: p.lat,
      lon: p.lon,
      elevation: p.elevation,
      time: p.time,
      distanceFromStart: cumulative,
    });
    prev = p;
  }
  return points;
}

/**
 * Build per-point cumulative recorded seconds. Timestamps may arrive out
 * of order or with GPS outages; they are clamped to a monotonic curve
 * bounded by the largest sane step rather than trusted blindly.
 */
function buildTimes(points: readonly TracePoint[]): {
  times: number[] | null;
  recordedDuration: number | null;
} {
  const rawTimes = points.map((p) => p.time);
  if (rawTimes.some((t) => t == null)) return { times: null, recordedDuration: null };
  if (rawTimes.length < 2) return { times: null, recordedDuration: null };

  const epoch = rawTimes as number[];
  const steps: number[] = [];
  for (let i = 1; i < epoch.length; i += 1) {
    const d = (epoch[i] - epoch[i - 1]) / 1000;
    if (d > 0) steps.push(d);
  }
  if (steps.length === 0) return { times: null, recordedDuration: null };

  steps.sort((a, b) => a - b);
  const medianStep = steps[Math.floor(steps.length / 2)];
  if (medianStep < MIN_MEDIAN_STEP_S) {
    // Sub-0.1s median sampling is clock noise, not a recording.
    return { times: null, recordedDuration: null };
  }
  const maxSaneStep = medianStep * MAX_STEP_MULTIPLE;

  const times: number[] = [0];
  let total = 0;
  for (let i = 1; i < epoch.length; i += 1) {
    const d = (epoch[i] - epoch[i - 1]) / 1000;
    const clamped = Math.min(Math.max(d, 0), maxSaneStep);
    total += clamped;
    times.push(total);
  }
  return { times, recordedDuration: total };
}

export function computeStats(
  points: readonly TracePoint[],
  times: readonly number[] | null,
  recordedDuration: number | null,
): TraceStats {
  const bounds = newBoundsAccumulator();
  let totalDistance = 0;
  for (const p of points) {
    accumulateBounds(bounds, p.lat, p.lon);
    totalDistance = p.distanceFromStart;
  }

  const elevation = elevationStats(points);

  let duration: number | null = null;
  let startTime: number | null = null;
  let endTime: number | null = null;
  let averageSpeed: number | null = null;

  if (times !== null && recordedDuration !== null && recordedDuration > 0) {
    duration = recordedDuration;
    const first = points[0];
    const last = points[points.length - 1];
    if (first.time != null) startTime = first.time;
    if (last.time != null) endTime = last.time;
    if (totalDistance > 1) averageSpeed = totalDistance / recordedDuration;
  }

  let timeBasis: TimeBasis = 'distance';
  if (duration !== null) {
    timeBasis = 'time';
  }

  return {
    totalDistance,
    duration,
    elevationGain: elevation.gain,
    elevationLoss: elevation.loss,
    minElevation: elevation.min,
    maxElevation: elevation.max,
    averageSpeed,
    startTime,
    endTime,
    bounds: {
      minLat: bounds.minLat,
      minLon: bounds.minLon,
      maxLat: bounds.maxLat,
      maxLon: bounds.maxLon,
    },
    pointCount: points.length,
    segmentCount: countSegments(points),
    timeBasis,
  };
}

/**
 * Total climb/descent with noise resistance: consecutive sample noise
 * below max(1 m, 2% of the elevation range) is not counted as gain.
 */
function elevationStats(points: readonly TracePoint[]): {
  gain: number | null;
  loss: number | null;
  min: number | null;
  max: number | null;
} {
  const values: number[] = [];
  for (const p of points) {
    if (p.elevation != null && Number.isFinite(p.elevation)) values.push(p.elevation);
  }
  if (values.length < 2) {
    return { gain: null, loss: null, min: null, max: null };
  }

  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const threshold = Math.max(MIN_ELEVATION_NOISE_M, (max - min) * 0.02);
  let gain = 0;
  let loss = 0;
  let reference = values[0];
  for (const v of values) {
    const delta = v - reference;
    if (delta >= threshold) {
      gain += delta;
      reference = v;
    } else if (delta <= -threshold) {
      loss += -delta;
      reference = v;
    }
  }
  return { gain, loss, min, max };
}

/**
 * Count physical segments: a recording pause longer than 5 minutes
 * breaks the journey into segments (start + each restart).
 */
function countSegments(points: readonly TracePoint[]): number {
  if (points.length === 0) return 0;
  const PAUSE_SECONDS = 300;
  let segments = 1;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a.time != null && b.time != null && (b.time - a.time) / 1000 > PAUSE_SECONDS) {
      segments += 1;
    }
  }
  return segments;
}
