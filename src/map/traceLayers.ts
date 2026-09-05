/**
 * NORD TRACE — trace rendering.
 *
 * MapLibre GeoJSON sources + a registered canvas chevron for direction
 * ticks. Four line layers (glow / casing / base / progress) built once
 * per trace; playback mutates ONE progress source per tick — no layer
 * rebuilds, so large traces stay smooth. Elevation shading swaps the
 * base stroke for a line-progress gradient when a mode asks for it.
 */

import type {
  ExpressionSpecification,
  GeoJSONSource,
  LngLatBoundsLike,
  LineLayerSpecification,
  Map as MapLibreMap,
} from 'maplibre-gl';
import { PALETTE } from './style';
import type { Trace } from '../core/types';

export const TRACE_SOURCE = 'nord-trace-route';
export const PROGRESS_SOURCE = 'nord-trace-progress';
export const TICKS_SOURCE = 'nord-trace-ticks';
export const TICKS_LAYER = 'ticks-line';

const LINE_LAYERS = ['trace-glow', 'trace-casing', 'trace-base', 'trace-progress'] as const;

export interface TraceLayerSet {
  setProgressFraction(fraction: number): void;
  setVisible(visible: boolean): void;
  setEmphasis(emphasis: number): void;
  setElevationTint(on: boolean): void;
  fit(map: MapLibreMap, padding?: number): void;
  dispose(): void;
}

function emptyLineFeature(): GeoJSON.Feature {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: [] },
  };
}

export function addTraceLayers(
  map: MapLibreMap,
  trace: Trace,
  options?: { emphasis?: number },
): TraceLayerSet {
  const coords: [number, number][] = trace.points.map((p) => [p.lon, p.lat]);
  const hasElevation =
    trace.stats.minElevation !== null &&
    trace.stats.maxElevation !== null &&
    trace.stats.maxElevation !== trace.stats.minElevation;
  const emphasis = clamp01(options?.emphasis ?? 0.6);

  map.addSource(TRACE_SOURCE, {
    type: 'geojson',
    lineMetrics: true,
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    },
  });
  map.addSource(PROGRESS_SOURCE, {
    type: 'geojson',
    data: emptyLineFeature(),
  });

  // Direction ticks — technical cartography chevrons along the base line.
  map.addSource(TICKS_SOURCE, {
    type: 'geojson',
    data: ticksFeatureCollection(coords),
  });

  map.addLayer({
    id: 'trace-glow',
    type: 'line',
    source: TRACE_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': PALETTE.traceEmber,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 5, 12, 8, 16, 16],
      'line-blur': ['interpolate', ['linear'], ['zoom'], 8, 6, 16, 14],
      'line-opacity': 0.35 * opacityFromEmphasis(emphasis),
    },
  });

  map.addLayer({
    id: 'trace-casing',
    type: 'line',
    source: TRACE_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#000000',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3.4, 12, 5, 16, 9],
      'line-opacity': 0.55,
    },
  });

  const basePaint: LineLayerSpecification['paint'] = {
    'line-color': PALETTE.trace,
    'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 2.4, 16, 4],
    'line-opacity': 0.42 * opacityFromEmphasis(emphasis),
  };
  map.addLayer({
    id: 'trace-base',
    type: 'line',
    source: TRACE_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: basePaint,
  });
  map.addLayer({
    id: 'trace-progress',
    type: 'line',
    source: PROGRESS_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': PALETTE.trace,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8, 2.2 + emphasis,
        12, 3.2 + emphasis * 1.2,
        16, 5.2 + emphasis * 1.6,
      ],
      'line-opacity': 1,
    },
  });

  map.addLayer({
    id: TICKS_LAYER,
    type: 'symbol',
    source: TICKS_SOURCE,
    minzoom: 11,
    layout: {
      'icon-image': 'tick-chev',
      'icon-rotate': ['get', 'bearing'],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-padding': 2,
    },
    paint: {
      'icon-opacity': 0.5,
    },
  });

  registerChevronIcon(map);

  let currentIndex = -1;
  const setProgressFraction = (fraction: number): void => {
    const idx = Math.max(1, Math.round(clamp01(fraction) * (coords.length - 1)));
    if (idx === currentIndex) return;
    currentIndex = idx;
    const src = map.getSource(PROGRESS_SOURCE) as GeoJSONSource | undefined;
    if (!src) return;
    // Reveal through the actual geometry so the stroke hugs the route.
    const line = coords.slice(0, idx + 1);
    src.setData(
      line.length >= 2
        ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }
        : emptyLineFeature(),
    );
  };

  const setVisible = (visible: boolean): void => {
    const visibility = visible ? 'visible' : 'none';
    for (const id of [...LINE_LAYERS, TICKS_LAYER]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
    }
  };

  return {
    setProgressFraction,
    setVisible,
    setEmphasis(value: number) {
      const e = clamp01(value);
      if (map.getLayer('trace-glow')) {
        map.setPaintProperty('trace-glow', 'line-opacity', 0.35 * opacityFromEmphasis(e));
      }
      if (map.getLayer('trace-base')) {
        map.setPaintProperty('trace-base', 'line-opacity', 0.42 * opacityFromEmphasis(e));
      }
      if (map.getLayer('trace-progress')) {
        map.setPaintProperty('trace-progress', 'line-width', [
          'interpolate', ['linear'], ['zoom'],
          8, 2.2 + e,
          12, 3.2 + e * 1.2,
          16, 5.2 + e * 1.6,
        ]);
      }
    },
    setElevationTint(on: boolean) {
      if (!map.getLayer('trace-base')) return;
      if (on && hasElevation) {
        map.setPaintProperty('trace-base', 'line-color', elevationGradientExpression(trace));
      } else {
        map.setPaintProperty('trace-base', 'line-color', PALETTE.trace);
      }
    },
    fit(m: MapLibreMap, padding?: number) {
      const b: LngLatBoundsLike = [
        [trace.stats.bounds.minLon, trace.stats.bounds.minLat],
        [trace.stats.bounds.maxLon, trace.stats.bounds.maxLat],
      ];
      m.fitBounds(b, { padding: padding ?? 72, duration: 1100, maxZoom: 15 });
    },
    dispose() {
      for (const id of [TICKS_LAYER, ...LINE_LAYERS]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of [TICKS_SOURCE, PROGRESS_SOURCE, TRACE_SOURCE]) {
        if (map.getSource(id)) map.removeSource(id);
      }
    },
  };
}

