/**
 * NORD TRACE — elevation profile.
 *
 * A hairline area chart in SVG, no charting library. Represents the
 * whole route; a thin cursor tracks playback and follows scrubbing.
 * Understated by design: one line, one fill, one cursor.
 */

import type { Trace } from '../core/types';

export interface ElevationProfile {
  element: SVGElement;
  setProgress(fraction: number): void;
}

/** Number of horizontal bins for the profile (downsamples long traces). */
const BINS = 140;

export function createElevationProfile(trace: Trace): ElevationProfile {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svgEl = document.createElementNS(svgNS, 'svg');
  svgEl.setAttribute('class', 'nt-elev-svg');
  svgEl.setAttribute('preserveAspectRatio', 'none');
  svgEl.setAttribute('aria-hidden', 'true');

  const W = 600;
  const H = 96;
  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const values = trace.points.map((p) => p.elevation);
  const distances = trace.points.map((p) => p.distanceFromStart);
  const totalDistance = trace.stats.totalDistance || 1;

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v == null) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = Math.max(max - min, 8);

  // Bin by distance so the shape is honest for uneven sampling.
  const bins: number[] = new Array(BINS).fill(min);
  const binHas: boolean[] = new Array(BINS).fill(false);
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i];
    if (v == null) continue;
    const bin = Math.min(BINS - 1, Math.floor((distances[i] / totalDistance) * BINS));
    if (!binHas[bin] || v > bins[bin]) {
      bins[bin] = v;
      binHas[bin] = true;
    }
  }

  const y = (v: number): number => H - 6 - ((v - min) / range) * (H - 14);

  const areaPts: string[] = [`0,${H}`];
  const linePts: string[] = [];
  for (let i = 0; i < BINS; i += 1) {
    if (!binHas[i]) continue;
    const x = (i / (BINS - 1)) * W;
    linePts.push(`${x.toFixed(1)},${y(bins[i]).toFixed(1)}`);
  }
  // Close the area along the top edge only where data exists.
  const areaLine = linePts.length > 0 ? linePts : [`0,${y(min)}`, `${W},${y(min)}`];
  areaPts.push(...areaLine);
  areaPts.push(`${W},${H}`);

  const area = document.createElementNS(svgNS, 'polygon');
  area.setAttribute('points', areaPts.join(' '));
  area.setAttribute('class', 'nt-elev-area');

  const line = document.createElementNS(svgNS, 'polyline');
  line.setAttribute('points', areaLine.join(' '));
  line.setAttribute('class', 'nt-elev-line');

  const cursor = document.createElementNS(svgNS, 'line');
  cursor.setAttribute('class', 'nt-elev-cursor');
  cursor.setAttribute('y1', '4');
  cursor.setAttribute('y2', String(H - 2));
  cursor.setAttribute('x1', '0');
  cursor.setAttribute('x2', '0');

  svgEl.appendChild(area);
  svgEl.appendChild(line);
  svgEl.appendChild(cursor);

  return {
    element: svgEl,
    setProgress(fraction: number) {
      const x = Math.max(0, Math.min(1, fraction)) * W;
      cursor.setAttribute('x1', x.toFixed(1));
      cursor.setAttribute('x2', x.toFixed(1));
    },
  };
}
