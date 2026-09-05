/**
 * NORD TRACE — the map runtime.
 *
 * Owns the MapLibre instance, style, trace layers and camera rig.
 * Created lazily on first trace load; exposes small, explicit
 * operations to the app shell. Renders nothing else — UI belongs to
 * the workspace.
 */

import { loadMapLibre } from './maplibreLoader';
import { buildNordTraceStyle } from './style';
import { addTraceLayers, type TraceLayerSet } from './traceLayers';
import { addTraceMarkers, type TraceMarkers } from './markers';
import { CameraRig, type CameraMode } from './camera';
import type { Trace } from '../core/types';

export interface TraceMap {
  setTrace(trace: Trace): void;
  setProgress(fraction: number, lon: number, lat: number, heading: number | null, playing: boolean): void;
  setCameraMode(mode: CameraMode): void;
  getCameraMode(): CameraMode;
  setTraceVisible(visible: boolean): void;
  setEmphasis(emphasis: number): void;
  setElevationTint(on: boolean): void;
  frameRoute(): void;
  resize(): void;
  getCanvas(): HTMLCanvasElement | null;
  /** Project lon/lat to CSS-pixel coordinates in the map container. */
  project(lon: number, lat: number): { x: number; y: number };
  ready(): Promise<void>;
  dispose(): void;
}

export interface TraceMapOptions {
  container: HTMLElement;
  reducedMotion: boolean;
}

export async function createTraceMap(options: TraceMapOptions): Promise<TraceMap> {
  const maplibre = await loadMapLibre();

  const map = new maplibre.Map({
    container: options.container,
    style: buildNordTraceStyle(),
    center: [-71.208, 46.8139],
    zoom: 10.5,
    attributionControl: false,
    dragRotate: true,
    fadeDuration: 180,
    // Required for still export: keeps the WebGL buffer readable
    // after compositing so toBlob() sees the current frame.
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });

  // Required attribution for OpenFreeMap / OpenMapTiles / OpenStreetMap.
  map.addControl(
    new maplibre.AttributionControl({ compact: true }),
    'bottom-right',
  );

  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Map failed to load within 20 s. Check your connection and reload.'));
    }, 20_000);
    map.on('load', () => {
      clearTimeout(timeout);
      resolve();
    });
    // Tile/style resource errors are logged, never fatal.
    map.on('error', (e) => {
      console.warn('[nord-trace] map resource error', e.error?.message ?? e);
    });
  });

  const rig = new CameraRig(map, { reducedMotion: options.reducedMotion });
  let layers: TraceLayerSet | null = null;
  let markers: TraceMarkers | null = null;
  let currentTrace: Trace | null = null;

  return {
    setTrace(trace: Trace) {
      currentTrace = trace;
      if (layers) {
        layers.dispose();
        layers = null;
      }
      if (markers) {
        markers.dispose();
        markers = null;
      }
      layers = addTraceLayers(map, trace, { emphasis: 0.6 });
      markers = addTraceMarkers(maplibre, map);
      const first = trace.points[0];
      const last = trace.points[trace.points.length - 1];
      markers.setStartEnd([first.lon, first.lat], [last.lon, last.lat]);
      layers.setProgressFraction(0);
      markers.setCurrent([first.lon, first.lat], false);
      if (rig.mode !== 'overview') {
        rig.setMode('overview');
      }
      rig.frameRoute(trace.stats.bounds);
    },

    setProgress(fraction, lon, lat, heading, playing) {
      layers?.setProgressFraction(fraction);
      markers?.setCurrent([lon, lat], playing);
      rig.update({ lat, lon, heading, isPlaying: playing, progress: fraction });
    },

    setCameraMode(mode) {
      rig.setMode(mode);
      if (mode === 'overview' && currentTrace) {
        rig.frameRoute(currentTrace.stats.bounds);
      }
    },

    getCameraMode: () => rig.mode,

    setTraceVisible(visible) {
      layers?.setVisible(visible);
    },

    setEmphasis(emphasis) {
      layers?.setEmphasis(emphasis);
    },

    setElevationTint(on) {
      layers?.setElevationTint(on);
    },

    frameRoute() {
      if (currentTrace) rig.frameRoute(currentTrace.stats.bounds);
    },

    resize() {
      map.resize();
    },

    getCanvas() {
      return map.getCanvas();
    },

    project(lon, lat) {
      const p = map.project([lon, lat]);
      return { x: p.x, y: p.y };
    },

    ready: () => ready,
    dispose() {
      layers?.dispose();
      markers?.dispose();
      map.remove();
    },
  };
}
