import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

interface Item {
  id: string;
  name: string;
  width: number;
  height: number;
  savedPath: string | null;
}
interface Hooks {
  captureArea(): Promise<void>;
  captureScreen(): Promise<void>;
  capturePrevious(): Promise<void>;
  openSettings(tab?: string): void;
  openHistory(): void;
  openWindowPicker(): void;
  history(): Item[];
  quickItems(): Item[];
  statuses(): Record<string, { state: string }>;
}
type Hooked = typeof globalThis & { __glint?: Hooks };

/** Starts Glint with a fresh profile and capture folder; the test hooks are on globalThis.__glint. */
async function start(): Promise<{
  app: ElectronApplication;
  folder: string;
  profile: string;
}> {
  const profile = mkdtempSync(path.join(tmpdir(), 'glint-profile-'));
  const folder = mkdtempSync(path.join(tmpdir(), 'glint-shots-'));
  const app = await electron.launch({
    args: [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '.'],
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      GLINT_TEST: '1',
      GLINT_USER_DATA: profile,
      GLINT_CAPTURE_DIR: folder,
    },
  });
  await app.evaluate(async () => {
    for (let i = 0; i < 100 && !(globalThis as Hooked).__glint; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
  return { app, folder, profile };
}

const history = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as Hooked).__glint!.history());

