import { isUsableSelection, type Rect } from '@glint/capture-core';
import { app, type BrowserWindow } from 'electron';
import { type Selection } from '../shared/ipc';
import { clearFrames, publishFrame } from './frames';
import { openPage } from './pages';
import { displayUnderCursor, type Frame } from './screens';

export type AreaResult =
  | { readonly kind: 'area'; readonly frame: Frame; readonly rect: Rect }
  | { readonly kind: 'cancelled' };

/**
 * The area picker: one full-screen overlay per display showing that display frozen at the moment
 * of capture, so menus and hover states stay put while you select. Overlay windows are kept
 * (hidden) between captures, so the next one appears without waiting for a window to load.
 */
export function createAreaPicker() {
  const overlays = new Map<string, BrowserWindow>();
  let pending: {
    frames: Map<string, Frame>;
    resolve: (result: AreaResult) => void;
    waiting: Set<string>;
  } | null = null;

  const overlayFor = (frame: Frame): BrowserWindow => {
    const id = String(frame.display.id);
    const existing = overlays.get(id);
    const { x, y, width, height } = frame.display.bounds;
    if (existing && !existing.isDestroyed()) {
      existing.setBounds({ x, y, width, height });
      return existing;
    }
    const window = openPage('overlay', {
      query: { display: id },
      x,
      y,
      width,
      height,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      enableLargerThanScreen: true,
      backgroundColor: '#000000',
      title: 'Glint',
    });
    window.setAlwaysOnTop(true, 'screen-saver');
    if (process.platform === 'darwin') {
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    window.on('closed', () => {
      overlays.delete(id);
    });
    overlays.set(id, window);
    return window;
  };

  const hideAll = () => {
    for (const window of overlays.values()) if (!window.isDestroyed()) window.hide();
    clearFrames();
  };

  const finish = (result: AreaResult) => {
    const current = pending;
    pending = null;
    hideAll();
    current?.resolve(result);
  };

  return {
    /** Shows the overlays and resolves with the chosen area, or cancelled. */
    pick(frames: readonly Frame[]): Promise<AreaResult> {
      if (pending) finish({ kind: 'cancelled' });
      return new Promise((resolve) => {
        pending = {
          frames: new Map(frames.map((frame) => [String(frame.display.id), frame])),
          resolve,
          waiting: new Set(frames.map((frame) => String(frame.display.id))),
        };
        for (const frame of frames) {
          const window = overlayFor(frame);
          const url = publishFrame(frame.image.toJPEG(92));
          const send = () => {
            window.webContents.send('overlay:frame', {
              displayId: String(frame.display.id),
              url,
              scale: frame.scale,
            });
          };
          if (window.webContents.isLoading()) window.webContents.once('did-finish-load', send);
          else send();
        }
      });
    },
    /** An overlay has drawn its frame: show it, and give the one under the pointer the keyboard. */
    ready(displayId: string) {
      if (!pending?.waiting.has(displayId)) return;
      pending.waiting.delete(displayId);
      const window = overlays.get(displayId);
      if (!window) return;
      window.showInactive();
      if (String(displayUnderCursor().id) === displayId) {
        if (process.platform === 'darwin') app.focus({ steal: true });
        window.show();
        window.focus();
      }
    },
    select(selection: Selection) {
      const frame = pending?.frames.get(selection.displayId);
      if (!frame) return;
      const rect = selection.whole
        ? {
            x: 0,
            y: 0,
            width: frame.display.size.width,
            height: frame.display.size.height,
          }
        : selection.rect;
      finish(isUsableSelection(rect) ? { kind: 'area', frame, rect } : { kind: 'cancelled' });
    },
    cancel() {
      finish({ kind: 'cancelled' });
    },
    /** Closes the kept overlays (displays changed, or quitting). */
    reset() {
      for (const window of overlays.values()) if (!window.isDestroyed()) window.destroy();
      overlays.clear();
    },
    isOpen: () => pending !== null,
  };
}

export type AreaPicker = ReturnType<typeof createAreaPicker>;
