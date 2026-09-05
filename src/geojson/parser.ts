/**
 * NORD TRACE — GeoJSON parsing.
 *
 * Accepts LineString, MultiLineString, Feature and FeatureCollection
 * with route-compatible geometries. Polygons and other non-route
 * geometries are rejected cleanly — a polygon is not a route and is
 * never silently reinterpreted as one. Names come from the first
 * available name-like property.
 */

import { buildTrace, type RawPoint } from '../core/build';
import { TraceInputError } from '../core/errors';
import { isValidCoordinate } from '../core/geodesic';
import type { Trace } from '../core/types';

/** Practical import ceiling for GeoJSON. */
export const MAX_GEOJSON_BYTES = 40 * 1024 * 1024;

export function parseGeoJSON(text: string, fileName = ''): Trace {
  if (text.length > MAX_GEOJSON_BYTES) {
    throw new TraceInputError('This GeoJSON file is too large to import.', 'too-large');
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new TraceInputError('This GeoJSON file contains invalid JSON.');
  }

  if (data == null || typeof data !== 'object') {
    throw new TraceInputError('This file is not a GeoJSON document.', 'unsupported');
  }

  const obj = data as Record<string, unknown>;
  if (obj.type !== 'FeatureCollection' && obj.type !== 'Feature' && !isGeometryType(obj.type)) {
    throw new TraceInputError(`Unsupported GeoJSON type: "${String(obj.type)}".`, 'unsupported');
  }

  const lines: RawPoint[][] = [];
  const name = readName(obj) ?? fileName.replace(/\.(geo)?json$/i, '');

  collectFromNode(obj, lines);

  const flattened = lines.flat();
  if (flattened.length === 0) {
    throw new TraceInputError(
      'No route geometry found. NORD TRACE reads LineString and MultiLineString routes.',
      'no-route',
    );
  }

  return buildTrace(flattened, { name, sourceFormat: 'geojson' });
}

function isGeometryType(t: unknown): boolean {
  return (
    t === 'Point' ||
    t === 'MultiPoint' ||
    t === 'LineString' ||
    t === 'MultiLineString' ||
    t === 'Polygon' ||
    t === 'MultiPolygon' ||
    t === 'GeometryCollection'
  );
}

function collectFromNode(node: unknown, out: RawPoint[][]): void {
  if (node == null || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;

  switch (obj.type) {
    case 'FeatureCollection': {
      const features = obj.features;
      if (Array.isArray(features)) {
        for (const f of features) collectFromNode(f, out);
      }
      return;
    }
    case 'Feature': {
      collectFromNode(obj.geometry, out);
      return;
    }
    case 'GeometryCollection': {
      const geometries = obj.geometries;
      if (Array.isArray(geometries)) {
        for (const g of geometries) collectFromNode(g, out);
      }
      return;
    }
    case 'LineString': {
      const line = readPositions(obj.coordinates);
      if (line.length >= 2) out.push(line);
      return;
    }
    case 'MultiLineString': {
      const coords = obj.coordinates;
      if (Array.isArray(coords)) {
        for (const line of coords) {
          const pts = readPositions(line);
          if (pts.length >= 2) out.push(pts);
        }
      }
      return;
    }
    case 'Polygon':
    case 'MultiPolygon':
      // A polygon encloses area — it is not a route. Rejected cleanly.
      return;
    case 'Point':
    case 'MultiPoint':
      // Isolated points are not routes.
      return;
    default:
      return;
  }
}

function readPositions(input: unknown): RawPoint[] {
  if (!Array.isArray(input)) return [];
  const out: RawPoint[] = [];
  for (const pos of input) {
    if (!Array.isArray(pos) || pos.length < 2) continue;
    const lon = pos[0];
    const lat = pos[1];
    if (!isValidCoordinate(lat, lon)) continue;
    const elevation = pos.length >= 3 && typeof pos[2] === 'number' && Number.isFinite(pos[2])
      ? pos[2]
      : null;
    out.push({ lat, lon, elevation, time: null });
  }
  return out;
}

function readName(obj: Record<string, unknown>): string | null {
  if (obj.type === 'Feature') {
    return nameFromProperties(obj.properties);
  }
  if (obj.type === 'FeatureCollection') {
    const props = nameFromProperties(obj.properties);
    if (props) return props;
    // Fall through to the first named feature.
    const features = obj.features;
    if (Array.isArray(features)) {
      for (const f of features) {
        if (f != null && typeof f === 'object') {
          const name = nameFromProperties((f as Record<string, unknown>).properties);
          if (name) return name;
        }
      }
    }
  }
  return null;
}

function nameFromProperties(props: unknown): string | null {
  if (props == null || typeof props !== 'object') return null;
  const p = props as Record<string, unknown>;
  for (const key of ['name', 'title', 'Name', 'NAME']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}
