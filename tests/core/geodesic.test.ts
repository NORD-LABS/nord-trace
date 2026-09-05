/**
 * NORD TRACE — geodesic math tests.
 *
 * Grounded in independently computable values: the haversine reference
 * pair used across textbooks, antipodal symmetry, known bearings.
 */

import { describe, expect, it } from 'vitest';
import {
  EARTH_RADIUS_M,
  bearing,
  bearingDelta,
  haversineDistance,
  isValidCoordinate,
  lerpBearing,
  wrapLongitude,
} from '../../src/core/geodesic';

describe('haversineDistance', () => {
  it('computes the canonical Paris–New York distance', () => {
    const paris = { lat: 48.8566, lon: 2.3522 };
    const newyork = { lat: 40.7128, lon: -74.006 };
    const d = haversineDistance(paris, newyork);
    // Great-circle reference: ~5837 km.
    expect(d).toBeGreaterThan(5_700_000);
    expect(d).toBeLessThan(6_000_000);
  });

  it('gives zero for identical points', () => {
    const p = { lat: 46.8139, lon: -71.208 };
    expect(haversineDistance(p, p)).toBe(0);
  });

  it('computes one degree of latitude as ~111.2 km', () => {
    const a = { lat: 46, lon: -71 };
    const b = { lat: 47, lon: -71 };
    const d = haversineDistance(a, b);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });

  it('is symmetric', () => {
    const a = { lat: 10, lon: 20 };
    const b = { lat: -30, lon: 140 };
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 6);
  });

  it('caps at half the Earth circumference for antipodes', () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 0, lon: 179.5 };
    const d = haversineDistance(a, b);
    expect(d).toBeLessThan(Math.PI * EARTH_RADIUS_M);
    expect(d).toBeGreaterThan(Math.PI * EARTH_RADIUS_M * 0.98);
  });
});

describe('bearing', () => {
  it('is 0 (north) for a due-north step', () => {
    const a = { lat: 46, lon: -71 };
    const b = { lat: 47, lon: -71 };
    expect(bearing(a, b)).toBeCloseTo(0, 5);
  });

  it('is 90 (east) along the equator', () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 0, lon: 1 };
    expect(bearing(a, b)).toBeCloseTo(90, 3);
  });

  it('is 180 (south) for a due-south step', () => {
    const a = { lat: 47, lon: -71 };
    const b = { lat: 46, lon: -71 };
    expect(bearing(a, b)).toBeCloseTo(180, 5);
  });

  it('wraps into 0..360', () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 0, lon: -1 };
    const brg = bearing(a, b);
    expect(brg).toBeGreaterThanOrEqual(0);
    expect(brg).toBeLessThan(360);
    expect(brg).toBeCloseTo(270, 3);
  });
});

describe('wrapLongitude', () => {
  it('normalizes into [-180, 180)', () => {
    expect(wrapLongitude(181)).toBeCloseTo(-179, 6);
    expect(wrapLongitude(-181)).toBeCloseTo(179, 6);
    expect(wrapLongitude(360)).toBeCloseTo(0, 6);
    expect(wrapLongitude(-70)).toBe(-70);
  });
});

describe('isValidCoordinate', () => {
  it('accepts finite lat/lon', () => {
    expect(isValidCoordinate(46.8, -71.2)).toBe(true);
  });

  it('rejects latitude beyond poles', () => {
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(-90.5, 0)).toBe(false);
  });

  it('rejects non-finite values', () => {
    expect(isValidCoordinate(Number.NaN, 0)).toBe(false);
    expect(isValidCoordinate(0, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('accepts longitudes beyond ±180 (they wrap elsewhere)', () => {
    expect(isValidCoordinate(0, 250)).toBe(true);
  });
});

describe('bearingDelta', () => {
  it('computes the short signed difference', () => {
    expect(bearingDelta(10, 20)).toBe(10);
    expect(bearingDelta(20, 10)).toBe(-10);
    expect(bearingDelta(350, 10)).toBe(20);
    expect(bearingDelta(10, 350)).toBe(-20);
  });
});

describe('lerpBearing', () => {
  it('interpolates across the 0° seam', () => {
    expect(lerpBearing(350, 10, 0.5)).toBeCloseTo(0, 5);
  });

  it('interpolates normally elsewhere', () => {
    expect(lerpBearing(90, 180, 0.5)).toBeCloseTo(135, 5);
  });
});
