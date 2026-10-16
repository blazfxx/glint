import { type ShortcutAction } from '@glint/shortcuts';
import { z } from 'zod';
import { type Settings, type SettingsPatch } from './settings';

/** Whether each shortcut is working, and if not, why. */
export type ShortcutStatus =
  | { readonly state: 'off' }
  | { readonly state: 'active' }
  | { readonly state: 'taken' }
  | { readonly state: 'duplicate'; readonly with: ShortcutAction }
  | { readonly state: 'system'; readonly reason: string }
  | { readonly state: 'invalid' };

export type ShortcutStatuses = Readonly<Record<ShortcutAction, ShortcutStatus>>;

export type PermissionState = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';

export type UpdateState =
  | { readonly status: 'idle' }
  | { readonly status: 'unsupported'; readonly reason: string }
  | { readonly status: 'checking' }
  | { readonly status: 'current' }
  | {
      readonly status: 'available';
      readonly version: string;
      readonly canInstall: boolean;
    }
  | { readonly status: 'downloading'; readonly percent: number }
  | { readonly status: 'ready'; readonly version: string }
  | { readonly status: 'error'; readonly message: string };

/** One capture, as the history and the quick access window know it. */
export interface CaptureItem {
  readonly id: string;
  readonly createdAt: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Where the user's copy was saved, when it was. */
  readonly savedPath: string | null;
  /** Bytes of the history copy. */
  readonly size: number;
}

export interface AppInfo {
  readonly version: string;
  readonly platform: 'darwin' | 'win32' | 'linux';
  /** The folder captures are saved to when no folder is chosen. */
  readonly defaultFolder: string;
  /** Launch at login can be set on this system. */
  readonly loginItemSupported: boolean;
}

/** A selection made on one display's overlay, in that display's points. */
export const selectionSchema = z.object({
  displayId: z.string(),
  /** The whole display, whatever the page thinks its size is. */
  whole: z.boolean().optional(),
  rect: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  }),
});
export type Selection = z.infer<typeof selectionSchema>;

/** What a window page asks of the main process. Each request is checked against its schema. */
export const requests = {
  'app:info': z.undefined(),
  'settings:get': z.undefined(),
  'settings:set': z.record(z.string(), z.unknown()),
  'settings:choose-folder': z.undefined(),
  'shortcuts:status': z.undefined(),
  /** Shortcuts stop working while one is being recorded, so the keys reach the page. */
  'shortcuts:pause': z.boolean(),
  'permissions:screen': z.undefined(),
  'permissions:open-settings': z.undefined(),
  'update:state': z.undefined(),
  'update:check': z.undefined(),
  'update:install': z.undefined(),
  'capture:area': z.undefined(),
  'capture:screen': z.undefined(),
  'capture:window-list': z.undefined(),
  'capture:window': z.string().min(1),
  'capture:timed': z.union([z.literal(3), z.literal(5), z.literal(10)]),
  'overlay:select': selectionSchema,
  'overlay:cancel': z.undefined(),
  /** The overlay has drawn its frame and can be shown. */
  'overlay:ready': z.string(),
  'quick:copy': z.string(),
  'quick:save': z.string(),
  'quick:reveal': z.string(),
  'quick:drag': z.string(),
  'quick:close': z.string(),
  'history:list': z.undefined(),
  'history:copy': z.string(),
  'history:reveal': z.string(),
  'history:save-as': z.string(),
  'history:delete': z.string(),
  'history:open': z.undefined(),
  'encoder:done': z.object({
    id: z.string(),
    data: z.instanceof(Uint8Array).nullable(),
  }),
} as const;

export type RequestChannel = keyof typeof requests;

/** A window listed by the window picker. */
export interface WindowSource {
  readonly id: string;
  readonly name: string;
  readonly thumbnail: string;
  readonly icon: string | null;
}

/** What each request answers. */
export interface Responses {
  'app:info': AppInfo;
  'settings:get': Settings;
  'settings:set': Settings;
  'settings:choose-folder': Settings;
  'shortcuts:status': ShortcutStatuses;
  'shortcuts:pause': undefined;
  'permissions:screen': PermissionState;
  'permissions:open-settings': undefined;
  'update:state': UpdateState;
  'update:check': UpdateState;
  'update:install': undefined;
  'capture:area': undefined;
  'capture:screen': undefined;
  'capture:window-list': readonly WindowSource[];
  'capture:window': undefined;
  'capture:timed': undefined;
  'overlay:select': undefined;
  'overlay:cancel': undefined;
  'overlay:ready': undefined;
  'quick:copy': undefined;
  'quick:save': undefined;
  'quick:reveal': undefined;
  'quick:drag': undefined;
  'quick:close': undefined;
  'history:list': readonly CaptureItem[];
  'history:copy': undefined;
  'history:reveal': undefined;
  'history:save-as': undefined;
  'history:delete': readonly CaptureItem[];
  'history:open': undefined;
  'encoder:done': undefined;
}

/** What the main process tells pages. */
export interface Events {
  'settings:changed': Settings;
  'shortcuts:changed': ShortcutStatuses;
  'update:changed': UpdateState;
  'quick:items': readonly CaptureItem[];
  'history:changed': readonly CaptureItem[];
  'overlay:frame': {
    readonly displayId: string;
    readonly url: string;
    readonly scale: number;
  };
  'countdown:tick': number;
  'encoder:job': {
    readonly id: string;
    readonly png: Uint8Array;
    readonly quality: number;
  };
}

export type EventChannel = keyof Events;

export const EVENT_CHANNELS: readonly EventChannel[] = [
  'settings:changed',
  'shortcuts:changed',
  'update:changed',
  'quick:items',
  'history:changed',
  'overlay:frame',
  'countdown:tick',
  'encoder:job',
];

/** The bridge the preload script gives every Glint page as `window.glint`. */
export interface GlintBridge {
  invoke<C extends RequestChannel>(
    channel: C,
    ...payload: z.input<(typeof requests)[C]> extends undefined
      ? []
      : [z.input<(typeof requests)[C]>]
  ): Promise<Responses[C]>;
  on<E extends EventChannel>(event: E, listener: (payload: Events[E]) => void): () => void;
}

export type { Settings, SettingsPatch };
