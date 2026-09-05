/**
 * NORD TRACE — workspace shell (the loaded state).
 *
 * Owns the workspace DOM: header (wordmark, trace identity, mode
 * voice, settings), the map stage with corner ticks and HUD readout,
 * the telemetry strip, the elevation profile and the transport bar.
 * Composition lives here; behavior is delegated to the app controller.
 */

import { ICONS } from './icons';
import { TelemetryStrip } from './telemetry';
import { Transport } from './transport';
import { SettingsPanel } from './settingsPanel';
import { createElevationProfile, type ElevationProfile } from './elevationProfile';
import { formatHeading } from '../core/formatters';
import type { Trace } from '../core/types';
import { MODES } from '../modes/modes';

export interface WorkspaceCallbacks {
  onTogglePlay(): void;
  onRestart(): void;
  onScrubStart(): void;
  onScrub(fraction: number): void;
  onScrubEnd(fraction: number): void;
  onSpeedChange(speed: number): void;
  onPresent(): void;
  onExport(): void;
  onSettingsChanged(): void;
  onImportAnother(): void;
}

export class WorkspaceView {
  readonly root: HTMLDivElement;
  readonly mapContainer: HTMLDivElement;
  readonly telemetry: TelemetryStrip;
  /** Assigned in the constructor via transportRoot(); asserted with `!`. */
  transport!: Transport;
  readonly settings: SettingsPanel;

  private headerName: HTMLDivElement;
  private headerCoords: HTMLDivElement;
  private headerMode: HTMLDivElement;
  private hud: HTMLDivElement;
  private hudLat: HTMLSpanElement;
  private hudLon: HTMLSpanElement;
  private hudAlt: HTMLSpanElement;
  private hudHdg: HTMLSpanElement;
  private modeCaption: HTMLDivElement;
  private elevHost: HTMLDivElement;
  private elevProfile: ElevationProfile | null = null;
  private importButton: HTMLButtonElement;

  constructor(
    private store: import('../app/state').AppStore,
    callbacks: WorkspaceCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'nt-workspace';

    // ---- Header
    const header = document.createElement('header');
    header.className = 'nt-header';

    const brand = document.createElement('div');
    brand.className = 'nt-brand';
    const brandMark = document.createElement('span');
    brandMark.className = 'nt-brand-mark';
    brandMark.textContent = 'NORD TRACE';
    const brandOrg = document.createElement('span');
    brandOrg.className = 'nt-brand-org';
    brandOrg.textContent = 'NORD LABS';
    brand.appendChild(brandMark);
    brand.appendChild(brandOrg);

    const identity = document.createElement('div');
    identity.className = 'nt-identity';
    this.headerName = document.createElement('div');
    this.headerName.className = 'nt-trace-name';
    this.headerCoords = document.createElement('div');
    this.headerCoords.className = 'nt-trace-coords';
    identity.appendChild(this.headerName);
    identity.appendChild(this.headerCoords);

    const headerRight = document.createElement('div');
    headerRight.className = 'nt-header-right';

    this.headerMode = document.createElement('div');
    this.headerMode.className = 'nt-mode-voice';
    this.modeCaption = document.createElement('div');
    this.modeCaption.className = 'nt-mode-caption';

    const modeWrap = document.createElement('div');
    modeWrap.className = 'nt-mode-wrap';
    modeWrap.appendChild(this.headerMode);
    modeWrap.appendChild(this.modeCaption);

    this.settings = new SettingsPanel(store, callbacks.onSettingsChanged);
    this.importButton = document.createElement('button');
    this.importButton.type = 'button';
    this.importButton.className = 'nt-btn nt-btn-text';
    this.importButton.innerHTML = `${ICONS.upload}<span>IMPORT</span>`;
    this.importButton.setAttribute('aria-label', 'Import another trace');
    this.importButton.addEventListener('click', callbacks.onImportAnother);

    headerRight.appendChild(modeWrap);
    headerRight.appendChild(this.settings.toggleButton);
    headerRight.appendChild(this.importButton);

    header.appendChild(brand);
    header.appendChild(identity);
    header.appendChild(headerRight);
    header.appendChild(this.settings.root);

    // ---- Map stage
    const stage = document.createElement('div');
    stage.className = 'nt-stage';
    this.mapContainer = document.createElement('div');
    this.mapContainer.className = 'nt-map';
    this.mapContainer.id = 'nt-map-container';

    this.hud = document.createElement('div');
    this.hud.className = 'nt-hud';
    this.hud.setAttribute('aria-hidden', 'true');
    this.hudLat = document.createElement('span');
    this.hudLon = document.createElement('span');
    this.hudAlt = document.createElement('span');
    this.hudHdg = document.createElement('span');
    this.hud.appendChild(this.hudLat);
    this.hud.appendChild(this.hudLon);
    this.hud.appendChild(this.hudAlt);
    this.hud.appendChild(this.hudHdg);

    stage.appendChild(this.mapContainer);
    stage.appendChild(this.hud);
    stage.appendChild(this.cornerTick('tl'));
    stage.appendChild(this.cornerTick('tr'));
    stage.appendChild(this.cornerTick('bl'));
    stage.appendChild(this.cornerTick('br'));

    // ---- Bottom dock
    const dock = document.createElement('div');
    dock.className = 'nt-dock';

    this.telemetry = new TelemetryStrip();
    this.elevHost = document.createElement('div');
    this.elevHost.className = 'nt-elev';

    const telemetryElevation = document.createElement('div');
    telemetryElevation.className = 'nt-telemetry-block';
    telemetryElevation.appendChild(this.telemetry.root);

    dock.appendChild(telemetryElevation);
    dock.appendChild(this.elevHost);
    dock.appendChild(this.transportRoot(callbacks));

    // ---- Assemble
    this.root.appendChild(header);
    this.root.appendChild(stage);
    this.root.appendChild(dock);
  }

