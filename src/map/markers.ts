/**
 * NORD TRACE — map markers.
 *
 * Restrained endpoint treatment (small ringed dots) and the current
 * position marker: a bright dot with a soft pulse during playback.
 * DOM elements over the map — cheap, crisp, styleable. Receives the
 * lazily-loaded MapLibre module so this module stays out of the
 * initial bundle.
 */

import type { Marker, Map as MapLibreMap } from 'maplibre-gl';

export interface TraceMarkers {
  setStartEnd(start: [number, number], end: [number, number]): void;
  setCurrent(coords: [number, number], playing: boolean): void;
  dispose(): void;
}

export function addTraceMarkers(
  maplibre: { Marker: typeof Marker },
  map: MapLibreMap,
): TraceMarkers {
  const startEl = document.createElement('div');
  startEl.className = 'nt-marker nt-marker-endpoint';
  const endEl = document.createElement('div');
  endEl.className = 'nt-marker nt-marker-endpoint nt-marker-end';
  const currentEl = document.createElement('div');
  currentEl.className = 'nt-marker nt-marker-current';

  const start = new maplibre.Marker({ element: startEl, anchor: 'center' }).setLngLat([0, 0]).addTo(map);
  const end = new maplibre.Marker({ element: endEl, anchor: 'center' }).setLngLat([0, 0]).addTo(map);
  const current = new maplibre.Marker({ element: currentEl, anchor: 'center' }).setLngLat([0, 0]).addTo(map);

  return {
    setStartEnd(startCoords, endCoords) {
      start.setLngLat(startCoords);
      end.setLngLat(endCoords);
    },
    setCurrent(coords, playing) {
      current.setLngLat(coords);
      currentEl.classList.toggle('is-playing', playing);
    },
    dispose() {
      start.remove();
      end.remove();
      current.remove();
    },
  };
}
