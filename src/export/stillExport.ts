/**
 * NORD TRACE — still export.
 *
 * Composites the current map frame (WebGL canvas, preserveDrawingBuffer
 * enabled at map creation) with a typographic credit strip — trace
 * name, coordinates, distance, NORD TRACE attribution, and the
 * required OpenFreeMap/OpenMapTiles/OpenStreetMap credit — onto an
 * offscreen canvas in the chosen aspect ratio. The route overlay
 * (glow/progress/labels) is redrawn vectorially in 2D over the frame
 * so the exported composition matches the on-screen one.
 */

import type { Trace } from '../core/types';
import { formatCoordinate, formatDistance } from '../core/formatters';

export type ExportAspect = '16:9' | '9:16' | '1:1';

export interface ExportOptions {
  trace: Trace;
  /** The live map canvas (WebGL), already at the composed camera state. */
  mapCanvas: HTMLCanvasElement;
  aspect: ExportAspect;
  /** Long-edge pixel size of the output. */
  longEdge?: number;
  /** Current progress 0..1 for partial-reveal redraw. */
  fraction: number;
  /** Projects lon/lat onto map-canvas pixel coordinates (map.project). */
  project: (lon: number, lat: number) => { x: number; y: number };
}

const FONT = '-apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif';

export async function exportStill(options: ExportOptions): Promise<Blob> {
  const { mapCanvas, aspect } = options;
  const longEdge = options.longEdge ?? 1920;
  const [w, h] = sizeFor(aspect, longEdge);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Still export is unavailable in this browser.');

  // Letterbox-fit the map frame into the target aspect (cover-crop).
  const scale = Math.max(w / mapCanvas.width, h / mapCanvas.height);
  const dw = mapCanvas.width * scale;
  const dh = mapCanvas.height * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;

  ctx.fillStyle = '#050607';
  ctx.fillRect(0, 0, w, h);
  try {
    ctx.drawImage(mapCanvas, dx, dy, dw, dh);
  } catch {
    throw new Error(
      'The map frame could not be captured (tile security restrictions). Try again after the map finishes loading.',
    );
  }

  // Vignette for typographic legibility, matching the on-screen treatment.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.36, w / 2, h / 2, Math.max(w, h) * 0.72);
  vig.addColorStop(0, 'rgba(5, 6, 7, 0)');
  vig.addColorStop(1, 'rgba(5, 6, 7, 0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  drawRouteOverlay(ctx, options, dx, dy, scale);

  drawTypeBlock(ctx, options, w, h);

  return await new Promise<Blob>((resolve, reject) => {
    out.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed.'));
    }, 'image/png');
  });
}

function sizeFor(aspect: ExportAspect, longEdge: number): [number, number] {
  switch (aspect) {
    case '16:9':
      return [longEdge, Math.round((longEdge * 9) / 16)];
    case '9:16':
      return [Math.round((longEdge * 9) / 16), longEdge];
    case '1:1':
      return [longEdge, longEdge];
  }
}

/** Redraw glow + progress + endpoints in 2D, projected from the trace model. */
function drawRouteOverlay(
  ctx: CanvasRenderingContext2D,
  options: ExportOptions,
  dx: number,
  dy: number,
  scale: number,
): void {
  const { trace, fraction } = options;

  const project = options.project;
  const pts = trace.points.map((p) => project(p.lon, p.lat));
  const toOut = (pt: { x: number; y: number }): { x: number; y: number } => ({
    x: pt.x * scale + dx,
    y: pt.y * scale + dy,
  });

  const headIdx = Math.max(1, Math.round(fraction * (trace.points.length - 1)));
  const projected = pts.map(toOut);

  // glow pass
  strokePath(ctx, projected, 8, 'rgba(143, 178, 206, 0.30)');
  // base pass
  strokePath(ctx, projected, 2.4, 'rgba(242, 241, 236, 0.45)');
  // progress pass
  strokePath(ctx, projected.slice(0, headIdx + 1), 3.4, 'rgba(242, 241, 236, 0.98)');

  // endpoints
  dot(ctx, projected[0], '#F2F1EC', 3.2);
  dot(ctx, projected[projected.length - 1], '#F2F1EC', 3.2);

  // current position
  dot(ctx, projected[headIdx], '#FFFFFF', 4.2);
}

function strokePath(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  width: number,
  color: string,
): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, color: string, r: number): void {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(5, 6, 7, 0.9)';
  ctx.stroke();
}

function drawTypeBlock(
  ctx: CanvasRenderingContext2D,
  options: ExportOptions,
  w: number,
  h: number,
): void {
  const { trace, fraction } = options;
  const pad = Math.round(Math.min(w, h) * 0.055);
  const base = Math.max(13, Math.round(Math.min(w, h) * 0.017));

  ctx.textBaseline = 'alphabetic';

  // Trace name — editorial lead.
  ctx.fillStyle = '#F2F1EC';
  ctx.font = `600 ${Math.round(base * 1.7)}px ${FONT}`;
  ctx.letterSpacing = '0.06em';
  ctx.fillText(trace.name.toUpperCase(), pad, pad + base * 1.7);

  // Coordinates line.
  const first = trace.points[0];
  ctx.fillStyle = 'rgba(232, 230, 223, 0.62)';
  ctx.font = `400 ${Math.round(base * 0.86)}px ${FONT}`;
  ctx.letterSpacing = '0.14em';
  ctx.fillText(formatCoordinate(first.lat, first.lon).toUpperCase(), pad, pad + base * 3.1);

  // Bottom-left: distance + progress.
  const bottom = h - pad;
  ctx.fillStyle = '#F2F1EC';
  ctx.font = `600 ${Math.round(base * 1.15)}px ${FONT}`;
  ctx.letterSpacing = '0.1em';
  ctx.fillText(
    `${formatDistance(trace.stats.totalDistance).toUpperCase()}  ·  ${Math.round(fraction * 100)}%`,
    pad,
    bottom,
  );

  // Bottom-right: attribution (required) + brand.
  ctx.textAlign = 'right';
  ctx.font = `400 ${Math.round(base * 0.72)}px ${FONT}`;
  ctx.letterSpacing = '0.08em';
  ctx.fillStyle = 'rgba(232, 230, 223, 0.5)';
  ctx.fillText('© OpenMapTiles © OpenStreetMap', w - pad, bottom - base * 1.6);
  ctx.fillStyle = 'rgba(242, 241, 236, 0.85)';
  ctx.font = `600 ${Math.round(base * 0.8)}px ${FONT}`;
  ctx.fillText('NORD TRACE', w - pad, bottom);
  ctx.textAlign = 'left';
}
