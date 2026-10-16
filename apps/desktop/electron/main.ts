import { toDevicePixels, type Rect } from '@glint/capture-core';
import { ACTION_LABELS, type Platform, type ShortcutAction } from '@glint/shortcuts';
import {
  BrowserWindow,
  Menu,
  Tray,
  app,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  shell,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
  type NativeImage,
} from 'electron';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  requests,
  type AppInfo,
  type RequestChannel,
  type Responses,
  type ShortcutStatuses,
  type WindowSource,
} from '../shared/ipc';
import { mergeSettings, type Settings } from '../shared/settings';
import { createAreaPicker } from './area';
import { copyPng } from './clipboard';
import { createWebpEncoder } from './encoder';
import { registerFrameScheme, serveFrames } from './frames';
import { createHistory } from './history';
import { deliver, cut } from './output';
import { openPage } from './pages';
import { createQuickAccess } from './quick-access';
import { displayUnderCursor, grabDisplays } from './screens';
import { readSettings, writeSettings } from './settings-store';
import { registerShortcuts } from './shortcuts';
import {
  loginItemSupported,
  openScreenPermissionSettings,
  screenPermission,
  setLaunchAtLogin,
} from './system';
import { createUpdater } from './updater';

const platform = process.platform as Platform;

registerFrameScheme();

// Tests run against a fresh profile and their own capture folder.
if (process.env.GLINT_USER_DATA) app.setPath('userData', process.env.GLINT_USER_DATA);

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const defaultFolder = () =>
  process.env.GLINT_CAPTURE_DIR ?? path.join(app.getPath('pictures'), 'Glint');

let settings: Settings;
let statuses: ShortcutStatuses;
let tray: Tray | null = null;
let settingsWindow: BrowserWindow | null = null;
let historyWindow: BrowserWindow | null = null;
let windowPicker: BrowserWindow | null = null;
let countdown: BrowserWindow | null = null;
/** The last area, so "Capture previous area" can take it again without the overlay. */
let previousArea: { displayId: string; rect: Rect } | null = null;
let busy = false;

let historyStore: ReturnType<typeof createHistory>;
const history = () => historyStore;
const quick = createQuickAccess();
const area = createAreaPicker();
const webp = createWebpEncoder();
const updater = createUpdater((state) => {
  broadcast('update:changed', state);
  buildTrayMenu();
});

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload);
  }
}

const assetPath = (file: string) => path.join(__dirname, '..', 'assets', file);

// ---- windows -------------------------------------------------------------------------------

function focusOrOpen(current: BrowserWindow | null, create: () => BrowserWindow): BrowserWindow {
  if (current && !current.isDestroyed()) {
    if (current.isMinimized()) current.restore();
    current.show();
    current.focus();
    return current;
  }
  const window = create();
  window.once('ready-to-show', () => {
    window.show();
  });
  return window;
}

function openSettings(tab?: string): void {
  settingsWindow = focusOrOpen(settingsWindow, () => {
    const window = openPage('settings', {
      query: tab ? { tab } : undefined,
      width: 720,
      height: 560,
      minWidth: 620,
      minHeight: 460,
      title: 'Glint Settings',
      titleBarStyle: platform === 'darwin' ? 'hiddenInset' : 'default',
      backgroundColor: '#17181c',
    });
    window.on('closed', () => {
      settingsWindow = null;
    });
    return window;
  });
}

function openHistory(): void {
  historyWindow = focusOrOpen(historyWindow, () => {
    const window = openPage('history', {
      width: 980,
      height: 680,
      minWidth: 640,
      minHeight: 420,
      title: 'Glint History',
      titleBarStyle: platform === 'darwin' ? 'hiddenInset' : 'default',
      backgroundColor: '#17181c',
    });
    window.on('closed', () => {
      historyWindow = null;
    });
    return window;
  });
}

// ---- capture -------------------------------------------------------------------------------

