/**
 * NORD TRACE — transport controls and timeline.
 *
 * Play/pause/restart, speed cycling, a present toggle and the
 * timeline: a native range input (keyboard + touch + screen-reader
 * scrubbing for free) with a custom progress hairline and position
 * readouts. Scrubbing pauses playback at boundaries cleanly via the
 * engine — a single source of truth for progress.
 */

import { ICONS } from './icons';
import { PLAYBACK_SPEEDS, type PlaybackSpeed } from '../playback/engine';
import { formatDuration } from '../core/formatters';

export interface TransportCallbacks {
  onScrubStart(): void;
  onScrub(fraction: number): void;
  onScrubEnd(fraction: number): void;
  onTogglePlay(): void;
  onRestart(): void;
  onSpeedChange(speed: PlaybackSpeed): void;
  onPresent(): void;
  onExport(): void;
}

export class Transport {
  readonly root: HTMLDivElement;
  private playButton: HTMLButtonElement;
  private scrubInput: HTMLInputElement;
  private scrubFill: HTMLDivElement;
  private scrubKnob: HTMLDivElement;
  private speedButton: HTMLButtonElement;
  private timeReadout: HTMLDivElement;
  private elapsedLabel: HTMLSpanElement;
  private totalLabel: HTMLSpanElement;
  private speedIndex = 1; // index into PLAYBACK_SPEEDS
  private isScrubbing = false;

  constructor(callbacks: TransportCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'nt-transport';

    this.playButton = this.iconButton('play', 'Play (Space)', callbacks.onTogglePlay);
    this.playButton.id = 'nt-play';
    const restartButton = this.iconButton('restart', 'Restart (R)', callbacks.onRestart);

    this.speedButton = document.createElement('button');
    this.speedButton.type = 'button';
    this.speedButton.className = 'nt-speed';
    this.speedButton.textContent = '1×';
    this.speedButton.setAttribute('aria-label', 'Playback speed (press to cycle)');
    this.speedButton.addEventListener('click', () => this.cycleSpeed());
    this.speedCallback = callbacks.onSpeedChange;

    this.scrubInput = document.createElement('input');
    this.scrubInput.type = 'range';
    this.scrubInput.className = 'nt-scrub-native';
    this.scrubInput.min = '0';
    this.scrubInput.max = '1000';
    this.scrubInput.step = '1';
    this.scrubInput.value = '0';
    this.scrubInput.setAttribute('aria-label', 'Timeline — scrub through the route');
    this.scrubInput.addEventListener('input', () => {
      const fraction = Number(this.scrubInput.value) / 1000;
      if (!this.isScrubbing) {
        this.isScrubbing = true;
        callbacks.onScrubStart();
      }
      callbacks.onScrub(fraction);
      this.renderScrub(fraction);
    });
    this.scrubInput.addEventListener('change', () => {
      this.isScrubbing = false;
      callbacks.onScrubEnd(Number(this.scrubInput.value) / 1000);
    });

    this.scrubFill = document.createElement('div');
    this.scrubFill.className = 'nt-scrub-fill';
    this.scrubKnob = document.createElement('div');
    this.scrubKnob.className = 'nt-scrub-knob';

    this.timeReadout = document.createElement('div');
    this.timeReadout.className = 'nt-time';
    this.elapsedLabel = document.createElement('span');
    this.elapsedLabel.textContent = '0:00';
    this.totalLabel = document.createElement('span');
    this.totalLabel.textContent = ' / 0:00';
    this.timeReadout.appendChild(this.elapsedLabel);
    this.timeReadout.appendChild(this.totalLabel);

    const presentButton = this.iconButton('present', 'Presentation mode (F)', callbacks.onPresent);
    const exportButton = this.iconButton('image', 'Export still (E)', callbacks.onExport);

    const left = document.createElement('div');
    left.className = 'nt-transport-left';
    left.appendChild(this.playButton);
    left.appendChild(restartButton);
    left.appendChild(this.speedButton);

    const right = document.createElement('div');
    right.className = 'nt-transport-right';
    right.appendChild(exportButton);
    right.appendChild(presentButton);

    const track = document.createElement('div');
    track.className = 'nt-scrub';
    track.appendChild(this.scrubFill);
    track.appendChild(this.scrubInput);
    track.appendChild(this.scrubKnob);

    this.root.appendChild(left);
    this.root.appendChild(track);
    this.root.appendChild(this.timeReadout);
    this.root.appendChild(right);
  }

  private speedCallback: (s: PlaybackSpeed) => void;

  private cycleSpeed(): void {
    this.speedIndex = (this.speedIndex + 1) % PLAYBACK_SPEEDS.length;
    const speed = PLAYBACK_SPEEDS[this.speedIndex];
    this.speedButton.textContent = `${speed}×`;
    this.speedCallback(speed);
  }

  setSpeed(speed: PlaybackSpeed): void {
    const idx = PLAYBACK_SPEEDS.indexOf(speed);
    if (idx >= 0) {
      this.speedIndex = idx;
      this.speedButton.textContent = `${speed}×`;
    }
  }

  setTotalDuration(seconds: number): void {
    this.totalLabel.textContent = ` / ${formatDuration(seconds)}`;
  }

  setPlaying(playing: boolean): void {
    this.playButton.innerHTML = playing ? ICONS.pause : ICONS.play;
    this.playButton.setAttribute('aria-label', playing ? 'Pause (Space)' : 'Play (Space)');
    this.root.classList.toggle('is-playing', playing);
  }

  /** Update the visual position from the engine (no events fired). */
  setFraction(fraction: number): void {
    this.renderScrub(fraction);
    if (!this.isScrubbing) {
      this.scrubInput.value = String(Math.round(fraction * 1000));
    }
    this.elapsedLabel.textContent = formatDuration(fraction * this.durationSeconds);
  }

  private durationSeconds = 0;

  setElapsedDuration(seconds: number): void {
    this.durationSeconds = seconds;
  }

  private renderScrub(fraction: number): void {
    const pct = (Math.max(0, Math.min(1, fraction)) * 100).toFixed(2) + '%';
    this.scrubFill.style.width = pct;
    this.scrubKnob.style.left = pct;
  }

  private iconButton(icon: keyof typeof ICONS, label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nt-btn';
    b.innerHTML = ICONS[icon];
    b.setAttribute('aria-label', label);
    b.title = label;
    b.addEventListener('click', onClick);
    return b;
  }
}
