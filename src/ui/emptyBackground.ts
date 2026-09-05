/**
 * NORD TRACE — empty-state procedural background.
 *
 * A slow, abstract "trace being drawn" on a faint graticule — pure
 * Canvas 2D, deterministic, no external assets, pauses under
 * prefers-reduced-motion. Lightweight enough to live behind the
 * landing composition.
 */

import type { Trace } from '../core/types';

export function startEmptyStateAnimation(canvas: HTMLCanvasElement, trace: Trace): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => undefined;
  const ctx: CanvasRenderingContext2D = context;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  let running = true;
  let width = 0;
  let height = 0;
  let dpr = 1;

  const pad = 96;
  const pts = projectTrace(trace, canvas, pad);

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const total = pts.length;

  function drawGrid(): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 230, 223, 0.05)';
    ctx.lineWidth = 1;
    const cell = 72;
    ctx.beginPath();
    for (let x = (width % cell) / 2; x < width; x += cell) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = (height % cell) / 2; y < height; y += cell) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function draw(now: number): void {
    if (!running) return;
    ctx.clearRect(0, 0, width, height);
    drawGrid();

    const cycle = 26_000;
    const t = reduced ? 0.45 : ((now % cycle) / cycle);
    const head = Math.floor(t * total);

    // faint full route
    ctx.beginPath();
    for (let i = 0; i < total; i += 1) {
      const p = pts[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(232, 230, 223, 0.10)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // revealed portion, brighter
    if (head > 1) {
      ctx.beginPath();
      for (let i = 0; i <= head; i += 1) {
        const p = pts[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(242, 241, 236, 0.34)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const hp = pts[head];
      if (hp) {
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(242, 241, 236, 0.85)';
        ctx.fill();
      }
    }

    if (!reduced) raf = requestAnimationFrame(draw);
  }

  raf = requestAnimationFrame(draw);

  const onResize = (): void => {
    resize();
    if (reduced) draw(performance.now());
  };
  window.addEventListener('resize', onResize);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
  };
}

interface ProjectedPoint {
  x: number;
  y: number;
}

/** Equirectangular projection fit to the canvas with padding. */
function projectTrace(trace: Trace, canvas: HTMLCanvasElement, pad: number): ProjectedPoint[] {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, rect.width - pad * 2);
  const h = Math.max(1, rect.height - pad * 2);
  const b = trace.stats.bounds;
  const lonSpan = Math.max(b.maxLon - b.minLon, 1e-6);
  const latSpan = Math.max(b.maxLat - b.minLat, 1e-6);
  const latMid = (b.maxLat + b.minLat) / 2;
  const kx = Math.cos((latMid * Math.PI) / 180);

  const scaleX = w / (lonSpan * kx);
  const scaleY = h / latSpan;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = pad + (w - lonSpan * kx * scale) / 2;
  const offsetY = pad + (h - latSpan * scale) / 2;

  return trace.points.map((p) => ({
    x: offsetX + (p.lon - b.minLon) * kx * scale,
    y: offsetY + (b.maxLat - p.lat) * scale,
  }));
}
