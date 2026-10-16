import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  clampRect,
  fileNameFor,
  imageScale,
  isUsableSelection,
  rectFromPoints,
  toDevicePixels,
  uniqueName,
} from '../src/index';

describe('selections', () => {
  it('make the same rectangle whichever way you drag', () => {
    expect(rectFromPoints({ x: 50, y: 40 }, { x: 10, y: 90 })).toEqual({
      x: 10,
      y: 40,
      width: 40,
      height: 50,
    });
  });

  it('stay inside the display', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    expect(clampRect({ x: -10, y: 90, width: 50, height: 50 }, bounds)).toEqual({
      x: 0,
      y: 90,
      width: 40,
      height: 10,
    });
    expect(clampRect({ x: 200, y: 0, width: 5, height: 5 }, bounds).width).toBe(0);
  });

  it('ignore what is only a click', () => {
    expect(isUsableSelection({ x: 0, y: 0, width: 2, height: 30 })).toBe(false);
    expect(isUsableSelection({ x: 0, y: 0, width: 10, height: 10 })).toBe(true);
  });
});

describe('device pixels', () => {
  it('double on a Retina display and round outward', () => {
    expect(
      toDevicePixels({ x: 10.25, y: 3, width: 20.5, height: 7 }, 2, {
        width: 400,
        height: 400,
      }),
    ).toEqual({ x: 20, y: 6, width: 42, height: 14 });
    expect(
      toDevicePixels({ x: 1, y: 1, width: 3, height: 3 }, 1.5, {
        width: 100,
        height: 100,
      }),
    ).toEqual({ x: 1, y: 1, width: 5, height: 5 });
  });

  it('never leave the image, at any scale', () => {
    fc.assert(
      fc.property(
        fc.record({
          x: fc.double({ min: -50, max: 500, noNaN: true }),
          y: fc.double({ min: -50, max: 500, noNaN: true }),
          width: fc.double({ min: 0, max: 600, noNaN: true }),
          height: fc.double({ min: 0, max: 600, noNaN: true }),
        }),
        fc.constantFrom(1, 1.25, 1.5, 2, 3),
        (rect, scale) => {
          const image = {
            width: Math.round(400 * scale),
            height: Math.round(300 * scale),
          };
          const px = toDevicePixels(rect, scale, image);
          expect(px.x).toBeGreaterThanOrEqual(0);
          expect(px.y).toBeGreaterThanOrEqual(0);
          expect(px.x + px.width).toBeLessThanOrEqual(image.width);
          expect(px.y + px.height).toBeLessThanOrEqual(image.height);
          expect(Number.isInteger(px.width) && Number.isInteger(px.height)).toBe(true);
        },
      ),
    );
  });

  it('read the image scale from the captured image', () => {
    expect(imageScale({ width: 1440, height: 900 }, { width: 2880, height: 1800 })).toBe(2);
  });
});

describe('file names', () => {
  const when = new Date(2026, 9, 16, 14, 5, 9);

  it('fill the template', () => {
    expect(fileNameFor('Glint {date} at {time}', when, 'Screenshot', 'png')).toBe(
      'Glint 2026-10-16 at 14.05.09.png',
    );
    expect(
      fileNameFor('{kind}-{year}{month}{day}-{hour}{minute}{second}', when, 'Screenshot', 'jpg'),
    ).toBe('Screenshot-20261016-140509.jpg');
    expect(fileNameFor('{unknown} shot', when, 'Screenshot', 'png')).toBe('{unknown} shot.png');
  });

  it('remove characters no system allows, and never come out empty', () => {
    expect(fileNameFor('a/b:c*d?', when, 'Screenshot', 'png')).toBe('a-b-c-d-.png');
    expect(fileNameFor('  ..  ', when, 'Screenshot', 'png')).toBe(
      'Glint 2026-10-16 at 14.05.09.png',
    );
  });

  it('number a name that is taken', () => {
    const taken = new Set(['a.png', 'a 2.png']);
    expect(uniqueName('a.png', (n) => taken.has(n))).toBe('a 3.png');
    expect(uniqueName('b.png', (n) => taken.has(n))).toBe('b.png');
  });
});