async function pageWith(app: ElectronApplication, hash: string): Promise<Page> {
  for (let i = 0; i < 100; i++) {
    const page = app.windows().find((w) => w.url().includes(`#${hash}`));
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No ${hash} window`);
}

/** The size of the image now on the clipboard. */
const clipboardSize = (app: ElectronApplication) =>
  app.evaluate(async ({ clipboard, nativeImage }) => {
    const items = await clipboard.read();
    const item = items.find((i) => i.types.includes('image/png'));
    if (!item) return null;
    const blob = await item.getType('image/png');
    return nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer())).getSize();
  });

test('captures the full screen to the clipboard, the folder, the history and the corner', async () => {
  const { app, folder } = await start();
  const display = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().size);
  await app.evaluate(() => (globalThis as Hooked).__glint!.captureScreen());
  const items = await history(app);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    width: display.width,
    height: display.height,
  });
  expect(await clipboardSize(app)).toEqual(display);
  const files = readdirSync(folder);
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^Glint \d{4}-\d\d-\d\d at \d\d\.\d\d\.\d\d\.png$/);
  // A PNG on disk: its header and its size.
  const png = readFileSync(path.join(folder, files[0] ?? ''));
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(display.width);

  const quick = await pageWith(app, 'quick');
  await expect(quick.getByTestId('quick-card')).toHaveCount(1);
  await expect(quick.getByText(`${String(display.width)}×${String(display.height)}`)).toBeVisible();
  await quick.getByRole('button', { name: 'Close' }).click();
  await expect
    .poll(() => app.evaluate(() => (globalThis as Hooked).__glint!.quickItems().length))
    .toBe(0);
  await app.close();
});

test('captures a dragged area, the same area again, and nothing on Escape', async () => {
  const { app } = await start();
  const capture = app.evaluate(() => (globalThis as Hooked).__glint!.captureArea());
  const overlay = await pageWith(app, 'overlay');
  await expect(overlay.getByTestId('overlay')).toBeVisible();
  await overlay.mouse.move(100, 120);
  await overlay.mouse.down();
  await overlay.mouse.move(250, 200, { steps: 5 });
  await expect(overlay.getByTestId('selection')).toBeVisible();
  await expect(overlay.getByText('150 × 80')).toBeVisible();
  await overlay.mouse.up();
  await capture;
  expect((await history(app))[0]).toMatchObject({ width: 150, height: 80 });
  expect(await clipboardSize(app)).toEqual({ width: 150, height: 80 });

  await app.evaluate(() => (globalThis as Hooked).__glint!.capturePrevious());
  const again = await history(app);
  expect(again).toHaveLength(2);
  expect(again[0]).toMatchObject({ width: 150, height: 80 });

  const cancelled = app.evaluate(() => (globalThis as Hooked).__glint!.captureArea());
  await expect(overlay.getByTestId('overlay')).toBeVisible();
  await overlay.keyboard.press('Escape');
  await cancelled;
  expect(await history(app)).toHaveLength(2);

  // Enter takes the whole display from the overlay.
  const whole = app.evaluate(() => (globalThis as Hooked).__glint!.captureArea());
  await expect(overlay.getByTestId('overlay')).toBeVisible();
  await overlay.mouse.move(10, 10);
  await overlay.keyboard.press('Enter');
  await whole;
  const display = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().size);
  expect((await history(app))[0]).toMatchObject({
    width: display.width,
    height: display.height,
  });
  await app.close();
});

test('rebinds a shortcut, refuses a clash, and keeps it after a restart', async () => {
  const first = await start();
  let app = first.app;
  expect(
    Object.values(await app.evaluate(() => (globalThis as Hooked).__glint!.statuses())).map(
      (s) => s.state,
    ),
  ).toEqual(['active', 'active', 'active', 'active', 'active']);
  await app.evaluate(() => {
    (globalThis as Hooked).__glint!.openSettings('shortcuts');
  });
  const settings = await pageWith(app, 'settings');
  await expect(settings.getByRole('heading', { name: 'Shortcuts' })).toBeVisible();

  await settings.getByTestId('shortcut-Capture area').click();
  await expect(settings.getByTestId('shortcut-Capture area')).toHaveText('Press keys…');
  await settings.keyboard.press('Control+Alt+K');
  await expect(settings.getByTestId('shortcut-Capture area')).toHaveText('Ctrl+Alt+K');

  // The same keys as Open history: refused, with the reason.
  await settings.getByTestId('shortcut-Capture full screen').click();
  await settings.keyboard.press('Control+Shift+9');
  await expect(settings.getByTestId('shortcut-problem-captureScreen')).toContainText(
    'Open history',
  );
  await app.close();

  app = await electron.launch({
    args: ['--no-sandbox', '.'],
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      GLINT_TEST: '1',
      GLINT_USER_DATA: first.profile,
      GLINT_CAPTURE_DIR: first.folder,
    },
  });
  await app.evaluate(async () => {
    for (let i = 0; i < 100 && !(globalThis as Hooked).__glint; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
  const saved = JSON.parse(readFileSync(path.join(first.profile, 'settings.json'), 'utf8')) as {
    shortcuts: Record<string, string>;
  };
  expect(saved.shortcuts.captureArea).toBe('CommandOrControl+Alt+K');
  expect(
    (await app.evaluate(() => (globalThis as Hooked).__glint!.statuses())).captureArea?.state,
  ).toBe('active');
  await app.close();
});

test('saves as JPG at 1x, lists captures in the history and removes them', async () => {
  const { app, folder } = await start();
  await app.evaluate(() => {
    (globalThis as Hooked).__glint!.openSettings('screenshots');
  });
  const settings = await pageWith(app, 'settings');
  await settings.getByRole('radio', { name: 'JPG' }).click();
  await expect(settings.getByRole('slider', { name: 'Quality' })).toBeVisible();
  await settings.getByRole('switch', { name: 'Show the capture in a corner' }).click();
  await app.evaluate(() => (globalThis as Hooked).__glint!.captureScreen());
  const files = readdirSync(folder);
  expect(files[0]).toMatch(/\.jpg$/);
  expect(
    readFileSync(path.join(folder, files[0] ?? ''))
      .subarray(0, 2)
      .toString('hex'),
  ).toBe('ffd8');
  expect(await app.evaluate(() => (globalThis as Hooked).__glint!.quickItems().length)).toBe(0);

  await app.evaluate(() => (globalThis as Hooked).__glint!.captureScreen());
  await app.evaluate(() => {
    (globalThis as Hooked).__glint!.openHistory();
  });
  const library = await pageWith(app, 'history');
  await expect(library.getByTestId('history-item')).toHaveCount(2);
  await library.getByRole('textbox', { name: 'Search history' }).fill('nothing-like-this');
  await expect(library.getByText('Nothing matches')).toBeVisible();
  await library.getByRole('textbox', { name: 'Search history' }).fill('');
  await library.getByTestId('history-delete').click();
  await expect(library.getByTestId('history-item')).toHaveCount(1);
  // The saved file stays; only the history entry goes.
  expect(readdirSync(folder)).toHaveLength(2);
  const remaining = await history(app);
  expect(existsSync(remaining[0]?.savedPath ?? '')).toBe(true);
  await app.close();
});

test('lists windows to capture', async () => {
  const { app } = await start();
  await app.evaluate(() => {
    (globalThis as Hooked).__glint!.openWindowPicker();
  });
  const picker = await pageWith(app, 'windows');
  await expect(picker.getByRole('heading', { name: 'Capture a window' })).toBeVisible();
  // A bare X server has no other windows; either way the page settles on a list or says so.
  await expect(picker.getByText('Looking for windows…')).toHaveCount(0, {
    timeout: 15_000,
  });
  await app.close();
});
