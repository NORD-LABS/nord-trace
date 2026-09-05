/**
 * NORD TRACE — telemetry strip.
 *
 * Cells follow the active mode's priority and the data's honesty:
 * a value the trace does not carry simply has no cell. Live cells
 * update per tick; static cells render once. Tabular numerals keep
 * digits from jittering.
 */

import { formatCoordinate, formatDistance, formatDuration, formatElevation, formatSpeed } from '../core/formatters';
import type { Trace, TraceSample } from '../core/types';
import type { TelemetryKey } from '../modes/modes';

interface Cell {
  key: TelemetryKey;
  root: HTMLDivElement;
  value: HTMLDivElement;
  live: boolean;
}

export class TelemetryStrip {
  readonly root: HTMLDivElement;
  private cells: Cell[] = [];

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'nt-stats';
    this.root.setAttribute('role', 'group');
    this.root.setAttribute('aria-label', 'Route statistics');
  }

  /** Build cells for a trace under a mode's priority, dropping what the data can't support. */
  configure(trace: Trace, priority: TelemetryKey[]): void {
    this.root.replaceChildren();
    this.cells = [];
    const hasTime = trace.stats.timeBasis === 'time';
    const hasElevation = trace.stats.minElevation !== null;

    for (const key of priority) {
      if (key === 'elevation' && !hasElevation) continue;
      if ((key === 'speed' || key === 'elapsed' || key === 'clock') && !hasTime) continue;
      if (key === 'elevationGain' && trace.stats.elevationGain === null) continue;
      if (key === 'heading') continue; // heading lives in the HUD, not the strip

      const cell = this.buildCell(key);
      this.cells.push(cell);
      this.root.appendChild(cell.root);
    }
  }

  private buildCell(key: TelemetryKey): Cell {
    const root = document.createElement('div');
    root.className = 'nt-stat';
    const label = document.createElement('div');
    label.className = 'nt-stat-label';
    const value = document.createElement('div');
    value.className = 'nt-stat-value';
    root.appendChild(label);
    root.appendChild(value);

    switch (key) {
      case 'coordinates':
        label.textContent = 'POSITION';
        return { key, root, value, live: true };
      case 'distance':
        label.textContent = 'DISTANCE';
        return { key, root, value, live: false };
      case 'elapsed':
        label.textContent = 'TIME';
        return { key, root, value, live: true };
      case 'elevation':
        label.textContent = 'ALTITUDE';
        return { key, root, value, live: true };
      case 'elevationGain':
        label.textContent = 'ASCENT';
        return { key, root, value, live: false };
      case 'speed':
        label.textContent = 'SPEED';
        return { key, root, value, live: true };
      case 'progress':
        label.textContent = 'PROGRESS';
        return { key, root, value, live: true };
      case 'clock':
        label.textContent = 'LOCAL TIME';
        return { key, root, value, live: true };
      default:
        label.textContent = key.toUpperCase();
        return { key, root, value, live: false };
    }
  }

  /** Static totals, rendered once per trace. */
  renderStatic(trace: Trace): void {
    for (const cell of this.cells) {
      switch (cell.key) {
        case 'distance':
          cell.value.textContent = formatDistance(trace.stats.totalDistance);
          cell.value.setAttribute('aria-label', `Total distance ${cell.value.textContent}`);
          break;
        case 'elevationGain':
          cell.value.textContent = `+${formatDistance(trace.stats.elevationGain)}`;
          break;
        case 'elapsed':
          cell.value.textContent = formatDuration(trace.stats.duration ?? 0);
          break;
        default:
          break;
      }
    }
  }

  /** Per-tick updates for live cells. */
  update(sample: TraceSample, fraction: number): void {
    for (const cell of this.cells) {
      switch (cell.key) {
        case 'coordinates':
          cell.value.textContent = formatCoordinate(sample.lat, sample.lon);
          break;
        case 'elevation':
          cell.value.textContent = formatElevation(sample.elevation);
          break;
        case 'speed':
          cell.value.textContent = formatSpeed(sample.speed);
          break;
        case 'elapsed':
          cell.value.textContent = formatDuration(fraction * this.durationHint);
          break;
        case 'progress':
          cell.value.textContent = `${Math.round(fraction * 100)}%`;
          break;
        case 'clock':
          cell.value.textContent =
            sample.time != null
              ? new Date(sample.time).toLocaleTimeString(undefined, { hour12: false })
              : '—';
          break;
        default:
          break;
      }
    }
  }

  /** Visualization duration (scaled) for elapsed rendering. */
  durationHint = 0;
}
