/**
 * NORD TRACE — trace build/normalization tests.
 *
 * Pins the honest-data guarantees: dedupe, monotonic clamped time,
 * elevation-noise thresholding, and stats that refuse to exist when
 * the data does not support them.
 */

import { describe, expect, it } from 'vitest';
import { buildTrace, computeStats, type RawPoint } from '../../src/core/build';
import { TraceInputError } from '../../src/core/errors';

function pts(n: number, opts?: { stepM?: number; elev?: (i: number) => number | null; timeStepS?: number }): RawPoint[] {
  const step = opts?.stepM ?? 100;
  const timeStepS = opts?.timeStepS ?? 1;
  const out: RawPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      // ~111 m per 0.001° latitude — good enough for distance shaping.
      lat: 46 + i * (step / 111_000),
      lon: -71,
      elevation: opts?.elev ? opts.elev(i) : null,
      time: opts?.timeStepS == null ? null : 1_700_000_000_000 + i * timeStepS * 1000,
    });
  }
  return out;
}

describe('buildTrace — geometry', () => {
  it('computes cumulative distance along a straight north line', () => {
    const trace = buildTrace(pts(11), { name: 'T', sourceFormat: 'demo' });
    expect(trace.points).toHaveLength(11);
    expect(trace.stats.totalDistance).toBeGreaterThan(990);
    expect(trace.stats.totalDistance).toBeLessThan(1010);
    // Monotonic cumulative distances.
    for (let i = 1; i < trace.points.length; i += 1) {
      expect(trace.points[i].distanceFromStart).toBeGreaterThanOrEqual(
        trace.points[i - 1].distanceFromStart,
      );
    }
  });

  it('drops consecutive duplicate points', () => {
    const raw = pts(5);
    // Stationary GPS jitter: the final point repeats identically.
    const last = raw[raw.length - 1];
    raw.push({ ...last }, { ...last }, { ...last });
    const trace = buildTrace(raw, { name: 'T', sourceFormat: 'demo' });
    expect(trace.points).toHaveLength(5);
    // Distance does not grow across duplicates.
    expect(trace.stats.totalDistance).toBeLessThan(500);
  });

  it('rejects a trace with no valid points', () => {
    expect(() => buildTrace([], { name: 'T', sourceFormat: 'demo' })).toThrow(TraceInputError);
  });

  it('keeps a single-point trace only when explicitly allowed', () => {
    expect(() => buildTrace(pts(1), { name: 'T', sourceFormat: 'demo' })).toThrow(TraceInputError);
    const single = buildTrace(pts(1), { name: 'T', sourceFormat: 'demo', allowSinglePoint: true });
    expect(single.points).toHaveLength(1);
    expect(single.stats.totalDistance).toBe(0);
  });

  it('computes bounds over all points', () => {
    const trace = buildTrace(pts(10), { name: 'T', sourceFormat: 'demo' });
    expect(trace.stats.bounds.minLat).toBeCloseTo(46, 5);
    expect(trace.stats.bounds.maxLat).toBeCloseTo(46 + 9 * (100 / 111_000), 5);
    expect(trace.stats.pointCount).toBe(10);
  });
});

describe('buildTrace — time', () => {
  it('builds monotonic times and duration when timestamps exist', () => {
    const trace = buildTrace(pts(10, { timeStepS: 5 }), { name: 'T', sourceFormat: 'demo' });
    expect(trace.times).not.toBeNull();
    expect(trace.stats.duration).toBe(45);
    expect(trace.stats.timeBasis).toBe('time');
    expect(trace.stats.startTime).toBe(1_700_000_000_000);
    expect(trace.stats.endTime).toBe(1_700_000_000_000 + 45_000);
  });

  it('falls back to distance basis when timestamps are missing', () => {
    const trace = buildTrace(pts(10, { timeStepS: null }), { name: 'T', sourceFormat: 'demo' });
    expect(trace.times).toBeNull();
    expect(trace.stats.duration).toBeNull();
    expect(trace.stats.timeBasis).toBe('distance');
  });

  it('clamps a GPS outage instead of trusting the huge delta', () => {
    const raw = pts(6, { timeStepS: 2 });
    // Simulate a 1-hour gap between point 2 and 3 (median step is 2 s → max sane 8 s).
    raw[3] = { ...raw[3], time: raw[2].time! + 3_600_000 };
    const trace = buildTrace(raw, { name: 'T', sourceFormat: 'demo' });
    expect(trace.times).not.toBeNull();
    const times = trace.times as number[];
    const gapSteps: number[] = [];
    for (let i = 1; i < times.length; i += 1) gapSteps.push(times[i] - times[i - 1]);
    const maxStep = Math.max(...gapSteps);
    expect(maxStep).toBeLessThanOrEqual(8.001);
    // Total duration stays sane (well under the raw hour gap).
    expect(trace.stats.duration!).toBeLessThan(60);
  });

  it('rejects time playback when timestamps go backwards (all equal)', () => {
    const raw = pts(5, { timeStepS: 0 });
    const trace = buildTrace(raw, { name: 'T', sourceFormat: 'demo' });
    expect(trace.times).toBeNull();
    expect(trace.stats.timeBasis).toBe('distance');
  });
});