/** macOS asks for Screen Recording once; until it is allowed, captures open the permission page. */
function mayCapture(): boolean {
  if (screenPermission() === 'granted') return true;
  openSettings('permissions');
  return false;
}

async function finish(image: NativeImage): Promise<void> {
  const result = await deliver(image, settings, {
    history: history(),
    defaultFolder: defaultFolder(),
    webp,
  });
  broadcast('history:changed', history().list());
  if (settings.quickAccess.enabled) quick.show(result.item, settings);
  if (result.saveError) {
    void dialog.showMessageBox({
      type: 'warning',
      message: 'The screenshot was not saved to its folder',
      detail: `${result.saveError}\n\nIt is in the clipboard and in Glint's history.`,
    });
  }
}

/** Runs one capture at a time; a shortcut pressed during a capture is ignored. */
async function exclusive(task: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    await task();
  } catch (error) {
    void dialog.showMessageBox({
      type: 'error',
      message: 'The capture did not work',
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    busy = false;
  }
}

function cropFrame(frameImage: NativeImage, rect: Rect, scale: number): NativeImage {
  const pixels = toDevicePixels(rect, scale, frameImage.getSize());
  return cut(frameImage, pixels, rect, settings.screenshots.retina);
}

async function captureArea(): Promise<void> {
  if (!mayCapture() || area.isOpen()) return;
  await exclusive(async () => {
    const frames = await grabDisplays();
    if (frames.length === 0) throw new Error('No screen could be captured.');
    const result = await area.pick(frames);
    if (result.kind === 'cancelled') return;
    previousArea = {
      displayId: String(result.frame.display.id),
      rect: result.rect,
    };
    buildTrayMenu();
    await finish(cropFrame(result.frame.image, result.rect, result.frame.scale));
  });
}

async function captureScreen(): Promise<void> {
  if (!mayCapture()) return;
  await exclusive(async () => {
    const target = String(displayUnderCursor().id);
    const frames = await grabDisplays();
    const frame = frames.find((f) => String(f.display.id) === target) ?? frames[0];
    if (!frame) throw new Error('No screen could be captured.');
    const { width, height } = frame.display.size;
    await finish(cropFrame(frame.image, { x: 0, y: 0, width, height }, frame.scale));
  });
}

async function capturePrevious(): Promise<void> {
  const last = previousArea;
  if (!last) {
    await captureArea();
    return;
  }
  if (!mayCapture()) return;
  await exclusive(async () => {
    const frames = await grabDisplays();
    const frame = frames.find((f) => String(f.display.id) === last.displayId);
    if (!frame) throw new Error('The display of the previous area is no longer connected.');
    await finish(cropFrame(frame.image, last.rect, frame.scale));
  });
}

/** Glint's own windows are left out of the window list. */
const ownWindowIds = () =>
  new Set(BrowserWindow.getAllWindows().map((window) => window.getMediaSourceId()));

async function listWindows(): Promise<WindowSource[]> {
  const own = ownWindowIds();
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 480, height: 300 },
    fetchWindowIcons: true,
  });
  return sources
    .filter((source) => !own.has(source.id) && !source.thumbnail.isEmpty())
    .map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      icon: !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : null,
    }));
}

function openWindowPicker(): void {
  if (!mayCapture()) return;
  windowPicker = focusOrOpen(windowPicker, () => {
    const window = openPage('windows', {
      width: 860,
      height: 600,
      minWidth: 520,
      minHeight: 360,
      title: 'Capture a Window',
      backgroundColor: '#17181c',
    });
    window.on('closed', () => {
      windowPicker = null;
    });
    return window;
  });
}

