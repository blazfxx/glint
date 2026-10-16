import { screen, type BrowserWindow } from 'electron';
import { type CaptureItem } from '../shared/ipc';
import { type Settings } from '../shared/settings';
import { openPage } from './pages';

const WIDTH = 300;
const CARD = 206;
const GAP = 10;
const MARGIN = 16;
const MAX_VISIBLE = 4;

/**
 * The small window that floats in a screen corner after each capture, with what to do next. It
 * stacks captures (newest on top) and never takes focus from the app you are working in.
 */
export function createQuickAccess() {
  let window: BrowserWindow | null = null;
  let items: CaptureItem[] = [];
  let corner: Settings['quickAccess']['corner'] = 'bottom-right';

  const place = () => {
    if (!window || window.isDestroyed()) return;
    const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
    const count = Math.min(items.length, MAX_VISIBLE);
    const height = count * CARD + (count - 1) * GAP + 2 * GAP;
    const x = corner === 'bottom-right' ? area.x + area.width - WIDTH - MARGIN : area.x + MARGIN;
    window.setBounds({
      x,
      y: area.y + area.height - height - MARGIN,
      width: WIDTH,
      height,
    });
  };

  const ensure = () => {
    if (window && !window.isDestroyed()) return window;
    window = openPage('quick', {
      width: WIDTH,
      height: CARD,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      focusable: process.platform !== 'linux',
      title: 'Glint',
    });
    window.setAlwaysOnTop(true, 'floating');
    if (process.platform === 'darwin')
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.on('closed', () => {
      window = null;
    });
    const opened = window;
    opened.webContents.on('did-finish-load', () => {
      opened.webContents.send('quick:items', items);
    });
    return window;
  };

  const publish = () => {
    if (items.length === 0) {
      window?.hide();
      return;
    }
    const target = ensure();
    place();
    if (!target.webContents.isLoading()) target.webContents.send('quick:items', items);
    target.showInactive();
  };

  return {
    show(item: CaptureItem, settings: Settings) {
      corner = settings.quickAccess.corner;
      items = [item, ...items.filter((other) => other.id !== item.id)].slice(0, MAX_VISIBLE);
      publish();
    },
    close(id: string) {
      items = items.filter((item) => item.id !== id);
      publish();
    },
    /** A capture deleted from the history leaves the stack too. */
    forget(id: string) {
      if (items.some((item) => item.id === id)) this.close(id);
    },
    items: () => [...items],
    window: () => window,
  };
}

export type QuickAccess = ReturnType<typeof createQuickAccess>;
