import { app, shell, systemPreferences } from 'electron';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { type PermissionState } from '../shared/ipc';

/** Screen Recording permission on macOS; the other systems do not ask. */
export function screenPermission(): PermissionState {
  if (process.platform !== 'darwin') return 'granted';
  return systemPreferences.getMediaAccessStatus('screen');
}

export async function openScreenPermissionSettings(): Promise<void> {
  if (process.platform !== 'darwin') return;
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  );
}

/** Linux desktops start apps listed in ~/.config/autostart; Electron only handles macOS and Windows. */
const autostartFile = () => path.join(homedir(), '.config', 'autostart', 'glint.desktop');

export const loginItemSupported = (): boolean => process.platform !== 'linux' || app.isPackaged;

export function setLaunchAtLogin(enabled: boolean): void {
  if (process.platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: enabled });
    return;
  }
  if (!app.isPackaged) return;
  if (!enabled) {
    rmSync(autostartFile(), { force: true });
    return;
  }
  const exec = process.env.APPIMAGE ?? process.execPath;
  mkdirSync(path.dirname(autostartFile()), { recursive: true });
  writeFileSync(
    autostartFile(),
    [
      '[Desktop Entry]',
      'Type=Application',
      'Name=Glint',
      `Exec="${exec}"`,
      'X-GNOME-Autostart-enabled=true',
      '',
    ].join('\n'),
  );
}
