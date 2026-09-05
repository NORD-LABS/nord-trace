/**
 * NORD TRACE — core trace model.
 *
 * The Trace is the single source of truth: geometry, optional time,
 * optional elevation and derived statistics, computed once at import
 * and read everywhere else. Playback never mutates a Trace.
 */

export interface LatLng {
  readonly lat: number;
  readonly lon: number;
}

export interface Bounds {
  readonly minLat: number;
  readonly minLon: number;
  readonly maxLat: number;
  readonly maxLon: number;
}

export interface TracePoint {
  readonly lat: number;
  readonly lon: number;
  /** Metres. `null` when the source has no elevation data. */
  readonly elevation: number | null;
  /** Epoch milliseconds. `null` when the source has no timestamps. */
  readonly time: number | null;
  /** Cumulative geodesic distance from the first point, in metres. */
  readonly distanceFromStart: number;
}

/** How playback maps progress onto the route. */
export type TimeBasis = 'time' | 'distance';

export interface TraceStats {
  /** Total geodesic distance in metres (always present). */
  readonly totalDistance: number;
  /** Recorded duration in seconds; `null` without usable timestamps. */
  readonly duration: number | null;
  readonly elevationGain: number | null;
  readonly elevationLoss: number | null;
  readonly minElevation: number | null;
  readonly maxElevation: number | null;
  /** Average moving speed in m/s; `null` when unreliable. */
  readonly averageSpeed: number | null;
  /** First/last valid timestamps, epoch ms. */
  readonly startTime: number | null;
  readonly endTime: number | null;
  readonly bounds: Bounds;
  readonly pointCount: number;
  readonly segmentCount: number;
  readonly timeBasis: TimeBasis;
}

export interface Trace {
  readonly name: string;
  readonly points: readonly TracePoint[];
  /**
   * Cumulative recorded time per point in seconds (clamped monotonic),
   * aligned with `points`. `null` when timestamps are unusable.
   */
  readonly times: readonly number[] | null;
  readonly stats: TraceStats;
  readonly sourceFormat: 'gpx' | 'geojson' | 'demo';
}

/** A sample of the trace at some progress — the playback read-model. */
export interface TraceSample {
  readonly lat: number;
  readonly lon: number;
  readonly elevation: number | null;
  /** Metres travelled from the start at this sample. */
  readonly distanceFromStart: number;
  /** Recorded time at this sample, epoch ms; `null` without timestamps. */
  readonly time: number | null;
  /** Instantaneous speed in m/s; `null` when unreliable. */
  readonly speed: number | null;
  /** Compass bearing of travel, degrees 0–360; `null` when stationary/unknown. */
  readonly heading: number | null;
  /** Index of the bracketing segment start point. */
  readonly segmentIndex: number;
}