function ticksFeatureCollection(coords: [number, number][], maxTicks = 80): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (coords.length < 2) return { type: 'FeatureCollection', features };
  const total = coords.length - 1;
  const spacing = Math.max(1, Math.floor(total / maxTicks));
  for (let i = 0; i < total; i += spacing) {
    const a = coords[i];
    const b = coords[Math.min(i + 1, total)];
    const bearingDeg = (Math.atan2(b[0] - a[0], b[1] - a[1]) * (180 / Math.PI) + 360) % 360;
    features.push({
      type: 'Feature',
      properties: { bearing: bearingDeg },
      geometry: { type: 'LineString', coordinates: [a, a] },
    });
  }
  return { type: 'FeatureCollection', features };
}

function registerChevronIcon(map: MapLibreMap): void {
  if (map.hasImage('tick-chev')) return;
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(242, 241, 236, 0.9)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Chevron pointing north (−Y in image space); icon-rotate aligns to travel.
  ctx.moveTo(size / 2 - 5, size / 2 + 4);
  ctx.lineTo(size / 2, size / 2 - 4);
  ctx.lineTo(size / 2 + 5, size / 2 + 4);
  ctx.stroke();
  const data = ctx.getImageData(0, 0, size, size);
  map.addImage('tick-chev', data, { pixelRatio: 2 });
}

/** Elevation as a line-progress gradient: cold blue valleys → off-white peaks. */
function elevationGradientExpression(trace: Trace): ExpressionSpecification {
  const points = trace.points;
  const elevations: number[] = [];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    const e = p.elevation ?? 0;
    elevations.push(e);
    if (e < min) min = e;
    if (e > max) max = e;
  }
  const span = max - min || 1;
  // Canonical ['interpolate', ['linear'], ['line-progress'], ...] shape.
  const stops: unknown[] = ['interpolate', ['linear'], ['line-progress']];
  const steps = 8;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const idx = Math.min(elevations.length - 1, Math.round(t * (elevations.length - 1)));
    const e = (elevations[idx] - min) / span;
    stops.push(t, elevationColor(e));
  }
  return stops as unknown as ExpressionSpecification;
}

/** Cold blue → off-white ramp, restrained. */
function elevationColor(t: number): string {
  const cold = [110, 146, 178];
  const warm = [242, 241, 236];
  const c = cold.map((v, i) => Math.round(v + (warm[i] - v) * clamp01(t)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function opacityFromEmphasis(emphasis: number): number {
  return 0.55 + 0.45 * clamp01(emphasis);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
