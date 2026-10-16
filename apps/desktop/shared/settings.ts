import { DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS, normalizeAccelerator } from '@glint/shortcuts';
import { DEFAULT_NAME_TEMPLATE } from '@glint/capture-core';
import { z } from 'zod';

const accelerator = z
  .string()
  .nullable()
  .transform((value) => (value === null ? null : normalizeAccelerator(value)));

const shortcuts = z.object(
  Object.fromEntries(SHORTCUT_ACTIONS.map((action) => [action, accelerator])) as Record<
    (typeof SHORTCUT_ACTIONS)[number],
    typeof accelerator
  >,
);

export const IMAGE_FORMATS = ['png', 'jpg', 'webp'] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

export const settingsSchema = z.object({
  shortcuts,
  screenshots: z.object({
    copyToClipboard: z.boolean(),
    saveToFolder: z.boolean(),
    /** Null saves to the default folder (Pictures/Glint). */
    folder: z.string().min(1).nullable(),
    nameTemplate: z.string().max(200),
    format: z.enum(IMAGE_FORMATS),
    /** Quality for JPG and WebP, 50 to 100. */
    quality: z.number().int().min(50).max(100),
    /** Keep every device pixel (Retina); false scales to the size in points (1x). */
    retina: z.boolean(),
  }),
  quickAccess: z.object({
    enabled: z.boolean(),
    corner: z.enum(['bottom-right', 'bottom-left']),
    /** Seconds a capture stays on screen; 0 keeps it until closed. */
    dismissAfter: z.union([
      z.literal(0),
      z.literal(5),
      z.literal(10),
      z.literal(20),
      z.literal(60),
    ]),
  }),
  history: z.object({
    /** How many captures the history keeps; 0 keeps everything. */
    keep: z.union([z.literal(0), z.literal(100), z.literal(500), z.literal(1000)]),
  }),
  general: z.object({
    launchAtLogin: z.boolean(),
    autoUpdate: z.boolean(),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  shortcuts: DEFAULT_SHORTCUTS,
  screenshots: {
    copyToClipboard: true,
    saveToFolder: true,
    folder: null,
    nameTemplate: DEFAULT_NAME_TEMPLATE,
    format: 'png',
    quality: 90,
    retina: true,
  },
  quickAccess: { enabled: true, corner: 'bottom-right', dismissAfter: 10 },
  history: { keep: 500 },
  general: { launchAtLogin: false, autoUpdate: true },
};

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
export type SettingsPatch = DeepPartial<Settings>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Settings from anything: each field that is valid is kept, everything else (unknown keys, wrong
 * types, a broken file) falls back to what `base` has. Saved settings from an older or newer Glint
 * therefore never stop it from starting.
 */
export function mergeSettings(base: Settings, patch: unknown): Settings {
  const merged: Record<string, unknown> = {};
  for (const [section, defaults] of Object.entries(base) as [string, Record<string, unknown>][]) {
    const incoming = isRecord(patch) && isRecord(patch[section]) ? patch[section] : {};
    const sectionSchema = settingsSchema.shape[section as keyof Settings];
    const next: Record<string, unknown> = { ...defaults };
    for (const key of Object.keys(defaults)) {
      if (!(key in incoming)) continue;
      const candidate = { ...next, [key]: incoming[key] };
      const parsed = sectionSchema.safeParse(candidate);
      if (parsed.success) next[key] = (parsed.data as Record<string, unknown>)[key];
    }
    merged[section] = next;
  }
  return settingsSchema.parse(merged);
}
