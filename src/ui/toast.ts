/**
 * NORD TRACE — toast notifications.
 *
 * One toast at a time, auto-dismissing, aria-live. Errors are concise
 * human sentences — never stack traces, never alert().
 */

export type ToastKind = 'info' | 'error' | 'success';

let container: HTMLDivElement | null = null;
let current: HTMLDivElement | null = null;
let hideTimer: number | null = null;

function ensureContainer(): HTMLDivElement {
  if (container && container.isConnected) return container;
  container = document.createElement('div');
  container.className = 'nt-toast-region';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

export function toast(message: string, kind: ToastKind = 'info', durationMs = 4200): void {
  const region = ensureContainer();
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (current) current.remove();

  const el = document.createElement('div');
  el.className = `nt-toast nt-toast-${kind}`;
  el.textContent = message; // textContent only — untrusted strings stay inert
  region.appendChild(el);
  current = el;

  requestAnimationFrame(() => el.classList.add('is-visible'));

  hideTimer = window.setTimeout(() => {
    el.classList.remove('is-visible');
    window.setTimeout(() => el.remove(), 380);
    if (current === el) current = null;
    hideTimer = null;
  }, durationMs);
}
