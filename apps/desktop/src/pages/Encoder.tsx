import { useEffect } from 'react';
import { glint } from '../glint';

/** Encodes WebP for the main process with Chromium's encoder. Never shown. */
export function Encoder() {
  useEffect(
    () =>
      glint().on('encoder:job', ({ id, png, quality }) => {
        void (async () => {
          try {
            const bitmap = await createImageBitmap(
              new Blob([new Uint8Array(png)], { type: 'image/png' }),
            );
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const context = canvas.getContext('2d');
            if (!context) throw new Error('No canvas');
            context.drawImage(bitmap, 0, 0);
            const blob = await canvas.convertToBlob({
              type: 'image/webp',
              quality: quality / 100,
            });
            if (blob.type !== 'image/webp') throw new Error('WebP is not supported');
            await glint().invoke('encoder:done', {
              id,
              data: new Uint8Array(await blob.arrayBuffer()),
            });
          } catch {
            await glint().invoke('encoder:done', { id, data: null });
          }
        })();
      }),
    [],
  );
  return null;
}