  private transportRoot(callbacks: WorkspaceCallbacks): HTMLDivElement {
    this.transport = new Transport({
      onScrubStart: callbacks.onScrubStart,
      onScrub: callbacks.onScrub,
      onScrubEnd: callbacks.onScrubEnd,
      onTogglePlay: callbacks.onTogglePlay,
      onRestart: callbacks.onRestart,
      onSpeedChange: (s) => callbacks.onSpeedChange(s),
      onPresent: callbacks.onPresent,
      onExport: callbacks.onExport,
    });
    return this.transport.root;
  }

  private cornerTick(pos: 'tl' | 'tr' | 'bl' | 'br'): HTMLDivElement {
    const el = document.createElement('div');
    el.className = `nt-tick nt-tick-${pos}`;
    return el;
  }

  /** Called once per trace load. */
  configure(trace: Trace): void {
    // textContent everywhere — file-supplied names stay inert.
    this.headerName.textContent = trace.name;
    const first = trace.points[0];
    this.headerCoords.textContent = formatLatLon(first.lat, first.lon);

    this.telemetry.configure(trace, MODES[this.store.get().mode].telemetryPriority);
    this.telemetry.renderStatic(trace);
    this.telemetry.durationHint = 0;

    // Elevation profile (only when the data supports it).
    this.elevProfile?.element.remove();
    this.elevProfile = null;
    this.elevHost.replaceChildren();
    const hasElevation = trace.stats.minElevation != null;
    const wantProfile = this.store.get().settings.elevationProfile;
    if (hasElevation && wantProfile) {
      this.elevProfile = createElevationProfile(trace);
      this.elevHost.appendChild(this.elevProfile.element);
      this.elevHost.classList.add('is-visible');
    } else {
      this.elevHost.classList.remove('is-visible');
    }
  }

  setModeVoice(): void {
    const state = this.store.get();
    const profile = MODES[state.mode];
    this.headerMode.textContent = profile.label;
    this.modeCaption.textContent = profile.tagline;
  }

  setDisclaimer(text: string | null): void {
    let el = this.root.querySelector('.nt-disclaimer') as HTMLDivElement | null;
    if (text) {
      if (!el) {
        el = document.createElement('div');
        el.className = 'nt-disclaimer';
        this.root.appendChild(el);
      }
      el.textContent = text;
    } else if (el) {
      el.remove();
    }
  }

  updateHud(sample: import('../core/types').TraceSample): void {
    this.hudLat.textContent = `LAT ${sample.lat.toFixed(5)}`;
    this.hudLon.textContent = `LON ${sample.lon.toFixed(5)}`;
    this.hudAlt.textContent = `ALT ${sample.elevation != null ? `${Math.round(sample.elevation)}M` : '—'}`;
    this.hudHdg.textContent = `HDG ${formatHeading(sample.heading)}`;
  }

  setElevationProgress(fraction: number): void {
    this.elevProfile?.setProgress(fraction);
  }

  setPresentation(on: boolean): void {
    this.root.classList.toggle('is-presentation', on);
  }

  dispose(): void {
    this.settings.dispose();
  }

  refreshSettings(): void {
    // Re-render the panel; re-evaluate elevation profile visibility.
    const state = this.store.get();
    if (state.trace) this.configure(state.trace);
  }
}

function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns} / ${Math.abs(lon).toFixed(4)}° ${ew}`;
}
