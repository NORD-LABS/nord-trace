/**
 * NORD TRACE — GPX parser tests.
 *
 * Covers the structures and failure modes the product claims to
 * handle: normal traces, multiple segments, missing elevation/time,
 * malformed XML, empty files, routes-as-fallback, name extraction.
 */

import { describe, expect, it } from 'vitest';
import { parseGPX } from '../../src/gpx/parser';
import { TraceInputError } from '../../src/core/errors';

const GPX_WRAPPER = (inner: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
${inner}
</gpx>`;

function trkpt(lat: number, lon: number, ele?: number, time?: string): string {
  const eleTag = ele != null ? `<ele>${ele}</ele>` : '';
  const timeTag = time ? `<time>${time}</time>` : '';
  return `<trkpt lat="${lat}" lon="${lon}">${eleTag}${timeTag}</trkpt>`;
}

describe('parseGPX — normal traces', () => {
  it('parses a standard track with elevation and time', () => {
    const xml = GPX_WRAPPER(`
      <trk><name>Test Ride</name><trkseg>
        ${trkpt(46.0, -71.0, 100, '2026-08-14T12:00:00Z')}
        ${trkpt(46.001, -71.0, 110, '2026-08-14T12:00:10Z')}
        ${trkpt(46.002, -71.0, 120, '2026-08-14T12:00:20Z')}
      </trkseg></trk>`);
    const trace = parseGPX(xml);
    expect(trace.name).toBe('Test Ride');
    expect(trace.points).toHaveLength(3);
    expect(trace.sourceFormat).toBe('gpx');
    expect(trace.points[0].elevation).toBe(100);
    expect(trace.stats.minElevation).toBe(100);
    expect(trace.stats.maxElevation).toBe(120);
    expect(trace.stats.timeBasis).toBe('time');
  });

  it('parses multiple track segments into one route', () => {
    const xml = GPX_WRAPPER(`
      <trk><trkseg>
        ${trkpt(46.0, -71.0, 100, '2026-08-14T12:00:00Z')}
        ${trkpt(46.001, -71.0, 100, '2026-08-14T12:00:10Z')}
      </trkseg><trkseg>
        ${trkpt(46.002, -71.0, 100, '2026-08-14T12:10:00Z')}
        ${trkpt(46.003, -71.0, 100, '2026-08-14T12:10:10Z')}
      </trkseg></trk>`);
    const trace = parseGPX(xml);
    expect(trace.points).toHaveLength(4);
    expect(trace.stats.segmentCount).toBe(2); // the 10-minute pause splits
  });

  it('falls back to <rtept> when no track points exist', () => {
    const xml = GPX_WRAPPER(`
      <rte><name>Planned Route</name>
        <rtept lat="46.0" lon="-71.0"></rtept>
        <rtept lat="46.001" lon="-71.0"></rtept>
        <rtept lat="46.002" lon="-71.0"></rtept>
      </rte>`);
    const trace = parseGPX(xml);
    expect(trace.points).toHaveLength(3);
    expect(trace.name).toBe('Planned Route');
  });
});

describe('parseGPX — missing metadata', () => {
  it('handles missing elevation without pretending it exists', () => {
    const xml = GPX_WRAPPER(`<trk><trkseg>
      ${trkpt(46.0, -71.0, undefined, '2026-08-14T12:00:00Z')}
      ${trkpt(46.001, -71.0, undefined, '2026-08-14T12:00:10Z')}
    </trkseg></trk>`);
    const trace = parseGPX(xml);
    expect(trace.points[0].elevation).toBeNull();
    expect(trace.stats.minElevation).toBeNull();
    expect(trace.stats.elevationGain).toBeNull();
  });

  it('handles missing timestamps with distance-basis playback', () => {
    const xml = GPX_WRAPPER(`<trk><trkseg>
      ${trkpt(46.0, -71.0, 100)}
      ${trkpt(46.001, -71.0, 100)}
      ${trkpt(46.002, -71.0, 100)}
    </trkseg></trk>`);
    const trace = parseGPX(xml);
    expect(trace.times).toBeNull();
    expect(trace.stats.duration).toBeNull();
    expect(trace.stats.timeBasis).toBe('distance');
  });

  it('uses metadata name, then filename, when track is unnamed', () => {
    const metaXml = GPX_WRAPPER(
      `<metadata><name>Metadata Name</name></metadata><trk><trkseg>${trkpt(46, -71)}${trkpt(46.001, -71)}</trkseg></trk>`,
    );
    expect(parseGPX(metaXml).name).toBe('Metadata Name');

    const bareXml = GPX_WRAPPER(`<trk><trkseg>${trkpt(46, -71)}${trkpt(46.001, -71)}</trkseg></trk>`);
    expect(parseGPX(bareXml, 'morning-run.gpx').name).toBe('morning-run');
  });
});

describe('parseGPX — failures', () => {
  it('rejects malformed XML with a clean error', () => {
    expect(() => parseGPX('<gpx><trk><trkseg>')).toThrow(TraceInputError);
  });

  it('rejects a non-GPX XML document', () => {
    const xml = '<?xml version="1.0"?><root><item>not a route</item></root>';
    expect(() => parseGPX(xml)).toThrow(TraceInputError);
  });

  it('rejects a GPX with no track points', () => {
    const xml = GPX_WRAPPER('<trk><name>Empty</name></trk>');
    try {
      parseGPX(xml);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(TraceInputError);
      expect((err as TraceInputError).kind).toBe('no-route');
    }
  });

  it('rejects waypoints-only GPX (waypoints are not routes)', () => {
    const xml = GPX_WRAPPER('<wpt lat="46" lon="-71"><name>Parking</name></wpt>');
    expect(() => parseGPX(xml)).toThrow(TraceInputError);
  });

  it('skips points with invalid coordinates instead of crashing', () => {
    const xml = GPX_WRAPPER(`<trk><trkseg>
      <trkpt lat="banana" lon="-71"/>
      ${trkpt(46.0, -71.0)}
      ${trkpt(46.001, -71.0)}
    </trkseg></trk>`);
    const trace = parseGPX(xml);
    expect(trace.points).toHaveLength(2);
  });
});
