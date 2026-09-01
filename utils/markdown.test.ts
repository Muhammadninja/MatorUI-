/**
 * Markdown parser tests — formatting coverage plus the security properties the
 * legal renderer depends on (untrusted backend content must never execute).
 */
import { describe, expect, test } from 'vitest';

import { isSafeHref, parseInline, parseMarkdown } from './markdown';

/** Flatten a block's spans back to visible text. */
const textOf = (spans: { text: string }[]) => spans.map((s) => s.text).join('');

describe('block syntax', () => {
  test('parses ATX headings at every level', () => {
    const blocks = parseMarkdown('# One\n\n### Three');
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 1 });
    expect(textOf(blocks[0]!.spans)).toBe('One');
    expect(blocks[1]).toMatchObject({ kind: 'heading', level: 3 });
  });

  test('joins soft-wrapped lines into one paragraph and splits on blank lines', () => {
    const blocks = parseMarkdown('first line\nsecond line\n\nnew para');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.kind).toBe('paragraph');
    expect(textOf(blocks[0]!.spans)).toBe('first line second line');
    expect(textOf(blocks[1]!.spans)).toBe('new para');
  });

  test('parses unordered lists', () => {
    const blocks = parseMarkdown('- alpha\n- beta');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'listItem', ordered: false, marker: '•' });
    expect(textOf(blocks[0]!.spans)).toBe('alpha');
  });

  test('parses ordered lists and keeps the authored numbering', () => {
    const blocks = parseMarkdown('1. first\n2. second');
    expect(blocks[0]).toMatchObject({ kind: 'listItem', ordered: true, marker: '1.' });
    expect(blocks[1]).toMatchObject({ marker: '2.' });
  });

  test('normalizes CRLF line endings', () => {
    const blocks = parseMarkdown('# Title\r\n\r\nbody');
    expect(textOf(blocks[0]!.spans)).toBe('Title');
    expect(textOf(blocks[1]!.spans)).toBe('body');
  });

  test('empty input yields no blocks', () => {
    expect(parseMarkdown('')).toEqual([]);
  });
});

describe('inline syntax', () => {
  test('bold via ** and __', () => {
    expect(parseInline('a **b** c')[1]).toMatchObject({ text: 'b', bold: true });
    expect(parseInline('__b__')[0]).toMatchObject({ text: 'b', bold: true });
  });

  test('italic via * and _', () => {
    expect(parseInline('a *b* c')[1]).toMatchObject({ text: 'b', italic: true });
    expect(parseInline('_b_')[0]).toMatchObject({ text: 'b', italic: true });
  });

  test('links keep their label and href', () => {
    const spans = parseInline('see [docs](https://example.com) now');
    expect(spans[1]).toMatchObject({
      kind: 'link',
      text: 'docs',
      href: 'https://example.com',
    });
    expect(textOf(spans)).toBe('see docs now');
  });

  test('surrounding text is preserved around every span', () => {
    expect(textOf(parseInline('start **mid** end'))).toBe('start mid end');
  });
});

// ── Security ─────────────────────────────────────────────────────────────
//
// The renderer maps this tree onto React Native <Text> nodes. There is no HTML
// parser, no dangerouslySetInnerHTML and no WebView, so the guarantee under
// test is: markup arrives as INERT TEXT, and no unsafe href becomes tappable.

describe('security — untrusted content cannot execute', () => {
  test('script tags survive only as literal text, never as a tag', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe('paragraph');
    // The characters are preserved verbatim as text content...
    expect(textOf(blocks[0]!.spans)).toBe('<script>alert(1)</script>');
    // ...and no span is anything but plain text.
    expect(blocks[0]!.spans.every((s) => s.kind === 'text')).toBe(true);
  });

  test('img onerror payloads stay inert text', () => {
    const blocks = parseMarkdown('<img src=x onerror="alert(1)">');
    expect(blocks[0]!.spans.every((s) => s.kind === 'text')).toBe(true);
    expect(textOf(blocks[0]!.spans)).toContain('onerror');
  });

  test('iframe payloads stay inert text', () => {
    const blocks = parseMarkdown('<iframe src="https://evil.test"></iframe>');
    expect(blocks[0]!.spans.every((s) => s.kind === 'text')).toBe(true);
  });

  test.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.test',
  ])('rejects unsafe href %s', (href) => {
    expect(isSafeHref(href)).toBe(false);
  });

  test.each(['https://example.com', 'http://example.com', 'mailto:a@b.c', '/local/path'])(
    'allows safe href %s',
    (href) => {
      expect(isSafeHref(href)).toBe(true);
    },
  );

  test('a javascript: link degrades to plain text — label kept, nothing tappable', () => {
    const spans = parseInline('[click me](javascript:alert(1))');
    expect(spans.every((s) => s.kind === 'text')).toBe(true);
    expect(textOf(spans)).toContain('click me');
    // Crucially: no link span exists, so nothing can be activated.
    expect(spans.find((s) => s.kind === 'link')).toBeUndefined();
  });

  test('a data: link degrades to plain text', () => {
    const spans = parseInline('[x](data:text/html,<script>alert(1)</script>)');
    expect(spans.find((s) => s.kind === 'link')).toBeUndefined();
  });

  test('safe links still produce a link span alongside rejected ones', () => {
    const spans = parseInline('[bad](javascript:x) and [good](https://ok.test)');
    const links = spans.filter((s) => s.kind === 'link');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ href: 'https://ok.test' });
  });
});
