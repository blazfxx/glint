import { type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { openPage } from './pages';

/**
 * WebP is encoded by Chromium in a hidden page (Electron's images only write PNG and JPEG). The
 * page is opened on the first WebP save and closed after a minute without work.
 */
export function createWebpEncoder() {
  let window: BrowserWindow | null = null;
  let ready: Promise<void> | null = null;
  let idle: NodeJS.Timeout | null = null;
  const jobs = new Map<string, (data: Uint8Array | null) => void>();

  const page = () => {
    if (window && !window.isDestroyed() && ready) return ready;
    window = openPage('encoder', {
      width: 10,
      height: 10,
      show: false,
      skipTaskbar: true,
    });
    window.on('closed', () => {
      window = null;
      ready = null;
      for (const resolve of jobs.values()) resolve(null);
      jobs.clear();
    });
    const opened = window;
    ready = new Promise((resolve) => {
      opened.webContents.once('did-finish-load', () => {
        resolve();
      });
    });
    return ready;
  };

  return {
    done(id: string, data: Uint8Array | null) {
      jobs.get(id)?.(data);
      jobs.delete(id);
    },
    async encode(png: Buffer, quality: number): Promise<Buffer | null> {
      await page();
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => window?.close(), 60_000);
      const id = randomUUID();
      const result = new Promise<Uint8Array | null>((resolve) => {
        jobs.set(id, resolve);
        setTimeout(() => {
          if (jobs.delete(id)) resolve(null);
        }, 30_000);
      });
      window?.webContents.send('encoder:job', {
        id,
        png: new Uint8Array(png),
        quality,
      });
      const data = await result;
      return data ? Buffer.from(data) : null;
    },
  };
}

export type WebpEncoder = ReturnType<typeof createWebpEncoder>;
