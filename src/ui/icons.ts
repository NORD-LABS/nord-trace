/**
 * NORD TRACE — inline SVG icons. Stroke-based, 24px grid, currentColor.
 */

const S = 'stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

function svg(inner: string, label: string): string {
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" data-icon="${label}" ${S}>${inner}</svg>`;
}

export const ICONS = {
  play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>', 'play'),
  pause: svg('<path d="M8 5.5v13M16 5.5v13" stroke-width="2.4"/>', 'pause'),
  restart: svg('<path d="M5.5 12a6.5 6.5 0 1 1 2.2 4.9"/><path d="M5.5 17.5v-4h4"/>', 'restart'),
  settings: svg(
    '<circle cx="12" cy="12" r="2.6"/><path d="M12 3.5v2.6M12 17.9v2.6M3.5 12h2.6M17.9 12h2.6M6 6l1.9 1.9M16.1 16.1 18 18M18 6l-1.9 1.9M7.9 16.1 6 18"/>',
    'settings',
  ),
  present: svg('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>', 'present'),
  image: svg('<rect x="4" y="5" width="16" height="14" rx="1.2"/><circle cx="9.4" cy="10" r="1.4"/><path d="m5 17.5 4.6-4.3 3.1 2.8 2.7-2.4 3.6 3.4"/>', 'image'),
  close: svg('<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>', 'close'),
  upload: svg('<path d="M12 16V5.5M8 9l4-3.8L16 9"/><path d="M5 15.5v2A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-2"/>', 'upload'),
  chevronDown: svg('<path d="m7 10 5 5 5-5"/>', 'chevron-down'),
} as const;

export type IconName = keyof typeof ICONS;
