/**
 * Chroma — the app's signature behaviour.
 *
 * AniList hands back a dominant colour for every title's artwork
 * (`coverImage.color`). We turn it into an RGB triple, guarantee it is
 * legible against the ink background, and publish it as a CSS variable so
 * focus rings, glows and progress bars all adopt the colour of whatever the
 * viewer is looking at.
 */

const FALLBACK: RGB = [182, 173, 200];

export type RGB = [number, number, number];

export function hexToRgb(hex?: string | null): RGB {
  if (!hex) return FALLBACK;
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
  if (full.length !== 6 || /[^0-9a-f]/i.test(full)) return FALLBACK;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Relative luminance, per WCAG 2.1. */
export function luminance([r, g, b]: RGB): number {
  const chan = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/**
 * Artwork colours are often too dark to read as a focus ring on an
 * near-black page. Lift anything below the threshold toward white until it
 * carries enough light, preserving hue.
 */
export function ensureLegible(rgb: RGB, floor = 0.28): RGB {
  let out = rgb;
  let guard = 0;
  while (luminance(out) < floor && guard < 24) {
    out = out.map((c) => Math.min(255, Math.round(c + (255 - c) * 0.14))) as RGB;
    guard += 1;
  }
  return out;
}

export function toChromaVar(hex?: string | null): string {
  return ensureLegible(hexToRgb(hex)).join(' ');
}

/** Contrast ratio between two colours, for choosing text over a chroma fill. */
export function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function readableOn(rgb: RGB): '#0E0B16' | '#F2EDF7' {
  return contrast(rgb, [14, 11, 22]) >= contrast(rgb, [242, 237, 247])
    ? '#0E0B16'
    : '#F2EDF7';
}
