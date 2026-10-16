/**
 * The arithmetic of a screenshot: selections in screen points, turned into the device pixels of
 * the display they were drawn on, and the file names captures are saved under.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The rectangle between two corners, whichever way the drag went. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** The part of a rectangle inside the bounds; empty (zero size) when they do not overlap. */
export function clampRect(rect: Rect, bounds: Rect): Rect {
  // An empty result still sits inside the bounds, so its far edge never leaves them.
  const x = Math.min(Math.max(rect.x, bounds.x), bounds.x + bounds.width);
  const y = Math.min(Math.max(rect.y, bounds.y), bounds.y + bounds.height);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

/**
 * A selection in a display's points (relative to its top-left corner) as whole device pixels of
 * that display's image. Edges round outward, so the pixels under the selection are all kept, and
 * the result never leaves the image.
 */
export function toDevicePixels(
  rect: Rect,
  scaleFactor: number,
  image: { readonly width: number; readonly height: number },
): Rect {
  const left = Math.floor(rect.x * scaleFactor);
  const top = Math.floor(rect.y * scaleFactor);
  const right = Math.ceil((rect.x + rect.width) * scaleFactor);
  const bottom = Math.ceil((rect.y + rect.height) * scaleFactor);
  return clampRect(
    { x: left, y: top, width: right - left, height: bottom - top },
    { x: 0, y: 0, width: image.width, height: image.height },
  );
}

/** The scale between a display's image and its size in points (images can be smaller on some systems). */
export function imageScale(
  display: { readonly width: number; readonly height: number },
  image: { readonly width: number; readonly height: number },
): number {
  return display.width > 0 ? image.width / display.width : 1;
}

/** Selections smaller than this (in points) are treated as a click, not an area. */
export const MIN_SELECTION = 4;

export const isUsableSelection = (rect: Rect): boolean =>
  rect.width >= MIN_SELECTION && rect.height >= MIN_SELECTION;

/** The default file name: "Glint 2026-10-16 at 14.05.09". */
export const DEFAULT_NAME_TEMPLATE = 'Glint {date} at {time}';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A file name from a template. Tokens: {date} 2026-10-16, {time} 14.05.09, {year}, {month},
 * {day}, {hour}, {minute}, {second}, {kind} (Screenshot or Recording). Characters no system allows
 * in a name become dashes, and an empty result falls back to the default template.
 */
export function fileNameFor(
  template: string,
  when: Date,
  kind: 'Screenshot' | 'Recording',
  extension: string,
): string {
  const values: Readonly<Record<string, string>> = {
    date: `${String(when.getFullYear())}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`,
    time: `${pad(when.getHours())}.${pad(when.getMinutes())}.${pad(when.getSeconds())}`,
    year: String(when.getFullYear()),
    month: pad(when.getMonth() + 1),
    day: pad(when.getDate()),
    hour: pad(when.getHours()),
    minute: pad(when.getMinutes()),
    second: pad(when.getSeconds()),
    kind,
  };
  const filled = template.replace(/\{(\w+)\}/g, (match, token: string) => values[token] ?? match);
  const safe = filled
    // eslint-disable-next-line no-control-regex -- control characters are not allowed in names
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 180);
  const base = safe === '' ? fileNameFor(DEFAULT_NAME_TEMPLATE, when, kind, '').slice(0, -1) : safe;
  return extension === '' ? `${base}.` : `${base}.${extension}`;
}

/** "name.png", then "name 2.png", "name 3.png"…: the first that `taken` does not report. */
export function uniqueName(name: string, taken: (candidate: string) => boolean): string {
  if (!taken(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; ; n++) {
    const candidate = `${stem} ${String(n)}${extension}`;
    if (!taken(candidate)) return candidate;
  }
}
