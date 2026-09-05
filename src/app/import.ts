/**
 * NORD TRACE — file ingestion.
 *
 * The boundary between the file system and the trace model: sniff the
 * format, size-check, parse, and normalize every failure into a
 * TraceInputError the UI can present. Route bytes never leave the
 * browser — nothing in this module performs I/O beyond the local read.
 */

import { TraceInputError } from '../core/errors';
import type { Trace } from '../core/types';
import { parseGPX } from '../gpx/parser';
import { parseGeoJSON } from '../geojson/parser';

/** Reject pathological files before reading them into memory. */
const MAX_FILE_BYTES = 40 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = '.gpx,.geojson,.json';

export function looksSupported(fileName: string): boolean {
  return /\.(gpx|geojson|json)$/i.test(fileName);
}

export async function importTraceFile(file: File): Promise<Trace> {
  if (!looksSupported(file.name)) {
    throw new TraceInputError(
      `Unsupported file type. Drop a .gpx or .geojson trace.`,
      'unsupported',
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new TraceInputError('File is too large (limit: 40 MB).', 'too-large');
  }
  if (file.size === 0) {
    throw new TraceInputError('This file is empty.', 'empty');
  }

  const text = await file.text();

  if (/\.gpx$/i.test(file.name)) {
    return parseGPX(text, file.name);
  }
  // .geojson / .json: sniff — some tools mislabel GPX with a .json suffix.
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<')) {
    return parseGPX(text, file.name);
  }
  return parseGeoJSON(text, file.name);
}
