import { BrowserWindow, shell, type BrowserWindowConstructorOptions } from 'electron';
import path from 'node:path';

/** Every Glint window is one React app; the hash names the page. */
export type Page =
  'settings' | 'overlay' | 'quick' | 'history' | 'windows' | 'countdown' | 'encoder';

export interface PageOptions extends BrowserWindowConstructorOptions {
  readonly query?: Readonly<Record<string, string>>;
}

/**
 * Opens a page in a locked-down window: isolated, sandboxed, no Node, the typed preload only, no
 * navigation away from the app and no new windows (links open in the browser).
 */
export function openPage(page: Page, options: PageOptions = {}): BrowserWindow {
  const { query, ...windowOptions } = options;
  const window = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    ...windowOptions,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      ...windowOptions.webPreferences,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  const hash = `${page}${query ? `?${new URLSearchParams(query).toString()}` : ''}`;
  const dev = process.env.GLINT_DEV_SERVER;
  if (dev) void window.loadURL(`${dev}#${hash}`);
  else
    void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      hash,
    });
  return window;
}
