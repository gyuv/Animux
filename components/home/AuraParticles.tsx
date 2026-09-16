'use client';

import { useEffect, useRef } from 'react';

/**
 * A lightweight canvas aura — soft sparks and drifting petals behind the
 * hero copy. Capped at 30 particles because that number stays imperceptible
 * on a five-year-old Android phone, and skipped entirely (no canvas, no
 * rAF loop, nothing) on mobile and for prefers-reduced-motion rather than
 * merely paused, since the whole point of a field like this is motion —
 * a frozen one is just render cost with nothing to show for it.
 *
 * Shapes are drawn procedurally rather than loaded from a sprite sheet: a
 * canvas full of tiny circles and diamonds costs nothing over the network
 * and nothing to decode, which a PNG particle atlas would not.
 */

const COUNT = 30;
const COLORS = ['139 92 246', '0 242 254', '255 215 0'] as const;

interface Particle {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  phase: number;
  color: (typeof COLORS)[number];
  petal: boolean;
  rotation: number;
  spin: number;
}

function spawn(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: 1.5 + Math.random() * 3,
    speed: 8 + Math.random() * 18,
    drift: 10 + Math.random() * 20,
    phase: Math.random() * Math.PI * 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    petal: Math.random() < 0.3,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.8,
  };
}

export function AuraParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (mobile || reduced) return;

    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];

    const resize = () => {
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = Array.from({ length: COUNT }, () => spawn(w, h));
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    let raf = 0;
    let last = performance.now();
    let visible = !document.hidden;

    const onVisibility = () => { visible = !document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) { last = now; return; }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.y -= p.speed * dt;
        p.phase += dt;
        p.rotation += p.spin * dt;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        const sway = Math.sin(p.phase) * p.drift * dt * 0.6;
        p.x += sway;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        const glow = 0.35 + 0.25 * Math.sin(p.phase * 1.7);

        if (p.petal) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = `rgb(${p.color} / ${glow})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r * 1.8, p.r * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
          grad.addColorStop(0, `rgb(${p.color} / ${glow})`);
          grad.addColorStop(1, `rgb(${p.color} / 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 hidden md:block"
    />
  );
}
