import { imageScale } from '@glint/capture-core';
import { desktopCapturer, screen, type Display, type NativeImage } from 'electron';

/** One display as it looked at the moment of capture. */
export interface Frame {
  readonly display: Display;
  readonly image: NativeImage;
  /** Image pixels per point; the display's scale factor unless the system captured smaller. */
  readonly scale: number;
}

/**
 * Captures every display at its full pixel size. Displays of different sizes are fetched
 * separately, because each request scales every screen to one size and would blur the smaller ones.
 */
export async function grabDisplays(): Promise<Frame[]> {
  const displays = screen.getAllDisplays();
  const sizes = new Map<string, { width: number; height: number }>();
  for (const display of displays) {
    const width = Math.round(display.size.width * display.scaleFactor);
    const height = Math.round(display.size.height * display.scaleFactor);
    sizes.set(`${String(width)}x${String(height)}`, { width, height });
  }
  const frames: Frame[] = [];
  for (const size of sizes.values()) {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: size,
    });
    displays.forEach((display, index) => {
      const width = Math.round(display.size.width * display.scaleFactor);
      const height = Math.round(display.size.height * display.scaleFactor);
      if (width !== size.width || height !== size.height) return;
      // display_id is empty on some Linux setups; the order then matches getAllDisplays.
      const source =
        sources.find((s) => s.display_id === String(display.id)) ??
        (sources.every((s) => s.display_id === '') ? sources[index] : undefined);
      if (!source || source.thumbnail.isEmpty()) return;
      frames.push({
        display,
        image: source.thumbnail,
        scale: imageScale(display.size, source.thumbnail.getSize()),
      });
    });
  }
  return frames;
}

/** The display the pointer is on. */
export const displayUnderCursor = (): Display =>
  screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