async function captureWindow(id: string): Promise<void> {
  windowPicker?.close();
  await exclusive(async () => {
    // The picker has to be gone from the screen before the window is captured.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const largest = screen.getAllDisplays().reduce(
      (size, d) => ({
        width: Math.max(size.width, Math.round(d.size.width * d.scaleFactor)),
        height: Math.max(size.height, Math.round(d.size.height * d.scaleFactor)),
      }),
      { width: 0, height: 0 },
    );
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: largest,
    });
    const source = sources.find((s) => s.id === id);
    if (!source || source.thumbnail.isEmpty()) {
      throw new Error('That window has closed, or it could not be captured.');
    }
    await finish(source.thumbnail);
  });
}

function timedCapture(seconds: 3 | 5 | 10): void {
  if (!mayCapture() || countdown) return;
  const display = displayUnderCursor();
  const size = 180;
  const window = openPage('countdown', {
    query: { seconds: String(seconds) },
    x: Math.round(display.workArea.x + (display.workArea.width - size) / 2),
    y: Math.round(display.workArea.y + (display.workArea.height - size) / 2),
    width: size,
    height: size,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    title: 'Glint',
  });
  window.setAlwaysOnTop(true, 'screen-saver');
  window.once('ready-to-show', () => {
    window.showInactive();
  });
  countdown = window;
  let left = seconds;
  const tick = setInterval(() => {
    left -= 1;
    if (left > 0) {
      window.webContents.send('countdown:tick', left);
      return;
    }
    clearInterval(tick);
    window.destroy();
    countdown = null;
    // A beat for the countdown to leave the screen, then the screen is frozen for the area.
    setTimeout(() => void captureArea(), 120);
  }, 1000);
}

const actions: Readonly<Record<ShortcutAction, () => void>> = {
  captureArea: () => void captureArea(),
  captureScreen: () => void captureScreen(),
  captureWindow: openWindowPicker,
  capturePrevious: () => void capturePrevious(),
  openHistory,
};

// ---- settings, shortcuts, tray ---------------------------------------------------------------

function applyShortcuts(): void {
  statuses = registerShortcuts(settings.shortcuts, platform, (action) => {
    actions[action]();
  });
  broadcast('shortcuts:changed', statuses);
  buildTrayMenu();
}

function updateSettings(patch: unknown): Settings {
  const previous = settings;
  settings = mergeSettings(settings, patch);
  writeSettings(settingsFile(), settings);
  if (JSON.stringify(previous.shortcuts) !== JSON.stringify(settings.shortcuts)) applyShortcuts();
  if (previous.general.launchAtLogin !== settings.general.launchAtLogin) {
    setLaunchAtLogin(settings.general.launchAtLogin);
  }
  if (previous.history.keep !== settings.history.keep) {
    history().trim(settings.history.keep);
    broadcast('history:changed', history().list());
  }
  broadcast('settings:changed', settings);
  return settings;
}

function trayIcon(): NativeImage {
  if (platform === 'darwin') {
    const image = nativeImage.createFromPath(assetPath('trayTemplate.png'));
    image.setTemplateImage(true);
    return image;
  }
  return nativeImage.createFromPath(assetPath(platform === 'win32' ? 'tray-win.png' : 'tray.png'));
}

