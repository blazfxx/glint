import { contextBridge, ipcRenderer } from 'electron';
import { EVENT_CHANNELS, requests, type GlintBridge } from '../shared/ipc';

const allowedRequests = new Set(Object.keys(requests));
const allowedEvents = new Set<string>(EVENT_CHANNELS);

/** Pages can only use the named requests and events; the main process validates every payload. */
const bridge: GlintBridge = {
  invoke: ((channel: string, ...payload: unknown[]) => {
    if (!allowedRequests.has(channel))
      return Promise.reject(new Error(`Unknown request ${channel}`));
    return ipcRenderer.invoke(channel, payload[0]);
  }) as GlintBridge['invoke'],
  on: (event, listener) => {
    if (!allowedEvents.has(event)) throw new Error(`Unknown event ${event}`);
    const handler = (_: Electron.IpcRendererEvent, value: Parameters<typeof listener>[0]) => {
      listener(value);
    };
    ipcRenderer.on(event, handler);
    return () => {
      ipcRenderer.removeListener(event, handler);
    };
  },
};

contextBridge.exposeInMainWorld('glint', bridge);
