/**
 * NORD TRACE — GPX parsing.
 *
 * Real GPX support: <trk>/<trkseg>/<trkpt> with latitude, longitude,
 * optional <ele> and optional <time>, across multiple segments.
 *
 * Lookup strategy: `getElementsByTagName` matches the qualified name
 * ("trkpt" whether or not the document declares a default xmlns) —
 * the portable behavior across browsers and DOM emulations.
 * `getElementsByTagNameNS('*')` is NOT portable. GPX files in the
 * wild do not namespace-prefix these element names.
 *
 * Metadata is untrusted input: names are read only from text nodes
 * and rendered inert by the UI layer. Route points (<rtept>) are
 * accepted as a fallback source; waypoints are not routes.
 */

import { buildTrace, type RawPoint } from '../core/build';
import { TraceInputError } from '../core/errors';
import type { Trace } from '../core/types';

/** Practical import ceiling: GPX files beyond ~40 MB are rejected. */
export const MAX_GPX_BYTES = 40 * 1024 * 1024;

export function parseGPX(xml: string, fileName = ''): Trace {
  if (xml.length > MAX_GPX_BYTES) {
    throw new TraceInputError('This GPX file is too large to import.', 'too-large');
  }

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, 'application/xml');
  } catch {
    throw new TraceInputError('This GPX file could not be read as XML.');
  }

  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new TraceInputError('This GPX file contains malformed XML.');
  }

  const gpxList = doc.getElementsByTagName('gpx');
  if (gpxList.length === 0) {
    throw new TraceInputError('This file is not a GPX document (missing <gpx>).', 'unsupported');
  }
  const gpx = gpxList[0];

  const raw: RawPoint[] = [];
  // Track points carry the recorded route; route points are the fallback.
  const trackPoints = doc.getElementsByTagName('trkpt');
  const source = trackPoints.length > 0 ? trackPoints : doc.getElementsByTagName('rtept');

  for (let i = 0; i < source.length; i += 1) {
    const pt = source[i];
    const lat = readNumber(pt, 'lat');
    const lon = readNumber(pt, 'lon');
    if (lat === null || lon === null) continue;
    raw.push({
      lat,
      lon,
      elevation: readChildNumber(pt, 'ele'),
      time: readChildTime(pt, 'time'),
    });
  }

  if (raw.length === 0) {
    throw new TraceInputError(
      'No track points found. NORD TRACE reads <trkpt> routes (and <rtept> as fallback).',
      'no-route',
    );
  }

  return buildTrace(raw, { name: readName(gpx, fileName), sourceFormat: 'gpx' });
}

function readNumber(el: Element, attr: string): number | null {
  const v = el.getAttribute(attr);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function firstChild(el: Element, tag: string): Element | null {
  return el.getElementsByTagName(tag)[0] ?? null;
}

function readChildNumber(el: Element, tag: string): number | null {
  const child = firstChild(el, tag);
  if (!child) return null;
  const n = Number(child.textContent?.trim());
  return Number.isFinite(n) ? n : null;
}

function readChildTime(el: Element, tag: string): number | null {
  const child = firstChild(el, tag);
  const text = child?.textContent?.trim();
  if (!text) return null;
  const ms = Date.parse(text);
  return Number.isFinite(ms) ? ms : null;
}

function readName(gpx: Element, fileName: string): string {
  // Prefer the first track's name, then route, then metadata, then file name.
  const trk = gpx.getElementsByTagName('trk')[0];
  const trkName = trk?.getElementsByTagName('name')[0]?.textContent?.trim();
  if (trkName) return trkName;
  const rte = gpx.getElementsByTagName('rte')[0];
  const rteName = rte?.getElementsByTagName('name')[0]?.textContent?.trim();
  if (rteName) return rteName;
  const metadata = gpx.getElementsByTagName('metadata')[0];
  const metaName = metadata?.getElementsByTagName('name')[0]?.textContent?.trim();
  if (metaName) return metaName;
  if (fileName) return fileName.replace(/\.(gpx|xml)$/i, '');
  return '';
}
