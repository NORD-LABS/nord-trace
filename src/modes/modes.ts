/**
 * NORD TRACE — product modes.
 *
 * Presentation lenses over the same engine. A mode changes pacing,
 * camera defaults, telemetry emphasis and route treatment — it never
 * mutates trace data. FLIGHT reads technical (HUD voice, altitude
 * first); WALK reads quieter; RIDE reads fast; JOURNEY reads
 * narrative. A one-line navigation disclaimer ships with FLIGHT.
 */

import type { CameraMode } from '../map/camera';

export type ProductMode = 'ride' | 'walk' | 'flight' | 'journey';

export interface ModeProfile {
  id: ProductMode;
  label: string;
  /** One line under the mode name — the mode's intent. */
  tagline: string;
  /** Default camera when the mode is applied. */
  camera: CameraMode;
  /** Visualization length in seconds — pacing of the mode. */
  playbackSeconds: number;
  /** Elevation-tinted route stroke. */
  elevationTint: boolean;
  /** Which telemetry values lead, in order. */
  telemetryPriority: TelemetryKey[];
  /** Extra caption shown in FLIGHT. */
  disclaimer?: string;
}

export type TelemetryKey =
  | 'coordinates'
  | 'distance'
  | 'elapsed'
  | 'elevation'
  | 'elevationGain'
  | 'speed'
  | 'heading'
  | 'progress'
  | 'clock';

export const MODES: Record<ProductMode, ModeProfile> = {
  ride: {
    id: 'ride',
    label: 'RIDE',
    tagline: 'Pace, gradient, distance.',
    camera: 'follow',
    playbackSeconds: 60,
    elevationTint: false,
    telemetryPriority: ['distance', 'speed', 'elapsed', 'elevationGain'],
  },
  walk: {
    id: 'walk',
    label: 'WALK',
    tagline: 'Slower time, a sense of place.',
    camera: 'overview',
    playbackSeconds: 90,
    elevationTint: true,
    telemetryPriority: ['distance', 'elevation', 'elevationGain', 'elapsed'],
  },
  flight: {
    id: 'flight',
    label: 'FLIGHT',
    tagline: 'Altitude, telemetry, airspace.',
    camera: 'cinematic',
    playbackSeconds: 75,
    elevationTint: true,
    telemetryPriority: ['coordinates', 'elevation', 'heading', 'speed'],
    disclaimer: 'Visualization only — not for navigation.',
  },
  journey: {
    id: 'journey',
    label: 'JOURNEY',
    tagline: 'Distance compressed into story.',
    camera: 'cinematic',
    playbackSeconds: 120,
    elevationTint: false,
    telemetryPriority: ['distance', 'progress', 'coordinates', 'elapsed'],
  },
};

export const MODE_ORDER: ProductMode[] = ['ride', 'walk', 'flight', 'journey'];
