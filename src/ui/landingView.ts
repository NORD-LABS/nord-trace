/**
 * NORD TRACE — landing / empty state.
 *
 * Not an upload form — an opening title card. Editorial composition
 * over a procedural trace animation. Drop a file anywhere, pick one,
 * or load the generated demo. The dropzone is a real, labeled button
 * with a real file input behind it.
 */

import { generateDemoTrace } from '../demo/demoTrace';
import { startEmptyStateAnimation } from './emptyBackground';
import { ACCEPTED_EXTENSIONS } from '../app/import';

export interface LandingCallbacks {
  onFileSelected(file: File): void;
  onDemo(): void;
}

export class LandingView {
  readonly root: HTMLDivElement;
  private stopAnimation: (() => void) | null = null;
  private fileInput: HTMLInputElement;
  private dropzone: HTMLDivElement;

  constructor(callbacks: LandingCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'nt-landing';

    const canvas = document.createElement('canvas');
    canvas.className = 'nt-landing-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    const content = document.createElement('div');
    content.className = 'nt-landing-content';

    const kicker = document.createElement('p');
    kicker.className = 'nt-kicker';
    kicker.textContent = 'NORD LABS';

    const wordmark = document.createElement('h1');
    wordmark.className = 'nt-wordmark';
    wordmark.textContent = 'NORD TRACE';

    const headline = document.createElement('p');
    headline.className = 'nt-headline';
    headline.innerHTML = 'TURN ROUTES<br>INTO STORIES.';

    this.dropzone = document.createElement('div');
    this.dropzone.className = 'nt-dropzone';

    const dropHint = document.createElement('span');
    dropHint.className = 'nt-drop-hint';
    dropHint.textContent = 'DROP GPX / GEOJSON';

    const dropOr = document.createElement('span');
    dropOr.className = 'nt-drop-or';
    dropOr.textContent = 'or';

    const actions = document.createElement('div');
    actions.className = 'nt-landing-actions';

    const demoButton = document.createElement('button');
    demoButton.type = 'button';
    demoButton.className = 'nt-btn-primary';
    demoButton.textContent = 'LOAD DEMO';

    const pickButton = document.createElement('button');
    pickButton.type = 'button';
    pickButton.className = 'nt-btn-secondary';
    pickButton.textContent = 'SELECT TRACE';

    actions.appendChild(demoButton);
    actions.appendChild(pickButton);

    this.dropzone.appendChild(dropHint);
    this.dropzone.appendChild(dropOr);
    this.dropzone.appendChild(actions);
    this.dropzone.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      this.fileInput.click();
    });
    // Keyboard access: the dropzone behaves like a button.
    this.dropzone.setAttribute('role', 'button');
    this.dropzone.tabIndex = 0;
    this.dropzone.setAttribute('aria-label', 'Drop a GPX or GeoJSON trace, or press Enter to browse files');
    this.dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.fileInput.click();
      }
    });

    this.fileInput = document.createElement('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = ACCEPTED_EXTENSIONS;
    this.fileInput.className = 'nt-file-input';
    this.fileInput.setAttribute('aria-label', 'Select a GPX or GeoJSON trace file');
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      if (file) callbacks.onFileSelected(file);
      this.fileInput.value = '';
    });

    const privacy = document.createElement('p');
    privacy.className = 'nt-privacy';
    privacy.textContent = 'Processed locally in your browser.';

    const footer = document.createElement('footer');
    footer.className = 'nt-landing-footer';
    footer.innerHTML =
      '<span>NORD TRACE — a NORD LABS instrument</span>' +
      '<span>© 2026 Théodore Beaupré, operating as ISO NORD CA</span>';

    content.appendChild(kicker);
    content.appendChild(wordmark);
    content.appendChild(headline);
    content.appendChild(this.dropzone);
    content.appendChild(privacy);
    this.root.appendChild(canvas);
    this.root.appendChild(content);
    this.root.appendChild(footer);

    demoButton.addEventListener('click', () => callbacks.onDemo());
    pickButton.addEventListener('click', () => this.fileInput.click());

    // Procedural background from the demo trace — deterministic, no assets.
    const demo = generateDemoTrace();
    requestAnimationFrame(() => {
      this.stopAnimation = startEmptyStateAnimation(canvas, demo);
    });
  }

  setDragOver(on: boolean): void {
    this.dropzone.classList.toggle('is-dragover', on);
    this.root.classList.toggle('is-dragging', on);
  }

  dispose(): void {
    this.stopAnimation?.();
  }
}
