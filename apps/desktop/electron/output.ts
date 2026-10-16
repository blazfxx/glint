import { fileNameFor, uniqueName, type Rect } from '@glint/capture-core';
import { type NativeImage } from 'electron';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type CaptureItem } from '../shared/ipc';
import { copyPng } from './clipboard';
import { type Settings } from '../shared/settings';
import { type WebpEncoder } from './encoder';
import { type History } from './history';

export interface Delivered {
  readonly item: CaptureItem;
  /** What went wrong while saving, when the capture is only in the clipboard and history. */
  readonly saveError: string | null;
}

/** Cuts the capture out of the frame, at Retina or 1x size as the settings say. */
export function cut(image: NativeImage, pixels: Rect, points: Rect, retina: boolean): NativeImage {
  const cropped = image.crop(pixels);
  const width = Math.max(1, Math.round(points.width));
  if (retina || cropped.getSize().width <= width) return cropped;
  return cropped.resize({ width, quality: 'best' });
}

/**
 * Where a capture goes: the clipboard, a file in the chosen folder and format, and always the
 * history. A save that fails (no permission, disk full) does not lose the capture: it is still
 * in the clipboard and the history, and the error is reported.
 */
export async function deliver(
  image: NativeImage,
  settings: Settings,
  context: {
    history: History;
    defaultFolder: string;
    webp: WebpEncoder;
    now?: Date;
  },
): Promise<Delivered> {
  const shots = settings.screenshots;
  const png = image.toPNG();
  if (shots.copyToClipboard) await copyPng(png);
  const when = context.now ?? new Date();
  const name = fileNameFor(shots.nameTemplate, when, 'Screenshot', shots.format);
  let savedPath: string | null = null;
  let saveError: string | null = null;
  if (shots.saveToFolder) {
    try {
      const folder = shots.folder ?? context.defaultFolder;
      mkdirSync(folder, { recursive: true });
      const file = path.join(
        folder,
        uniqueName(name, (candidate) => existsSync(path.join(folder, candidate))),
      );
      const data =
        shots.format === 'png'
          ? png
          : shots.format === 'jpg'
            ? image.toJPEG(shots.quality)
            : await context.webp.encode(png, shots.quality);
      if (!data) throw new Error('WebP could not be encoded.');
      writeFileSync(file, data);
      savedPath = file;
    } catch (failure) {
      saveError = failure instanceof Error ? failure.message : 'The file could not be saved.';
    }
  }
  const { width, height } = image.getSize();
  const item = context.history.add(
    png,
    {
      name: savedPath ? path.basename(savedPath) : name,
      width,
      height,
      savedPath,
    },
    settings.history.keep,
  );
  return { item, saveError };
}
