import { type GlintBridge } from '../shared/ipc';

declare global {
  interface Window {
    readonly glint?: GlintBridge;
  }
}

/** The bridge to the main process; every Glint page runs inside the desktop app. */
export function glint(): GlintBridge {
  if (!window.glint) throw new Error('Glint pages run inside the Glint app.');
  return window.glint;
}

/** The hash route: "#settings?tab=general" → { page: 'settings', params }. */
export function route(): { page: string; params: URLSearchParams } {
  const [page = '', query = ''] = window.location.hash.replace(/^#/, '').split('?');
  return { page, params: new URLSearchParams(query) };
}
