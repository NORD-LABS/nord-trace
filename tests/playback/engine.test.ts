/**
 * NORD TRACE — playback engine + sampler tests.
 *
 * Pins the single-source-of-truth contract: progress advances by
 * real elapsed time scaled by speed, seeking clamps, boundaries
 * complete, and the sampler reads time or distance per the trace's
 * basis.
 */

import { describe, expect, it } from 'vitest';
import { PlaybackEngine } from '../../src/playback/engine';
import { buildTrace, type RawPoint } from '../../src/core/build';
import { sampleAtFraction } from '../../src/core/sample';

// ---------------------------------------------------------------- engine

class FakeClock {
  private t = 0;
  private callbacks: ((ms: number) => void)[] = [];

  raf(cb: (ms: number) => void): number {
    this.callbacks.push(cb);
    return this.callbacks.length;
  }

  cancel(): void {
    this.callbacks = [];
  }

  /** Fire the pending frame callback after advancing the clock. */
  tick(ms: number): void {
    this.t += ms;
    const cbs = this.callbacks;
    this.callbacks = [];
    for (const cb of cbs) cb(this.t);
  }
}

function makeEngine(duration = 100) {
  const ticks: number[] = [];
  const states: string[] = [];
  const clock = new FakeClock();
  const engine = new PlaybackEngine({
    durationSeconds: duration,
    onTick: (s) => ticks.push(s.fraction),
    onStateChange: (s) => states.push(s),
  });
  // Swap rAF for the fake clock.
  (engine as unknown as { startLoop(): void }).startLoop.bind(engine);
  const origRaf = globalThis.requestAnimationFrame;
  const origCaf = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = clock.raf.bind(clock) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = clock.cancel.bind(clock) as typeof cancelAnimationFrame;
  return {
    engine,
    clock,
    ticks,
    states,
    restore() {
      globalThis.requestAnimationFrame = origRaf;
      globalThis.cancelAnimationFrame = origCaf;
    },
  };
}

describe('PlaybackEngine', () => {
  it('starts idle at fraction 0', () => {
    const h = makeEngine();
    h.restore();
    expect(h.engine.snapshot.state).toBe('idle');
    expect(h.engine.snapshot.fraction).toBe(0);
  });

  it('advances progress with elapsed time × speed', () => {
    const h = makeEngine(100);
    h.engine.play();
    h.clock.tick(0); // flushes the initial rAF registration
    for (let i = 0; i < 10; i += 1) h.clock.tick(1000); // 10 s at 1× of 100 s → 0.10
    expect(h.engine.snapshot.fraction).toBeCloseTo(0.1, 4);
    h.engine.setSpeed(4);
    h.clock.tick(1000); // 1 s at 4× → +0.04
    expect(h.engine.snapshot.fraction).toBeCloseTo(0.14, 4);
    h.restore();
  });

  it('pauses and resumes without losing position', () => {
    const h = makeEngine(100);
    h.engine.play();
    h.clock.tick(0);
    h.clock.tick(2000);
    h.engine.pause();
    const at = h.engine.snapshot.fraction;
    h.clock.tick(5000); // paused: must not advance
    expect(h.engine.snapshot.fraction).toBe(at);
    h.engine.play();
    h.clock.tick(0);
    h.clock.tick(1000);
    expect(h.engine.snapshot.fraction).toBeGreaterThan(at);
    h.restore();
  });

  it('seeks and clamps to [0,1]', () => {
    const h = makeEngine();
    h.restore();
    h.engine.seek(0.5);
    expect(h.engine.snapshot.fraction).toBe(0.5);
    h.engine.seek(-3);
    expect(h.engine.snapshot.fraction).toBe(0);
    h.engine.seek(7);
    expect(h.engine.snapshot.fraction).toBe(1);
  });

  it('completes at the boundary and stays there', () => {
    const h = makeEngine(10);
    h.engine.play();
    h.clock.tick(0);
    for (let i = 0; i < 12; i += 1) h.clock.tick(1000);
    expect(h.engine.snapshot.state).toBe('completed');
    expect(h.engine.snapshot.fraction).toBe(1);
    const frozen = h.engine.snapshot.fraction;
    h.clock.tick(5_000);
    expect(h.engine.snapshot.fraction).toBe(frozen);
    h.restore();
  });

  it('restart resets to 0 in paused state', () => {
    const h = makeEngine(10);
    h.engine.play();
    h.clock.tick(0);
    h.clock.tick(3000);
    h.engine.restart();
    expect(h.engine.snapshot.fraction).toBe(0);
    expect(h.engine.snapshot.state).toBe('paused');
    h.restore();
  });

  it('play after completion restarts from the beginning', () => {
    const h = makeEngine(10);
    h.engine.play();
    h.clock.tick(0);
    for (let i = 0; i < 12; i += 1) h.clock.tick(1000);
    expect(h.engine.snapshot.fraction).toBe(1);
    h.engine.play();
    expect(h.engine.snapshot.fraction).toBe(0);
    h.restore();
  });

  it('setDuration re-times playback keeping position', () => {
    const h = makeEngine(100);
    h.restore();
    h.engine.seek(0.5);
    h.engine.setDuration(50);
    expect(h.engine.snapshot.fraction).toBe(0.5);
    expect(h.engine.duration).toBe(50);
    expect(h.engine.snapshot.elapsedSeconds).toBeCloseTo(25, 3);
  });

  it('guards against tab-suspension dt spikes', () => {
    const h = makeEngine(100);
    h.engine.play();
    h.clock.tick(0);
    // A 30 s suspension must advance at most ~1 s of story time.
    h.clock.tick(30_000);
    expect(h.engine.snapshot.fraction).toBeLessThanOrEqual(0.011);
    h.restore();
  });
});

