/**
 * NORD TRACE — geodesic math.
 *
 * Small, dependency-free and correct: distances are great-circle
 * (haversine on a mean-Earth sphere), bearings are initial course
 * angles. Coordinates are always lon/lat degrees as in GeoJSON.
 */

/** Mean Earth radius in metres (IUGG). */
export const EARTH_RADIUS_M = 6_371_008.8;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface LonLat {
  lon: number;
  lat: number;
}

export function toRad(deg: number): number {
  return deg * RAD;
}

export function toDeg(rad: number): number {
  return rad * DEG;
}

/** Great-circle distance between two points, in metres. */
export function haversineDistance(a: LonLat, b: LonLat): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Initial bearing from `a` toward `b`, degrees clockwise from true north
 * (0–360). Returns 0 when the points coincide.
 */
export function bearing(a: LonLat, b: LonLat): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const deg = toDeg(Math.atan2(y, x));
  return (deg + 360) % 360;
}

/** Normalize a longitude into [-180, 180). */
export function wrapLongitude(lon: number): number {
  let l = lon;
  while (l >= 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

/** Strict coordinate validation: finite, latitude within the poles. */
export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' && Number.isFinite(lat) &&
    typeof lon === 'number' && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90
  );
}

/** Shortest signed difference between two bearings, degrees in (-180, 180]. */
export function bearingDelta(from: number, to: number): number {
  let d = ((to - from + 540) % 360) - 180;
  if (d <= -180) d += 360;
  return d;
}

/** Interpolate linearly between two bearings along the short way. */
export function lerpBearing(a: number, b: number, t: number): number {
  return (a + bearingDelta(a, b) * t + 360) % 360;
}

export interface BoundsAccumulator {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
  count: number;
}

export function newBoundsAccumulator(): BoundsAccumulator {
  return { minLat: 90, minLon: 180, maxLat: -90, maxLon: -180, count: 0 };
}

export function accumulateBounds(acc: BoundsAccumulator, lat: number, lon: number): void {
  if (lat < acc.minLat) acc.minLat = lat;
  if (lat > acc.maxLat) acc.maxLat = lat;
  if (lon < acc.minLon) acc.minLon = lon;
  if (lon > acc.maxLon) acc.maxLon = lon;
  acc.count += 1;
}
