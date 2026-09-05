/**
 * NORD TRACE — application controller.
 *
 * Wires the store, playback engine, trace map and views. The playback
 * engine remains the single source of truth for progress: every UI
 * element (transport, telemetry, HUD, elevation cursor, markers) reads
 * from its tick events. Nothing else invents progress.
 */

import { AppStore } from './state';
import { importTraceFile, looksSupported } from './import';
import { PlaybackEngine } from '../playback/engine';
import type { PlaybackSpeed } from '../playback/engine';
import { createTraceMap, type TraceMap } from '../map/traceMap';
import { LandingView } from '../ui/landingView';
import { WorkspaceView } from '../ui/workspaceView';
import { toast } from '../ui/toast';
import { generateDemoTrace } from '../demo/demoTrace';
import { sampleAtFraction } from '../core/sample';
import { MODE_ORDER, MODES } from '../modes/modes';
import type { ProductMode } from '../modes/modes';
import { exportStill, type ExportAspect } from '../export/stillExport';
import type { CameraMode } from '../map/camera';
import type { Trace } from '../core/types';

const CAMERA_CYCLE: CameraMode[] = ['overview', 'follow', 'cinematic'];

export class AppController {
  private store = new AppStore();
  private engine: PlaybackEngine | null = null;
  private map: TraceMap | null = null;
  private mapPromise: Promise<TraceMap> | null = null;
  private landing: LandingView | null = null;
  private workspace: WorkspaceView | null = null;
  private reducedMotion: boolean;
  private dragDepth = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private rootEl: HTMLElement) {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
    });

    document.addEventListener('fullscreenchange', () => {
      // The map must be told its surface changed size.
      setTimeout(() => this.map?.resize(), 60);
    });

    this.showLanding();
  }

  // ---------------------------------------------------------------- landing

  private showLanding(): void {
    this.teardownWorkspace();
    this.rootEl.replaceChildren();

    this.landing = new LandingView({
      onFileSelected: (file) => void this.importFile(file),
      onDemo: () => this.loadDemo(),
    });
    this.rootEl.appendChild(this.landing.root);
    document.body.classList.remove('has-workspace');
  }

  private teardownWorkspace(): void {
    this.workspace?.dispose();
    this.workspace = null;
    this.engine?.dispose();
    this.engine = null;
    this.map?.dispose();
    this.map = null;
    this.mapPromise = null;
    this.detachKeyboard();
    document.body.classList.remove('is-presentation');
  }

  // ---------------------------------------------------------------- import

  private async importFile(file: File): Promise<void> {
    if (this.store.get().loading) return;
    this.landing?.setDragOver(false);
    this.dragDepth = 0;
    this.store.set({ loading: true });
    try {
      const trace = await importTraceFile(file);
      await this.enterWorkspace(trace);
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'TraceInputError'
          ? err.message
          : 'This file could not be read as a GPX or GeoJSON trace.';
      toast(message, 'error');
    } finally {
      this.store.set({ loading: false });
    }
  }

  private loadDemo(): void {
    try {
      const trace = generateDemoTrace();
      void this.enterWorkspace(trace);
    } catch {
      toast('The demo trace failed to build — please reload the page.', 'error');
    }
  }

  // ------------------------------------------------------------ workspace

  private async enterWorkspace(trace: Trace): Promise<void> {
    this.landing?.dispose();
    this.landing = null;
    this.rootEl.replaceChildren();

    this.workspace = new WorkspaceView(this.store, {
      onTogglePlay: () => this.engine?.toggle(),
      onRestart: () => this.restart(),
      onScrubStart: () => this.engine?.pause(),
      onScrub: (fraction) => this.engine?.seek(fraction),
      onScrubEnd: (fraction) => this.engine?.seek(fraction),
      onSpeedChange: (s) => {
        const speed = s as PlaybackSpeed;
        this.store.set({ speed });
        this.engine?.setSpeed(speed);
      },
      onPresent: () => this.togglePresentation(),
      onExport: () => void this.exportCurrentFrame(),
      onSettingsChanged: () => this.applySettings(),
      onImportAnother: () => this.showLanding(),
    });
    this.rootEl.appendChild(this.workspace.root);
    document.body.classList.add('has-workspace');
    this.attachKeyboard();

    this.workspace.configure(trace);
    this.workspace.setModeVoice();

    const modeProfile = MODES[this.store.get().mode];
    this.engine = new PlaybackEngine({
      durationSeconds: modeProfile.playbackSeconds,
      onTick: (snap) => this.handleTick(snap.fraction, snap.state === 'playing'),
      onComplete: () => {
        /* transport already reflects the paused state via onStateChange */
      },
      onStateChange: (next) => {
        this.workspace?.transport.setPlaying(next === 'playing');
      },
    });
    this.workspace.transport.setElapsedDuration(modeProfile.playbackSeconds);
    this.workspace.transport.setTotalDuration(modeProfile.playbackSeconds);
    this.workspace.transport.setSpeed(this.store.get().speed);

    this.store.set({ trace, presentation: false });

    await this.ensureMap(trace);
    this.applySettings();
    // Paint the initial frame (position, HUD, telemetry at 0).
    this.handleTick(0, false);
  }

  private async ensureMap(trace: Trace): Promise<void> {
    if (!this.workspace) return;
    if (!this.map) {
      try {
        if (!this.mapPromise) {
          this.mapPromise = createTraceMap({
            container: this.workspace.mapContainer,
            reducedMotion: this.reducedMotion,
          });
        }
        this.map = await this.mapPromise;
        await this.map.ready();
      } catch (err) {
        console.warn('[nord-trace] map init failed', err);
        toast('Map failed to load — check your connection. Statistics remain available.', 'error', 6000);
        this.map = null;
        this.mapPromise = null;
        return;
      }
    }
    this.map.setTrace(trace);
    this.map.resize();
  }

  private handleTick(fraction: number, playing: boolean): void {
    const trace = this.store.get().trace;
    if (!trace || !this.workspace) return;

    const sample = sampleAtFraction(trace, fraction);

    this.workspace.transport.setFraction(fraction);
    this.workspace.telemetry.durationHint = this.engine?.duration ?? 0;
    this.workspace.telemetry.update(sample, fraction);
    this.workspace.updateHud(sample);
    this.workspace.setElevationProgress(fraction);
    this.map?.setProgress(fraction, sample.lon, sample.lat, sample.heading, playing);
  }

  private restart(): void {
    this.engine?.restart();
    this.map?.frameRoute();
    this.handleTick(0, false);
  }

  private applySettings(): void {
    const state = this.store.get();
    const profile = MODES[state.mode];

    if (this.map) {
      this.map.setCameraMode(state.camera);
      this.map.setTraceVisible(state.settings.routeVisible);
      this.map.setEmphasis(state.settings.emphasis);
      this.map.setElevationTint(profile.elevationTint);
    }
    this.engine?.setDuration(profile.playbackSeconds);
    if (this.workspace) {
      this.workspace.transport.setElapsedDuration(profile.playbackSeconds);
      this.workspace.transport.setTotalDuration(profile.playbackSeconds);
      this.workspace.setModeVoice();
      if (state.trace) this.workspace.configure(state.trace);
    }
    this.workspace?.setDisclaimer(profile.disclaimer ?? null);
    // Re-emit current position so reconfigured UI shows live values.
    this.handleTick(this.engine?.snapshot.fraction ?? 0, false);
  }

  // ----------------------------------------------------------- drag & drop

  /**
   * Page-wide drop targets. The landing wires its own surface; the
   * workspace accepts drops anywhere over the app root.
   */
  attachRootDropHandlers(): void {
    const root = this.rootEl;
    root.addEventListener('dragenter', (e) => {
      e.preventDefault();
      this.dragDepth += 1;
      this.landing?.setDragOver(true);
    });
    root.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    root.addEventListener('dragleave', () => {
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      if (this.dragDepth === 0) this.landing?.setDragOver(false);
    });
    root.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dragDepth = 0;
      this.landing?.setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (!looksSupported(file.name)) {
        toast('Unsupported file type — drop a .gpx or .geojson trace.', 'error');
        return;
      }
      void this.importFile(file);
    });
  }

  // ------------------------------------------------------------- keyboard

  private attachKeyboard(): void {
    this.detachKeyboard();
    this.keyHandler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;

      switch (e.key) {
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          this.engine?.toggle();
          break;
        case 'r':
        case 'R':
          this.restart();
          break;
        case 'f':
        case 'F':
          this.togglePresentation();
          break;
        case 'e':
        case 'E':
          void this.exportCurrentFrame();
          break;
        case 'm':
        case 'M': {
          const current = this.store.get().mode;
          const next = MODE_ORDER[(MODE_ORDER.indexOf(current) + 1) % MODE_ORDER.length] as ProductMode;
          this.store.setMode(next);
          this.applySettings();
          break;
        }
        case 'c':
        case 'C': {
          const current = this.store.get().camera;
          const next = CAMERA_CYCLE[(CAMERA_CYCLE.indexOf(current) + 1) % CAMERA_CYCLE.length] as CameraMode;
          this.store.set({ camera: next });
          this.applySettings();
          break;
        }
        case 'Escape':
          if (this.store.get().presentation) this.togglePresentation();
          break;
        default:
          break;
      }
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  private detachKeyboard(): void {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  // ----------------------------------------------------------- presentation

  private togglePresentation(): void {
    const on = !this.store.get().presentation;
    this.store.set({ presentation: on });
    this.workspace?.setPresentation(on);
    document.body.classList.toggle('is-presentation', on);
    if (on) {
      const request = this.rootEl.requestFullscreen?.();
      if (request) {
        request.then(() => this.map?.resize()).catch(() => {
          toast('Fullscreen was blocked by the browser — in-window presentation is active.', 'info');
        });
      }
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    setTimeout(() => this.map?.resize(), 80);
  }

  // ---------------------------------------------------------------- export

  private async exportCurrentFrame(): Promise<void> {
    const state = this.store.get();
    const trace = state.trace;
    if (!trace || !this.workspace) return;

    const canvas = this.map?.getCanvas();
    if (!canvas) {
      toast('Still export needs the map — give it a moment to load.', 'error');
      return;
    }

    // Let the renderer settle so the WebGL buffer is complete.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const aspect = this.pickAspect();
    const ratio = canvas.clientWidth > 0 ? canvas.width / canvas.clientWidth : 1;
    try {
      const blob = await exportStill({
        trace,
        mapCanvas: canvas,
        aspect,
        fraction: this.engine?.snapshot.fraction ?? 0,
        project: (lon, lat) => {
          const p = this.map?.project(lon, lat) ?? { x: 0, y: 0 };
          return { x: p.x * ratio, y: p.y * ratio };
        },
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.exportFilename(trace, aspect);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`Still exported as ${aspect} PNG.`, 'success');
    } catch (err) {
      console.warn('[nord-trace] export failed', err);
      const msg = err instanceof Error ? err.message : 'Export failed.';
      toast(msg, 'error', 6000);
    }
  }

  private pickAspect(): ExportAspect {
    const h = window.innerHeight;
    const w = window.innerWidth;
    if (h > w) return '9:16';
    return '16:9';
  }

  private exportFilename(trace: Trace, aspect: ExportAspect): string {
    const slug =
      trace.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'trace';
    const stamp = new Date().toISOString().slice(0, 10);
    return `nord-trace_${slug}_${aspect.replace(':', 'x')}_${stamp}.png`;
  }
}
