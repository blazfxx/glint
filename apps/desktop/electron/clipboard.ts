import { ClipboardItem, clipboard } from 'electron';

/** Puts a PNG on the clipboard as an image any app can paste. */
export async function copyPng(png: Buffer): Promise<void> {
  const blob = new Blob([new Uint8Array(png)], { type: 'image/png' });
  await clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
