/**
 * NORD TRACE — camera choreography.
 *
 * Three camera programs over MapLibre: OVERVIEW holds the composed
 * frame; FOLLOW tracks the trace point with a soft settle-in;
 * CINEMATIC adds slow bearing drift toward the travel direction and a
 * gentle mid-route zoom arc. All movement is eased, damped and
 * clamped — the camera never snaps, never spins, and respects reduced
 * motion (pan-only, never rotate).
 */

import type { Map as MapLibreMap } from 'maplibre-gl';
import { bearingDelta } from '../core/geodesic';

export type CameraMode = 'overview' | 'follow' | 'cinematic';

export interface CameraFrameInput {
  lat: number;
  lon: number;
  /** Travel heading in degrees, or null when unknown/stationary. */
  heading: number | null;
  /** True while playback is running. */
  isPlaying: boolean;
  /** Normalized progress 0..1 (drives the cinematic zoom arc). */
  progress: number;
}

const FOLLOW_ZOOM = 14.2;
const CINEMATIC_ZOOM_NEAR = 14.6;
const CINEMATIC_ZOOM_FAR = 11.8;

export class CameraRig {
  private cameraMode: CameraMode = 'overview';
  private reducedMotion: boolean;
  /** Smoothed camera bearing in degrees. */
  private currentBearing = 0;
  private initialized = false;
  private readonly map: MapLibreMap;

  constructor(map: MapLibreMap, options?: { reducedMotion?: boolean }) {
    this.map = map;
    this.reducedMotion = options?.reducedMotion ?? false;
  }

  get mode(): CameraMode {
    return this.cameraMode;
  }

  setMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.initialized = false;
    if (mode === 'overview') {
      this.currentBearing = this.map.getBearing();
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  /**
   * Called each animation tick. Follow/cinematic adjust the camera
   * directly — no flyTo tweens; the tick loop IS the tween.
   */
  update(frame: CameraFrameInput): void {
    if (this.cameraMode === 'overview') return;
    if (this.reducedMotion) {
      this.updateReduced(frame);
      return;
    }
    if (this.cameraMode === 'follow') this.updateFollow(frame);
    else this.updateCinematic(frame);
  }

  /** Reduced motion: pan gently to keep the point in view, never rotate. */
  private updateReduced(frame: CameraFrameInput): void {
    const center = this.map.getCenter();
    const dx = frame.lon - center.lng;
    const dy = frame.lat - center.lat;
    if (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6) {
      this.map.setCenter({ lng: center.lng + dx * 0.04, lat: center.lat + dy * 0.04 });
    }
  }

  private updateFollow(frame: CameraFrameInput): void {
    if (!this.initialized) {
      this.initialized = true;
      this.currentBearing = this.map.getBearing();
      const zoom = Math.min(this.map.getZoom() + 0.5, FOLLOW_ZOOM);
      this.map.easeTo({
        center: [frame.lon, frame.lat],
        zoom,
        duration: 900,
        easing: easeOutCubic,
      });
      return;
    }
    // After the settle-in, ride the point directly.
    if (!this.map.isMoving()) {
      this.map.setCenter([frame.lon, frame.lat]);
      const z = this.map.getZoom();
      if (z < FOLLOW_ZOOM - 0.05) this.map.setZoom(z + 0.002);
    }
  }

  private updateCinematic(frame: CameraFrameInput): void {
    if (!this.initialized) {
      this.initialized = true;
      this.currentBearing = this.map.getBearing();
    }

    if (!this.map.isMoving()) {
      this.map.setCenter([frame.lon, frame.lat]);
    }

    // Zoom arc: settle in close, drift out across the middle, return.
    if (frame.isPlaying) {
      const z = this.map.getZoom();
      const target =
        CINEMATIC_ZOOM_NEAR -
        (CINEMATIC_ZOOM_NEAR - CINEMATIC_ZOOM_FAR) *
          (Math.sin(Math.PI * clamp01(frame.progress)) ** 1.5) *
          arcWeight(frame.progress);
      const next = z + (target - z) * 0.02;
      this.map.setZoom(next);
    }

    // Bearing drifts toward travel direction, heavily damped, never violent.
    if (frame.heading != null) {
      const delta = bearingDelta(this.currentBearing, frame.heading);
      this.currentBearing = (this.currentBearing + delta * 0.012 + 360) % 360;
      const mapBearing = this.map.getBearing();
      const mapDelta = bearingDelta(mapBearing, this.currentBearing);
      this.map.setBearing(mapBearing + mapDelta * 0.06);
    }
  }

  /** Fly the camera to the full-route frame (load, mode switch, restart). */
  frameRoute(bounds: {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
  }): void {
    this.initialized = false;
    this.map.fitBounds(
      [
        [bounds.minLon, bounds.minLat],
        [bounds.maxLon, bounds.maxLat],
      ],
      { padding: padFor(this.map), duration: 1200, maxZoom: 15 },
    );
    this.currentBearing = 0;
  }
}

/** No zoom-out during the first seconds or the final approach. */
function arcWeight(progress: number): number {
  if (progress < 0.08 || progress > 0.96) return 0;
  return Math.min(1, (progress - 0.08) / 0.12) * Math.min(1, (0.96 - progress) / 0.1);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function padFor(map: MapLibreMap): number {
  const rect = map.getCanvas().getBoundingClientRect();
  const min = Math.min(rect.width, rect.height);
  return Math.max(56, Math.min(140, min * 0.18));
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}