function buildTrayMenu(): void {
  if (!tray) return;
  const shortcut = (action: ShortcutAction) => {
    const value = settings.shortcuts[action];
    return value && statuses[action].state === 'active'
      ? { accelerator: value, registerAccelerator: false }
      : {};
  };
  const update = updater.state();
  const template: MenuItemConstructorOptions[] = [
    {
      label: ACTION_LABELS.captureArea,
      click: actions.captureArea,
      ...shortcut('captureArea'),
    },
    {
      label: ACTION_LABELS.captureScreen,
      click: actions.captureScreen,
      ...shortcut('captureScreen'),
    },
    {
      label: `${ACTION_LABELS.captureWindow}…`,
      click: actions.captureWindow,
      ...shortcut('captureWindow'),
    },
    {
      label: ACTION_LABELS.capturePrevious,
      enabled: previousArea !== null,
      click: actions.capturePrevious,
      ...shortcut('capturePrevious'),
    },
    {
      label: 'Timed Capture',
      submenu: ([3, 5, 10] as const).map((seconds) => ({
        label: `In ${String(seconds)} Seconds`,
        click: () => {
          timedCapture(seconds);
        },
      })),
    },
    { type: 'separator' },
    { label: 'History', click: openHistory, ...shortcut('openHistory') },
    {
      label: 'Settings…',
      click: () => {
        openSettings();
      },
    },
    update.status === 'ready'
      ? {
          label: `Restart to Update to ${update.version}`,
          click: () => void updater.install(),
        }
      : update.status === 'available'
        ? {
            label: `Get Glint ${update.version}…`,
            click: () => void updater.install(),
          }
        : {
            label: 'Check for Updates…',
            click: () => {
              openSettings('general');
              void updater.check(true);
            },
          },
    { type: 'separator' },
    { label: 'Quit Glint', role: 'quit' },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

// ---- requests ------------------------------------------------------------------------------

type Handler<C extends RequestChannel> = (
  payload: ReturnType<(typeof requests)[C]['parse']>,
  event: IpcMainInvokeEvent,
) => Responses[C] | Promise<Responses[C]>;

function handle<C extends RequestChannel>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, (event, payload: unknown) => {
    const parsed = requests[channel].safeParse(payload);
    if (!parsed.success) throw new Error(`Invalid request to ${channel}`);
    return handler(parsed.data as ReturnType<(typeof requests)[C]['parse']>, event);
  });
}

const info = (): AppInfo => ({
  version: app.getVersion(),
  platform,
  defaultFolder: defaultFolder(),
  loginItemSupported: loginItemSupported(),
});

function itemFile(id: string): string {
  const file = history().file(id);
  if (!file) throw new Error('That capture is no longer in the history.');
  return file;
}

function itemOf(id: string) {
  return history()
    .list()
    .find((item) => item.id === id);
}

async function saveCopyAs(id: string): Promise<void> {
  const item = itemOf(id);
  const source = itemFile(id);
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: path.join(
      settings.screenshots.folder ?? defaultFolder(),
      item?.name.replace(/\.\w+$/, '.png') ?? 'Glint.png',
    ),
    filters: [{ name: 'PNG image', extensions: ['png'] }],
  });
  if (canceled || !filePath) return;
  copyFileSync(source, filePath);
}

