import { describe, expect, it } from 'vitest';

import { sizedImageUrl } from './image-url';

const CLOUDINARY =
  'https://res.cloudinary.com/drwrlu02c/image/upload/v1792436158/mator/products/zlz1lbytadba6da9av5v.png';

describe('sizedImageUrl', () => {
  it('inserts a sized, auto-format transformation into a Cloudinary URL', () => {
    const out = sizedImageUrl(CLOUDINARY, 150)!;
    expect(out).toContain('/image/upload/f_auto,q_auto,c_limit,w_');
    // The version + public id survive untouched — only the transform is new.
    expect(out).toContain('/v1792436158/mator/products/zlz1lbytadba6da9av5v.png');
  });

  it('snaps the requested width to a bucket so derivatives stay cacheable', () => {
    const thumb = sizedImageUrl(CLOUDINARY, 150)!;
    const hero = sizedImageUrl(CLOUDINARY, 400)!;
    const thumbWidth = Number(/w_(\d+)/.exec(thumb)![1]);
    const heroWidth = Number(/w_(\d+)/.exec(hero)![1]);
    expect(thumbWidth).toBeGreaterThanOrEqual(150);
    expect(heroWidth).toBeGreaterThan(thumbWidth);
  });

  it('leaves an already-transformed URL alone', () => {
    const transformed = sizedImageUrl(CLOUDINARY, 150)!;
    expect(sizedImageUrl(transformed, 400)).toBe(transformed);
  });

  it('passes through non-Cloudinary URLs and empty input', () => {
    expect(sizedImageUrl('https://cdn.example.com/part.jpg', 150)).toBe(
      'https://cdn.example.com/part.jpg',
    );
    expect(sizedImageUrl(undefined)).toBeUndefined();
    expect(sizedImageUrl(null)).toBeUndefined();
    expect(sizedImageUrl('')).toBeUndefined();
  });
});
