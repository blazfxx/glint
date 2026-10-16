import { formatAccelerator, recordKeyPress, type Platform } from '@glint/shortcuts';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { glint } from '../glint';

/**
 * A shortcut field: click it, press the keys, done. While it listens, Glint's shortcuts are paused
 * so pressing an existing one records it instead of starting a capture.
 */
export function ShortcutRecorder({
  label,
  value,
  platform,
  onChange,
}: {
  label: string;
  value: string | null;
  platform: Platform;
  onChange: (value: string | null) => void;
}) {
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (!listening) return;
    void glint().invoke('shortcuts:pause', true);
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        setListening(false);
        return;
      }
      const result = recordKeyPress(event, platform);
      if (result.status === 'waiting') return;
      if (result.status === 'invalid') {
        setHint(result.reason);
        return;
      }
      setHint(null);
      setListening(false);
      onChange(result.accelerator);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      void glint().invoke('shortcuts:pause', false);
    };
  }, [listening, platform, onChange]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Shortcut for ${label}`}
          data-testid={`shortcut-${label}`}
          onClick={() => {
            setHint(null);
            setListening(!listening);
          }}
          onBlur={() => {
            setListening(false);
          }}
          className={`h-8 min-w-36 rounded-lg border px-3 text-[12.5px] font-medium tabular-nums transition-colors ${
            listening
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-edge-strong text-ink hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
          }`}
        >
          {listening ? 'Press keys…' : value ? formatAccelerator(value, platform) : 'Not set'}
        </button>
        {value && !listening ? (
          <button
            type="button"
            aria-label={`Clear shortcut for ${label}`}
            onClick={() => {
              onChange(null);
            }}
            className="flex size-7 items-center justify-center rounded-md text-ink-subtle hover:text-ink"
          >
            <X size={14} aria-hidden />
          </button>
        ) : null}
      </div>
      {hint && listening ? (
        <p className="max-w-64 text-right text-[11.5px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