describe('buildTrace — elevation', () => {
  it('reports nulls when elevation is absent', () => {
    const trace = buildTrace(pts(10), { name: 'T', sourceFormat: 'demo' });
    expect(trace.stats.minElevation).toBeNull();
    expect(trace.stats.maxElevation).toBeNull();
    expect(trace.stats.elevationGain).toBeNull();
    expect(trace.stats.elevationLoss).toBeNull();
  });

  it('computes min/max/gain/loss for a simple hill', () => {
    const elev = (i: number): number => 100 + i * 10; // 100 → 190, pure climb
    const trace = buildTrace(pts(10, { elev }), { name: 'T', sourceFormat: 'demo' });
    expect(trace.stats.minElevation).toBe(100);
    expect(trace.stats.maxElevation).toBe(190);
    expect(trace.stats.elevationGain).toBeCloseTo(90, 0);
    expect(trace.stats.elevationLoss).toBeCloseTo(0, 0);
  });

  it('ignores sub-threshold sensor noise as climb', () => {
    // ±0.4 m jitter on a flat field: must produce ~0 gain, ~0 loss.
    const elev = (i: number): number => 100 + (i % 2 === 0 ? 0.4 : -0.4);
    const trace = buildTrace(pts(50, { elev }), { name: 'T', sourceFormat: 'demo' });
    expect(trace.stats.elevationGain).toBeLessThan(2);
    expect(trace.stats.elevationLoss).toBeLessThan(2);
  });

  it('counts a real climb after a flat section', () => {
    const elevs = [100, 100, 100, 130, 160, 160]; // 2 m noise floor, real 60 m climb
    const trace = buildTrace(pts(6, { elev: (i) => elevs[i] }), { name: 'T', sourceFormat: 'demo' });
    expect(trace.stats.elevationGain).toBeCloseTo(60, 0);
  });
});

describe('buildTrace — speed', () => {
  it('derives average speed from time basis', () => {
    // 10 points × 100 m, 5 s per step → 900 m / 45 s = 20 m/s.
    const trace = buildTrace(pts(10, { timeStepS: 5 }), { name: 'T', sourceFormat: 'demo' });
    expect(trace.stats.averageSpeed).not.toBeNull();
    expect(trace.stats.averageSpeed!).toBeGreaterThan(19);
    expect(trace.stats.averageSpeed!).toBeLessThan(21);
  });

  it('leaves average speed null without usable time', () => {
    const trace = buildTrace(pts(10, { timeStepS: null }), { name: 'T', sourceFormat: 'demo' });
    expect(trace.stats.averageSpeed).toBeNull();
  });
});

describe('computeStats — segments', () => {
  it('counts a pause over 5 minutes as a new segment', () => {
    const raw = pts(6, { timeStepS: 2 });
    raw[3] = { ...raw[3], time: raw[2].time! + 600_000 }; // 10-minute pause
    const trace = buildTrace(raw, { name: 'T', sourceFormat: 'demo' });
    expect(trace.stats.segmentCount).toBe(2);
  });

  it('keeps one segment for continuous recording', () => {
    const trace = buildTrace(pts(20, { timeStepS: 1 }), { name: 'T', sourceFormat: 'demo' });
    expect(trace.stats.segmentCount).toBe(1);
  });
});
