/**
 * NORD TRACE — application state.
 *
 * A tiny explicit store: one mutable state object, immutable patches,
 * subscriber notification. No framework. Playback progress is NOT in
 * here — it lives in the PlaybackEngine, its single source of truth.
 */

import type { Trace } from '../core/types';
import type { CameraMode } from '../map/camera';
import type { ProductMode } from '../modes/modes';
import { MODES } from '../modes/modes';
import type { PlaybackSpeed } from '../playback/engine';

export interface AppSettings {
  /** Show the telemetry strip. */
  telemetry: boolean;
  /** Show the elevation profile (when elevation exists). */
  elevationProfile: boolean;
  /** Route visibility. */
  routeVisible: boolean;
  /** 0..1 route emphasis. */
  emphasis: number;
}

export interface AppState {
  trace: Trace | null;
  mode: ProductMode;
  camera: CameraMode;
  speed: PlaybackSpeed;
  settings: AppSettings;
  /** Fullscreen presentation mode. */
  presentation: boolean;
  /** While a file is parsing/loading. */
  loading: boolean;
}

export type AppStateListener = (state: AppState) => void;

const initialSettings: AppSettings = {
  telemetry: true,
  elevationProfile: true,
  routeVisible: true,
  emphasis: 0.6,
};

export class AppStore {
  private state: AppState = {
    trace: null,
    mode: 'journey',
    camera: 'overview',
    speed: 1,
    settings: { ...initialSettings },
    presentation: false,
    loading: false,
  };

  private listeners = new Set<AppStateListener>();

  get(): AppState {
    return this.state;
  }

  set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  setSettings(patch: Partial<AppSettings>): void {
    this.set({ settings: { ...this.state.settings, ...patch } });
  }

  /** Applying a product mode also applies its default camera. */
  setMode(mode: ProductMode): void {
    const profile = MODES[mode];
    this.set({ mode, camera: profile.camera });
  }

  subscribe(listener: AppStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
