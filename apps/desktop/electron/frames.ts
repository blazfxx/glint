import { net, protocol } from 'electron';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

/** Frozen screen images for the overlays, served at glint-frame://frame/<token>. */
export const FRAME_SCHEME = 'glint-frame';
/** History images, served at glint-history://capture/<id>. */
export const HISTORY_SCHEME = 'glint-history';

const frames = new Map<string, Buffer>();

export function registerFrameScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: FRAME_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
    {
      scheme: HISTORY_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ]);
}

export function serveFrames(historyFile: (id: string) => string | null): void {
  protocol.handle(HISTORY_SCHEME, (request) => {
    const id = new URL(request.url).pathname.replace(/^\//, '');
    const file = historyFile(id);
    return file
      ? net.fetch(pathToFileURL(file).toString())
      : new Response('Not found', { status: 404 });
  });
  protocol.handle(FRAME_SCHEME, (request) => {
    const token = new URL(request.url).pathname.replace(/^\//, '');
    const body = frames.get(token);
    return body
      ? new Response(new Uint8Array(body), {
          headers: { 'Content-Type': 'image/jpeg' },
        })
      : new Response('Not found', { status: 404 });
  });
}

/**
 * The overlay shows a JPEG of the frame (quick to encode for a 5K screen); the capture itself is
 * cut from the original pixels, so it stays lossless.
 */
export function publishFrame(jpeg: Buffer): string {
  const token = randomUUID();
  frames.set(token, jpeg);
  return `${FRAME_SCHEME}://frame/${token}`;
}

export function clearFrames(): void {
  frames.clear();
}
