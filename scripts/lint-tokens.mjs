#!/usr/bin/env node
/**
 * lint-tokens — fail CI if hex / rgba color literals appear in component
 * JSX style props.
 *
 * We sweep `components/screens/**` and `components/screens-components/**`
 * for `'#xxxxxx'` and `'rgba(...)'`. The known-fine cases are:
 *   - `shadowColor: '#000000'` — RN iOS shadow convention; not theme-driven.
 *   - `rgba(255,255,255,0.X)` and `rgba(0,0,0,0.X)` — alpha-only over a
 *     fixed-color background where the color is inherently theme-
 *     independent (e.g. white text on a gradient card).
 *
 * Anything else MUST come from `tokens.<name>` (themes/index.ts) so dark
 * mode + brand identity drift doesn't bypass the design system.
 *
 * Run: `npm run lint:tokens`
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCAN = [
  'components/screens',
  'components/screens-components',
];

const HEX_REGEX = /(['"])#([0-9a-fA-F]{3,8})\1/g;
const RGBA_REGEX = /(['"`])rgba?\([^)]+\)\1/g;

// Skip lines where the literal is used in an allowed context.
const ALLOWED_CONTEXT = [
  /shadowColor/i, // RN iOS shadow — black is the convention there.
];

// rgba patterns that are intentionally theme-independent: alpha-only
// modifiers on pure white / pure black for overlay text on colored
// cards (e.g. credit-card numerals, scrim under map markers).
const ALLOWED_RGBA_PATTERNS = [
  /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.[0-9]+\s*\)/i,
  /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.[0-9]+\s*\)/i,
];

const violations = [];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|jsx?)$/.test(entry) && !/\.test\./.test(entry)) yield p;
  }
}

for (const sub of SCAN) {
  const root = join(ROOT, sub);
  try {
    for (const file of walk(root)) {
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        const allow = ALLOWED_CONTEXT.some((re) => re.test(line));
        if (allow) return;
        const hexMatch = line.match(HEX_REGEX);
        const rgbaMatch = line.match(RGBA_REGEX);
        const allowedRgba =
          rgbaMatch &&
          rgbaMatch.every((m) => ALLOWED_RGBA_PATTERNS.some((re) => re.test(m)));
        if (hexMatch || (rgbaMatch && !allowedRgba)) {
          violations.push({
            file: file.replace(ROOT + '/', ''),
            line: i + 1,
            literal: hexMatch?.[0] ?? rgbaMatch?.[0],
          });
        }
      });
    }
  } catch {
    // Directory missing or unreadable — skip silently.
  }
}

if (violations.length === 0) {
  console.log('✓ lint:tokens — no hex / rgba literals outside the theme system.');
  process.exit(0);
}

console.log(`✗ lint:tokens — found ${violations.length} color literals:\n`);
for (const v of violations) {
  console.log(`  ${v.file}:${v.line}  ${v.literal}`);
}
console.log('\nReplace with a theme token (e.g. tokens.text, tokens.brand) or add the call site to ALLOWED_CONTEXT in scripts/lint-tokens.mjs if it is a genuinely theme-independent literal (RN shadowColor, etc.).');
process.exit(1);
