/**
 * NORD TRACE — GeoJSON parser tests.
 *
 * LineString, MultiLineString, Feature, FeatureCollection, name
 * extraction, clean rejection of polygons and unsupported types.
 */

import { describe, expect, it } from 'vitest';
import { parseGeoJSON } from '../../src/geojson/parser';
import { TraceInputError } from '../../src/core/errors';

const LINE = [
  [-71.0, 46.0],
  [-71.0, 46.001],
  [-71.001, 46.002],
];

describe('parseGeoJSON — supported geometries', () => {
  it('parses a bare LineString', () => {
    const trace = parseGeoJSON(JSON.stringify({ type: 'LineString', coordinates: LINE }));
    expect(trace.points).toHaveLength(3);
    expect(trace.sourceFormat).toBe('geojson');
    // GeoJSON is [lon, lat] — verify the swap happened.
    expect(trace.points[0].lon).toBe(-71.0);
    expect(trace.points[0].lat).toBe(46.0);
  });

  it('parses a MultiLineString by joining its lines', () => {
    const trace = parseGeoJSON(
      JSON.stringify({
        type: 'MultiLineString',
        coordinates: [LINE, [[-71.002, 46.003], [-71.003, 46.004]]],
      }),
    );
    expect(trace.points).toHaveLength(5);
  });

  it('parses a Feature wrapping a LineString and reads its name', () => {
    const trace = parseGeoJSON(
      JSON.stringify({
        type: 'Feature',
        properties: { name: 'River Loop' },
        geometry: { type: 'LineString', coordinates: LINE },
      }),
    );
    expect(trace.name).toBe('River Loop');
    expect(trace.points).toHaveLength(3);
  });

  it('parses a FeatureCollection of route features', () => {
    const trace = parseGeoJSON(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { title: 'Day 1' }, geometry: { type: 'LineString', coordinates: LINE } },
          { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: LINE } },
        ],
      }),
    );
    expect(trace.points).toHaveLength(6);
    expect(trace.name).toBe('Day 1');
  });

  it('reads elevation from 3D positions', () => {
    const trace = parseGeoJSON(
      JSON.stringify({
        type: 'LineString',
        coordinates: [
          [-71, 46, 150],
          [-71, 46.001, 160],
          [-71, 46.002, 170],
        ],
      }),
    );
    expect(trace.points[0].elevation).toBe(150);
    expect(trace.stats.maxElevation).toBe(170);
  });
});

describe('parseGeoJSON — clean rejections', () => {
  it('rejects a Polygon — a polygon is not a route', () => {
    const poly = {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    };
    try {
      parseGeoJSON(JSON.stringify(poly));
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TraceInputError);
      expect((err as TraceInputError).kind).toBe('no-route');
    }
  });

  it('rejects a FeatureCollection containing only points', () => {
    const fc = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-71, 46] } },
      ],
    };
    expect(() => parseGeoJSON(JSON.stringify(fc))).toThrow(TraceInputError);
  });

  it('rejects unsupported top-level types', () => {
    expect(() => parseGeoJSON(JSON.stringify({ type: 'NotGeoJSON' }))).toThrow(TraceInputError);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseGeoJSON('{definitely not json')).toThrow(TraceInputError);
  });

  it('skips invalid positions but keeps valid ones', () => {
    const trace = parseGeoJSON(
      JSON.stringify({
        type: 'LineString',
        coordinates: [
          [-71, 46],
          [-71, 999], // invalid latitude — dropped
          [-71, 46.001],
        ],
      }),
    );
    expect(trace.points).toHaveLength(2);
  });
});
