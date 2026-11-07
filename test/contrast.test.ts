import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'app', 'globals.css'), 'utf8');

/** Reads `--name: #rrggbb;` declarations from one CSS block. */
function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/g))
    out[m[1] as string] = m[2] as string;
  return out;
}

const light = tokens(/:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '');
const dark = {
  ...light,
  ...tokens(/prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}\s*\}/.exec(css)?.[1] ?? ''),
};

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Text and background pairs that really occur in the components.
const PAIRS: [string, string][] = [
  ['color-fg', 'color-bg'],
  ['color-fg', 'color-surface'],
  ['color-muted', 'color-bg'],
  ['color-muted', 'color-surface'],
  ['color-accent-fg', 'color-accent'],
  ['color-error', 'color-bg'],
  ['color-error', 'color-surface'],
  ['color-error', 'color-error-bg'],
  ['color-fg', 'color-error-bg'],
  ['color-fg', 'color-warn-bg'],
  ['color-accent', 'color-bg'],
];

describe('colour tokens', () => {
  it('defines a light and a dark theme', () => {
    expect(Object.keys(light).length).toBeGreaterThan(8);
    expect(dark['color-bg']).not.toBe(light['color-bg']);
  });

  for (const [name, theme] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`meets WCAG AA contrast (4.5:1) for every text pair in the ${name} theme`, () => {
      for (const [fg, bg] of PAIRS) {
        const a = theme[fg];
        const b = theme[bg];
        expect(a && b, `${fg}/${bg} defined`).toBeTruthy();
        expect(
          contrast(a as string, b as string),
          `${name}: ${fg} on ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it('keeps colours out of the components and out of the CSS outside the token blocks', () => {
    const files = ['components', 'app']
      .flatMap((d) => readdirSync(join(root, d)).map((f) => join(root, d, f)))
      .filter((f) => /\.(tsx|css)$/.test(f));
    for (const file of files) {
      let text = readFileSync(file, 'utf8');
      if (file.endsWith('globals.css')) {
        // the token definitions are the one place colours may be written
        text = text
          .replace(/:root\s*\{[\s\S]*?\n\}/g, '')
          .replace(/@media[^{]*\{\s*:root\s*\{[\s\S]*?\}\s*\}/g, '');
      }
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    }
  });
});
