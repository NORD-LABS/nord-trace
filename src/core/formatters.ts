/**
 * NORD TRACE — human-readable formatting.
 *
 * Reasonable precision only: no eight-decimal telemetry, no fake
 * significance. Values that do not exist format as "—".
 */

import type { LatLng } from './types';

const DASH = '—';

export function formatDistance(metres: number | null | undefined): string {
  if (metres == null || !Number.isFinite(metres)) return DASH;
  if (metres < 0) return DASH;
  if (metres < 995) return `${Math.round(metres)} m`;
  if (metres < 10_000) return `${(metres / 1000).toFixed(2)} km`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Seconds → "1:04:32" / "4:32". Negative/invalid → dash. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return DASH;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Elapsed visualization time from 0..1 progress against a duration in seconds. */
export function formatElapsed(fraction: number, durationSeconds: number): string {
  return formatDuration(Math.max(0, Math.min(1, fraction)) * durationSeconds);
}

/** m/s → km/h with one decimal only under 10 km/h. */
export function formatSpeed(metresPerSecond: number | null | undefined): string {
  if (metresPerSecond == null || !Number.isFinite(metresPerSecond) || metresPerSecond < 0) {
    return DASH;
  }
  const kmh = metresPerSecond * 3.6;
  return `${kmh < 10 ? kmh.toFixed(1) : Math.round(kmh)} km/h`;
}

export function formatElevation(metres: number | null | undefined): string {
  if (metres == null || !Number.isFinite(metres)) return DASH;
  return `${Math.round(metres)} m`;
}

/** 46.8139° N / 71.2080° W style, 4-decimal precision. */
export function formatCoordinate(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns} / ${Math.abs(lon).toFixed(4)}° ${ew}`;
}

/** Compass-bearing readout: "214° SW". */
const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export function formatHeading(degrees: number | null | undefined): string {
  if (degrees == null || !Number.isFinite(degrees)) return DASH;
  const d = ((degrees % 360) + 360) % 360;
  const octant = Math.round(d / 45) % 8;
  return `${Math.round(d)}° ${COMPASS_8[octant]}`;
}

/** Recorded clock time from epoch ms ("14:32:05"), or dash. */
export function formatClock(epochMs: number | null | undefined): string {
  if (epochMs == null || !Number.isFinite(epochMs)) return DASH;
  const d = new Date(epochMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function formatPoint(point: LatLng): string {
  return formatCoordinate(point.lat, point.lon);
}
