/**
 * NORD TRACE — typed input errors.
 *
 * Parsers and normalization throw these; the UI renders their messages
 * directly. No stack traces, no raw browser errors in the interface.
 */

export type TraceInputErrorKind =
  | 'empty'
  | 'unsupported'
  | 'malformed'
  | 'too-large'
  | 'no-route';

export class TraceInputError extends Error {
  readonly kind: TraceInputErrorKind;

  constructor(message: string, kind: TraceInputErrorKind = 'malformed') {
    super(message);
    this.name = 'TraceInputError';
    this.kind = kind;
  }
}
