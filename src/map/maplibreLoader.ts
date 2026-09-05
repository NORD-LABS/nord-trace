/**
 * NORD TRACE — lazy MapLibre loader.
 *
 * MapLibre is the heaviest dependency and is useless before a trace
 * exists, so it is imported dynamically on first load. Keeps the
 * initial bundle small (see docs/architecture.md — performance).
 */

let cached: typeof import('maplibre-gl') | null = null;

export async function loadMapLibre(): Promise<typeof import('maplibre-gl')> {
  if (cached) return cached;
  const lib = await import('maplibre-gl');
  await import('maplibre-gl/dist/maplibre-gl.css');
  cached = lib;
  return lib;
}
