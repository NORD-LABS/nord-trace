/**
 * NORD TRACE — playback engine.
 *
 * One source of truth for progress. The engine owns a normalized
 * `fraction` in [0,1] advanced by requestAnimationFrame against the
 * trace's duration (recorded time or scaled distance time). UI,
 * camera, telemetry and map all read from tick events; nothing else
 * invents its own progress. The engine is UI-free and testable.
 */

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'completed';

export interface PlaybackSnapshot {
  state: PlaybackState;
  /** Normalized progress 0..1. */
  fraction: number;
  /** Wall-clock seconds of visualization time elapsed (scaled). */
  elapsedSeconds: number;
  speed: number;
}

export interface PlaybackTickHandlers {
  onTick?: (snapshot: PlaybackSnapshot) => void;
  onComplete?: (snapshot: PlaybackSnapshot) => void;
  onStateChange?: (state: PlaybackState, snapshot: PlaybackSnapshot) => void;
}

export interface PlaybackOptions extends PlaybackTickHandlers {
  /** Visualization length in seconds (scaled, not recorded). */
  durationSeconds: number;
}

export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

export class PlaybackEngine {
  private state: PlaybackState = 'idle';
  private fraction = 0;
  private speed: PlaybackSpeed = 1;
  private rafId: number | null = null;
  private lastFrameMs: number | null = null;
  private durationSeconds: number;
  private readonly handlers: PlaybackTickHandlers;

  constructor(options: PlaybackOptions) {
    if (!Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0) {
      throw new Error('PlaybackEngine requires a positive duration');
    }
    this.durationSeconds = options.durationSeconds;
    this.handlers = options;
  }

  get snapshot(): PlaybackSnapshot {
    return {
      state: this.state,
      fraction: this.fraction,
      elapsedSeconds: this.fraction * this.durationSeconds,
      speed: this.speed,
    };
  }

  /** Total visualization duration in seconds. */
  get duration(): number {
    return this.durationSeconds;
  }

  play(): void {
    if (this.state === 'playing') return;
    if (this.state === 'completed' || this.state === 'idle') {
      if (this.fraction >= 1) this.fraction = 0;
    }
    this.setState('playing');
    this.lastFrameMs = null;
    this.startLoop();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.stopLoop();
    this.setState('paused');
  }

  toggle(): void {
    if (this.state === 'playing') this.pause();
    else this.play();
  }

  restart(): void {
    this.stopLoop();
    this.fraction = 0;
    this.setState('paused');
    this.emitTick();
  }

  /** Seek to a normalized fraction; pauses at boundaries when playing. */
  seek(fraction: number): void {
    const clamped = Math.max(0, Math.min(1, fraction));
    const wasPlaying = this.state === 'playing';
    this.fraction = clamped;
    if (wasPlaying && clamped >= 1) {
      this.stopLoop();
      this.setState('completed');
    }
    this.emitTick();
  }

  setSpeed(speed: PlaybackSpeed): void {
    if (!PLAYBACK_SPEEDS.includes(speed)) return;
    this.speed = speed;
    this.emitTick();
  }

  /**
   * Change the visualization length (mode pacing) while keeping the
   * current progress fraction — switching RIDE→JOURNEY mid-play
   * re-times the sequence without losing position.
   */
  setDuration(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.durationSeconds = seconds;
    this.emitTick();
  }

  dispose(): void {
    this.stopLoop();
    this.state = 'idle';
    this.rafId = null;
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    const step = (ms: number): void => {
      if (this.state !== 'playing') return;
      if (this.lastFrameMs !== null) {
        const dt = (ms - this.lastFrameMs) / 1000;
        this.advance(dt);
      }
      this.lastFrameMs = ms;
      if (this.state === 'playing') this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.lastFrameMs = null;
  }

  private advance(dt: number): void {
    // Guard against tab-suspension jumps: a hidden tab can report huge
    // frame gaps; clamp so a 30 s suspension advances ≤ 1 s of story.
    const step = Math.min(dt, 1.0);
    this.fraction += (step * this.speed) / this.durationSeconds;
    if (this.fraction >= 1) {
      this.fraction = 1;
      this.stopLoop();
      this.setState('completed');
    }
    this.emitTick();
  }

  private setState(next: PlaybackState): void {
    if (this.state === next) return;
    this.state = next;
    this.handlers.onStateChange?.(next, this.snapshot);
  }

  private emitTick(): void {
    this.handlers.onTick?.(this.snapshot);
  }
}

/** Default cinematic length: a 90-second title sequence regardless of trace length. */
export const DEFAULT_PLAYBACK_SECONDS = 90;