// ---------------------------------------------------------------- sampler

function straightTrace(n: number, timeStepS: number | null) {
  const raw: RawPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    raw.push({
      lat: 46 + i * 0.001,
      lon: -71,
      elevation: 100 + i,
      time: timeStepS == null ? null : 1_700_000_000_000 + i * timeStepS * 1000,
    });
  }
  return buildTrace(raw, { name: 'S', sourceFormat: 'demo' });
}

describe('sampleAtFraction', () => {
  it('returns the first point at fraction 0', () => {
    const trace = straightTrace(10, 1);
    const s = sampleAtFraction(trace, 0);
    expect(s.lat).toBeCloseTo(46, 5);
    expect(s.distanceFromStart).toBe(0);
  });

  it('returns the last point at fraction 1', () => {
    const trace = straightTrace(10, 1);
    const s = sampleAtFraction(trace, 1);
    expect(s.lat).toBeCloseTo(46.009, 5);
  });

  it('interpolates position mid-route (distance basis)', () => {
    const trace = straightTrace(11, null);
    const s = sampleAtFraction(trace, 0.5);
    expect(s.lat).toBeCloseTo(46.005, 4);
  });

  it('interpolates by recorded time when timestamps exist', () => {
    // 10 points at 0.001° (~111 m) steps, 10 s per step. Time and
    // distance bases coincide for a uniform trace; 0.25 of 90 s of
    // recorded time lands between point 2 and 3.
    const trace = straightTrace(10, 10);
    const s = sampleAtFraction(trace, 0.25);
    expect(s.lat).toBeCloseTo(46.00225, 4);
    expect(s.time).not.toBeNull();
  });

  it('interpolates elevation and reports speed on the time basis', () => {
    const trace = straightTrace(11, 10);
    const s = sampleAtFraction(trace, 0.5);
    expect(s.elevation).toBeCloseTo(105, 1);
    expect(s.speed).not.toBeNull();
    expect(s.speed!).toBeGreaterThan(10); // ~111 m / 10 s ≈ 11 m/s
  });

  it('clamps out-of-range fractions', () => {
    const trace = straightTrace(5, 1);
    expect(sampleAtFraction(trace, -1).distanceFromStart).toBe(0);
    expect(sampleAtFraction(trace, 2).lat).toBeCloseTo(trace.points[4].lat, 6);
  });

  it('handles a single-point trace without crashing', () => {
    const single = buildTrace(
      [{ lat: 46, lon: -71, elevation: 90, time: null }],
      { name: 'P', sourceFormat: 'demo', allowSinglePoint: true },
    );
    const s = sampleAtFraction(single, 0.7);
    expect(s.lat).toBe(46);
    expect(s.heading).toBeNull();
    expect(s.speed).toBeNull();
  });
});
