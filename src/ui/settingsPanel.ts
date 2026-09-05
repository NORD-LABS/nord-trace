/**
 * NORD TRACE — settings panel.
 *
 * A restrained control surface: camera programs, product modes and the
 * handful of presentation switches V1 actually needs. Opens from the
 * header; closes on outside click or Escape. Every control is a real
 * labeled input.
 */

import { ICONS } from './icons';
import type { AppStore } from '../app/state';
import { MODE_ORDER, MODES } from '../modes/modes';
import type { CameraMode } from '../map/camera';

const CAMERA_LABELS: Record<CameraMode, string> = {
  overview: 'OVERVIEW',
  follow: 'FOLLOW',
  cinematic: 'CINEMATIC',
};

export class SettingsPanel {
  readonly root: HTMLDivElement;
  private open = false;
  private onOutside: (e: Event) => void;
  private onKey: (e: KeyboardEvent) => void;
  toggleButton: HTMLButtonElement;

  constructor(
    private store: AppStore,
    private onChange: () => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'nt-settings';
    this.root.hidden = true;

    this.toggleButton = document.createElement('button');
    this.toggleButton.type = 'button';
    this.toggleButton.className = 'nt-btn nt-settings-toggle';
    this.toggleButton.innerHTML = `${ICONS.settings}<span>MODE / ⋯</span>`;
    this.toggleButton.setAttribute('aria-expanded', 'false');
    this.toggleButton.setAttribute('aria-haspopup', 'true');
    this.toggleButton.addEventListener('click', () => this.toggle());

    this.onOutside = (e: Event) => {
      if (this.open && !this.root.contains(e.target as Node) && e.target !== this.toggleButton) {
        this.setOpen(false);
      }
    };
    this.onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.open) this.setOpen(false);
    };
    document.addEventListener('pointerdown', this.onOutside, true);
    document.addEventListener('keydown', this.onKey);

    this.render();
  }

  private render(): void {
    const state = this.store.get();

    const sectionTitle = (text: string): HTMLDivElement => {
      const el = document.createElement('div');
      el.className = 'nt-settings-title';
      el.textContent = text;
      return el;
    };

    // Camera
    const cameraSection = sectionTitle('CAMERA');
    const cameraRow = document.createElement('div');
    cameraRow.className = 'nt-seg';
    cameraRow.setAttribute('role', 'radiogroup');
    cameraRow.setAttribute('aria-label', 'Camera');
    for (const mode of ['overview', 'follow', 'cinematic'] as CameraMode[]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nt-seg-btn';
      b.textContent = CAMERA_LABELS[mode];
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(state.camera === mode));
      b.classList.toggle('is-active', state.camera === mode);
      b.addEventListener('click', () => {
        this.store.set({ camera: mode });
        this.refresh();
        this.onChange();
      });
      cameraRow.appendChild(b);
    }

    // Mode
    const modeSection = sectionTitle('MODE');
    const modeRow = document.createElement('div');
    modeRow.className = 'nt-seg';
    modeRow.setAttribute('role', 'radiogroup');
    modeRow.setAttribute('aria-label', 'Product mode');
    for (const id of MODE_ORDER) {
      const profile = MODES[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nt-seg-btn';
      b.textContent = profile.label;
      b.title = profile.tagline;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(state.mode === id));
      b.classList.toggle('is-active', state.mode === id);
      b.addEventListener('click', () => {
        this.store.setMode(id);
        this.refresh();
        this.onChange();
      });
      modeRow.appendChild(b);
    }

    // Interface toggles
    const uiSection = sectionTitle('INTERFACE');
    const toggles = document.createElement('div');
    toggles.className = 'nt-toggles';

    toggles.appendChild(this.switchRow('Telemetry', state.settings.telemetry, (v) => {
      this.store.setSettings({ telemetry: v });
      this.onChange();
    }));
    const hasElevation = state.trace?.stats.minElevation != null;
    if (hasElevation) {
      toggles.appendChild(this.switchRow('Elevation profile', state.settings.elevationProfile, (v) => {
        this.store.setSettings({ elevationProfile: v });
        this.onChange();
      }));
    }
    toggles.appendChild(this.switchRow('Route visible', state.settings.routeVisible, (v) => {
      this.store.setSettings({ routeVisible: v });
      this.onChange();
    }));

    // Emphasis slider
    const emphasisRow = document.createElement('label');
    emphasisRow.className = 'nt-slider-row';
    const emphasisLabel = document.createElement('span');
    emphasisLabel.textContent = 'Route emphasis';
    const emphasis = document.createElement('input');
    emphasis.type = 'range';
    emphasis.min = '0';
    emphasis.max = '100';
    emphasis.value = String(Math.round(state.settings.emphasis * 100));
    emphasis.addEventListener('input', () => {
      this.store.setSettings({ emphasis: Number(emphasis.value) / 100 });
      this.onChange();
    });
    emphasisRow.appendChild(emphasisLabel);
    emphasisRow.appendChild(emphasis);

    this.root.replaceChildren(cameraSection, cameraRow, modeSection, modeRow, uiSection, toggles, emphasisRow);
  }

  private switchRow(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLLabelElement {
    const row = document.createElement('label');
    row.className = 'nt-switch-row';
    const text = document.createElement('span');
    text.textContent = label;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'nt-switch';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    row.appendChild(text);
    row.appendChild(input);
    return row;
  }

  private refresh(): void {
    this.render();
    this.toggleButton.setAttribute('aria-expanded', String(this.open));
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  setOpen(open: boolean): void {
    if (open === this.open) return;
    this.open = open;
    if (open) this.render();
    this.root.hidden = !open;
    this.toggleButton.setAttribute('aria-expanded', String(open));
  }

  dispose(): void {
    document.removeEventListener('pointerdown', this.onOutside, true);
    document.removeEventListener('keydown', this.onKey);
  }
}