function registerRequests(): void {
  handle('app:info', info);
  handle('settings:get', () => settings);
  handle('settings:set', (patch) => updateSettings(patch));
  handle('settings:choose-folder', async (_payload, event) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: settings.screenshots.folder ?? defaultFolder(),
    };
    const { canceled, filePaths } = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    const folder = filePaths[0];
    return canceled || !folder ? settings : updateSettings({ screenshots: { folder } });
  });
  handle('shortcuts:status', () => statuses);
  handle('shortcuts:pause', (paused) => {
    if (paused) {
      for (const action of Object.keys(statuses) as ShortcutAction[]) {
        const value = settings.shortcuts[action];
        if (value && statuses[action].state === 'active') {
          // Unregistering keeps the key press for the page that is recording a new shortcut.
          globalShortcut.unregister(value);
        }
      }
    } else {
      applyShortcuts();
    }
    return undefined;
  });
  handle('permissions:screen', () => screenPermission());
  handle('permissions:open-settings', async () => {
    await openScreenPermissionSettings();
    return undefined;
  });
  handle('update:state', () => updater.state());
  handle('update:check', () => updater.check(settings.general.autoUpdate));
  handle('update:install', async () => {
    await updater.install();
    return undefined;
  });
  handle('capture:area', () => {
    void captureArea();
    return undefined;
  });
  handle('capture:screen', () => {
    void captureScreen();
    return undefined;
  });
  handle('capture:window-list', () => listWindows());
  handle('capture:window', (id) => {
    void captureWindow(id);
    return undefined;
  });
  handle('capture:timed', (seconds) => {
    timedCapture(seconds);
    return undefined;
  });
  handle('overlay:ready', (displayId) => {
    area.ready(displayId);
    return undefined;
  });
  handle('overlay:select', (selection) => {
    area.select(selection);
    return undefined;
  });
  handle('overlay:cancel', () => {
    area.cancel();
    return undefined;
  });
  handle('quick:copy', async (id) => {
    await copyPng(readFileSync(itemFile(id)));
    return undefined;
  });
  handle('quick:save', async (id) => {
    const item = itemOf(id);
    if (item?.savedPath && existsSync(item.savedPath)) shell.showItemInFolder(item.savedPath);
    else await saveCopyAs(id);
    return undefined;
  });
  handle('quick:reveal', (id) => {
    const item = itemOf(id);
    shell.showItemInFolder(
      item?.savedPath && existsSync(item.savedPath) ? item.savedPath : itemFile(id),
    );
    return undefined;
  });
  handle('quick:drag', (id, event) => {
    const item = itemOf(id);
    const file = item?.savedPath && existsSync(item.savedPath) ? item.savedPath : itemFile(id);
    const icon = nativeImage.createFromPath(itemFile(id)).resize({ width: 96 });
    event.sender.startDrag({ file, icon });
    return undefined;
  });
  handle('quick:close', (id) => {
    quick.close(id);
    return undefined;
  });
  handle('history:list', () => history().list());
  handle('history:copy', async (id) => {
    await copyPng(readFileSync(itemFile(id)));
    return undefined;
  });
  handle('history:reveal', (id) => {
    const item = itemOf(id);
    shell.showItemInFolder(
      item?.savedPath && existsSync(item.savedPath) ? item.savedPath : itemFile(id),
    );
    return undefined;
  });
  handle('history:save-as', async (id) => {
    await saveCopyAs(id);
    return undefined;
  });
  handle('history:delete', (id) => {
    const items = history().remove(id);
    quick.forget(id);
    broadcast('history:changed', items);
    return items;
  });
  handle('history:open', () => {
    openHistory();
    return undefined;
  });
  handle('encoder:done', ({ id, data }) => {
    webp.done(id, data);
    return undefined;
  });
}

// ---- start -----------------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setName('Glint');
  app.on('second-instance', () => {
    openSettings();
  });
  // A tray app: no window is a reason to quit.
  app.on('window-all-closed', () => undefined);
  void app.whenReady().then(() => {
    if (platform === 'darwin') app.dock?.hide();
    settings = readSettings(settingsFile());
    historyStore = createHistory(path.join(app.getPath('userData'), 'history'));
    historyStore.trim(settings.history.keep);
    serveFrames((id) => historyStore.file(id));
    registerRequests();
    tray = new Tray(trayIcon());
    tray.setToolTip('Glint');
    applyShortcuts();
    screen.on('display-added', () => {
      area.reset();
    });
    screen.on('display-removed', () => {
      area.reset();
    });
    screen.on('display-metrics-changed', () => {
      area.reset();
    });
    // The first start shows Settings, so there is something on screen besides an icon in the tray.
    if (!existsSync(settingsFile())) {
      writeSettings(settingsFile(), settings);
      if (!process.env.GLINT_TEST) openSettings(platform === 'darwin' ? 'permissions' : 'general');
    }
    if (settings.general.autoUpdate) void updater.check(true);
    if (process.env.GLINT_TEST) {
      (globalThis as Record<string, unknown>).__glint = {
        captureArea: () => captureArea(),
        captureScreen: () => captureScreen(),
        capturePrevious: () => capturePrevious(),
        captureWindow: (id: string) => captureWindow(id),
        openSettings: (tab?: string) => {
          openSettings(tab);
        },
        openHistory,
        openWindowPicker,
        timedCapture,
        quickItems: () => quick.items(),
        history: () => history().list(),
        statuses: () => statuses,
        settings: () => settings,
      };
    }
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    area.reset();
  });
}
