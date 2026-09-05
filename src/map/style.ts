/**
 * NORD TRACE — map style.
 *
 * A bespoke dark vector style built on the OpenMapTiles schema served
 * by OpenFreeMap's public instance. Chosen over the stock "dark"
 * style: full control of the palette so land reads as near-black
 * paper, roads as hairlines, and the trace is always the brightest
 * element. OpenFreeMap is free without keys or view limits and
 * explicitly permits commercial use; attribution (OpenMapTiles /
 * OpenStreetMap) is shown in the UI and preserved in exports.
 */

import type { StyleSpecification } from 'maplibre-gl';

export const OFM_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const OFM_SPRITE = 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm';
export const OFM_TILES = 'https://tiles.openfreemap.org/planet';

/** NORD TRACE palette — single source of truth, mirrored in CSS tokens. */
export const PALETTE = {
  background: '#050607',
  water: '#080B0F',
  waterLine: '#0D1218',
  land: '#050607',
  urban: '#090B0E',
  green: '#070A08',
  roadMinor: '#14161B',
  roadMajor: '#1B1E25',
  roadRail: '#15181E',
  building: '#0A0C10',
  label: '#4C545E',
  labelDim: '#3A414A',
  trace: '#F2F1EC',
  traceEmber: '#8FB2CE',
  traceSoft: 'rgba(143, 178, 206, 0.28)',
} as const;

export function buildNordTraceStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'NORD TRACE Dark',
    glyphs: OFM_GLYPHS,
    sprite: OFM_SPRITE,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: OFM_TILES,
      },
    },
    light: { anchor: 'viewport', color: '#ffffff', intensity: 0.12 },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': PALETTE.background },
      },

      // --- Land cover: barely-there texture, never decoration.
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['all', ['==', ['get', 'class'], 'wood'], ['==', ['geometry-type'], 'Polygon']],
        paint: { 'fill-color': PALETTE.green, 'fill-opacity': 0.9 },
      },
      {
        id: 'landuse-urban',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: ['all', ['==', ['get', 'class'], 'residential'], ['==', ['geometry-type'], 'Polygon']],
        paint: { 'fill-color': PALETTE.urban, 'fill-opacity': 0.85 },
      },

      // --- Water: a slightly colder black with a faint shoreline.
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': PALETTE.water },
      },
      {
        id: 'water-shadow',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'line-color': PALETTE.waterLine, 'line-width': 0.6 },
      },
      {
        id: 'water-rivers',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': PALETTE.waterLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 1.6] },
      },

      // --- Buildings: implicit mass, one step above ground.
      {
        id: 'buildings',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 12,
        paint: { 'fill-color': PALETTE.building },
      },

      // --- Roads: a hierarchy of hairlines.
      {
        id: 'road-rail',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'rail'],
        paint: { 'line-color': PALETTE.roadRail, 'line-width': 0.5 },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track', 'pedestrian', 'path', 'footway', 'cycleway']]],
        ],
        minzoom: 10,
        paint: {
          'line-color': PALETTE.roadMinor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 0.8, 16, 1.6],
        },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]],
        ],
        paint: {
          'line-color': PALETTE.roadMajor,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 10, 0.9, 14, 1.8, 16, 3],
        },
      },

      // --- Labels: sparse, dim, typographic. The route outshines them.
      {
        id: 'place-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'country', 'state']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 10, 12],
          'text-letter-spacing': 0.22,
          'text-transform': 'uppercase',
          'text-max-width': 7,
        },
        paint: {
          'text-color': PALETTE.label,
          'text-halo-color': PALETTE.background,
          'text-halo-width': 1,
        },
      },
      {
        id: 'water-label',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Italic'],
          'text-size': 10,
          'text-letter-spacing': 0.18,
          'symbol-placement': 'line',
        },
        paint: {
          'text-color': PALETTE.labelDim,
          'text-halo-color': PALETTE.background,
          'text-halo-width': 0.8,
        },
      },
    ],
  };
}
