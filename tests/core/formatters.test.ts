/**
 * NORD TRACE — formatting tests.
 *
 * Reasonable precision is a product requirement: these pin it.
 */

import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatCoordinate,
  formatDistance,
  formatDuration,
  formatElevation,
  formatHeading,
  formatSpeed,
} from '../../src/core/formatters';

describe('formatDistance', () => {
  it('uses metres under 1 km', () => {
    expect(formatDistance(350.4)).toBe('350 m');
  });

  it('uses two decimals just over 1 km', () => {
    expect(formatDistance(1234)).toBe('1.23 km');
  });

  it('uses one decimal over 10 km', () => {
    expect(formatDistance(42_195)).toBe('42.2 km');
  });

  it('dashes for null/invalid', () => {
    expect(formatDistance(null)).toBe('—');
    expect(formatDistance(Number.NaN)).toBe('—');
    expect(formatDistance(-5)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('formats minutes:seconds under an hour', () => {
    expect(formatDuration(272)).toBe('4:32');
  });

  it('formats hours:minutes:seconds over an hour', () => {
    expect(formatDuration(3872)).toBe('1:04:32');
  });

  it('pads minutes and seconds', () => {
    expect(formatDuration(3600 + 5)).toBe('1:00:05');
  });

  it('dashes for null', () => {
    expect(formatDuration(null)).toBe('—');
  });
});

describe('formatSpeed', () => {
  it('converts m/s to km/h', () => {
    expect(formatSpeed(10)).toBe('36 km/h');
  });

  it('keeps one decimal under 10 km/h', () => {
    expect(formatSpeed(1.5)).toBe('5.4 km/h');
  });

  it('dashes when speed is unknown', () => {
    expect(formatSpeed(null)).toBe('—');
  });
});

describe('formatCoordinate', () => {
  it('formats with hemisphere letters and 4 decimals', () => {
    expect(formatCoordinate(46.8139, -71.208)).toBe('46.8139° N / 71.2080° W');
    expect(formatCoordinate(-33.9, 151.2)).toBe('33.9000° S / 151.2000° E');
  });
});

describe('formatElevation', () => {
  it('rounds to whole metres', () => {
    expect(formatElevation(123.6)).toBe('124 m');
  });

  it('dashes when unavailable', () => {
    expect(formatElevation(null)).toBe('—');
  });
});

describe('formatHeading', () => {
  it('shows degrees with compass octant', () => {
    expect(formatHeading(0)).toBe('0° N');
    expect(formatHeading(215)).toBe('215° SW');
    expect(formatHeading(90)).toBe('90° E');
  });

  it('normalizes out-of-range bearings', () => {
    expect(formatHeading(370)).toBe('10° N');
  });

  it('dashes when unknown', () => {
    expect(formatHeading(null)).toBe('—');
  });
});

describe('formatClock', () => {
  it('renders local time from epoch ms', () => {
    // Use a fixed timestamp with TZ-independent padding check.
    const ms = Date.UTC(2026, 7, 14, 18, 5, 9);
    const text = formatClock(ms);
    expect(text).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('dashes for null', () => {
    expect(formatClock(null)).toBe('—');
  });
});
