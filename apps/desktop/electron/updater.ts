import { app, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { type UpdateState } from '../shared/ipc';

export const RELEASES_URL = 'https://github.com/blazfxx/glint/releases/latest';

/**
 * Updates come from GitHub Releases through electron-updater. Windows and Linux (AppImage) builds
 * download and install the update. Mac builds are not Developer ID signed yet, and macOS refuses
 * to swap in an unsigned update, so there a new version is announced and its download page opened.
 */
export function createUpdater(onState: (state: UpdateState) => void) {
  const { autoUpdater } = electronUpdater;
  let state: UpdateState = { status: 'idle' };
  const set = (next: UpdateState) => {
    state = next;
    onState(next);
  };

  const canInstall =
    process.platform === 'win32' || (process.platform === 'linux' && Boolean(process.env.APPIMAGE));
  const supported = app.isPackaged && !process.env.GLINT_TEST;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = canInstall;
  autoUpdater.on('update-available', (info) => {
    set({ status: 'available', version: info.version, canInstall });
  });
  autoUpdater.on('update-not-available', () => {
    set({ status: 'current' });
  });
  autoUpdater.on('download-progress', (progress) => {
    set({ status: 'downloading', percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    set({ status: 'ready', version: info.version });
  });
  autoUpdater.on('error', (error) => {
    set({
      status: 'error',
      message: error.message.split('\n')[0] ?? 'The update failed.',
    });
  });

  if (!supported) {
    state = {
      status: 'unsupported',
      reason: 'Updates are checked in installed builds.',
    };
  }

  return {
    state: () => state,
    async check(download: boolean): Promise<UpdateState> {
      if (!supported) return state;
      set({ status: 'checking' });
      try {
        const result = await autoUpdater.checkForUpdates();
        if (download && canInstall && result?.isUpdateAvailable) await autoUpdater.downloadUpdate();
      } catch (error) {
        set({
          status: 'error',
          message: error instanceof Error ? error.message : 'The check failed.',
        });
      }
      return state;
    },
    async install() {
      if (state.status === 'ready') {
        autoUpdater.quitAndInstall();
        return;
      }
      if (state.status === 'available' && canInstall) {
        await autoUpdater.downloadUpdate();
        return;
      }
      await shell.openExternal(RELEASES_URL);
    },
  };
}

export type Updater = ReturnType<typeof createUpdater>;
