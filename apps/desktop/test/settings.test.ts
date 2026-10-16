import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from '../shared/settings';

describe('settings', () => {
  it('start from the defaults when nothing valid is saved', () => {
    expect(mergeSettings(DEFAULT_SETTINGS, null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(DEFAULT_SETTINGS, 'broken')).toEqual(DEFAULT_SETTINGS);
  });

  it('take each valid field and ignore the rest', () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, {
      screenshots: { format: 'webp', quality: 400, unknown: true },
      quickAccess: { dismissAfter: 7, corner: 'bottom-left' },
      shortcuts: {
        captureArea: 'shift+cmd+a',
        openHistory: null,
        nothing: 'x',
      },
      extra: { a: 1 },
    });
    expect(merged.screenshots.format).toBe('webp');
    expect(merged.screenshots.quality).toBe(DEFAULT_SETTINGS.screenshots.quality);
    expect(merged.quickAccess).toEqual({
      ...DEFAULT_SETTINGS.quickAccess,
      corner: 'bottom-left',
    });
    expect(merged.shortcuts.captureArea).toBe('CommandOrControl+Shift+A');
    expect(merged.shortcuts.openHistory).toBeNull();
    expect('extra' in merged).toBe(false);
  });

  it('turn an unreadable shortcut off rather than failing', () => {
    expect(
      mergeSettings(DEFAULT_SETTINGS, { shortcuts: { captureArea: 'Hyper+Q' } }).shortcuts
        .captureArea,
    ).toBeNull();
  });
});
