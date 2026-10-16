import { Copy, FolderOpen, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type CaptureItem } from '../../shared/ipc';
import { historyImage } from '../format';
import { glint } from '../glint';

function Card({ item, dismissAfter }: { item: CaptureItem; dismissAfter: number }) {
  const [hover, setHover] = useState(false);
  const [copied, setCopied] = useState(false);

  // Leaves on its own after the set time, but not while the pointer is over it.
  useEffect(() => {
    if (dismissAfter === 0 || hover) return;
    const timer = window.setTimeout(
      () => void glint().invoke('quick:close', item.id),
      dismissAfter * 1000,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [dismissAfter, hover, item.id]);

  const action =
    'flex h-7 items-center gap-1.5 rounded-md bg-white/10 px-2.5 text-[12px] font-medium text-white hover:bg-white/20';
  return (
    <article
      data-testid="quick-card"
      onPointerEnter={() => {
        setHover(true);
      }}
      onPointerLeave={() => {
        setHover(false);
      }}
      className="animate-in relative flex h-[206px] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1c1d22]/95 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur"
    >
      <div
        draggable
        title="Drag into any app"
        onDragStart={(event) => {
          event.preventDefault();
          void glint().invoke('quick:drag', item.id);
        }}
        className="relative min-h-0 flex-1 cursor-grab bg-black/40 active:cursor-grabbing"
      >
        <img
          src={historyImage(item.id)}
          alt={item.name}
          className="h-full w-full object-contain"
          draggable={false}
        />
        <button
          type="button"
          aria-label="Close"
          onClick={() => void glint().invoke('quick:close', item.id)}
          className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/60 text-white/90 hover:bg-black/80"
        >
          <X size={13} aria-hidden />
        </button>
      </div>
      <div className="flex items-center gap-1.5 p-2">
        <button
          type="button"
          className={action}
          onClick={() => {
            void glint()
              .invoke('quick:copy', item.id)
              .then(() => {
                setCopied(true);
              });
          }}
        >
          <Copy size={12} aria-hidden />
          {copied ? 'Copied' : 'Copy'}
        </button>
        {item.savedPath ? (
          <button
            type="button"
            className={action}
            onClick={() => void glint().invoke('quick:reveal', item.id)}
          >
            <FolderOpen size={12} aria-hidden />
            Show
          </button>
        ) : (
          <button
            type="button"
            className={action}
            onClick={() => void glint().invoke('quick:save', item.id)}
          >
            <Save size={12} aria-hidden />
            Save…
          </button>
        )}
        <span className="ml-auto text-[11px] text-white/50 tabular-nums">
          {item.width}×{item.height}
        </span>
      </div>
    </article>
  );
}

/** The stack of recent captures in a screen corner. */
export function QuickAccess() {
  const [items, setItems] = useState<readonly CaptureItem[]>([]);
  const [dismissAfter, setDismissAfter] = useState(10);
  useEffect(() => {
    const stopItems = glint().on('quick:items', setItems);
    const stopSettings = glint().on('settings:changed', (settings) => {
      setDismissAfter(settings.quickAccess.dismissAfter);
    });
    void glint()
      .invoke('settings:get')
      .then((settings) => {
        setDismissAfter(settings.quickAccess.dismissAfter);
      });
    return () => {
      stopItems();
      stopSettings();
    };
  }, []);
  return (
    <div className="flex flex-col gap-2.5 p-2.5">
      {items.map((item) => (
        <Card key={item.id} item={item} dismissAfter={dismissAfter} />
      ))}
    </div>
  );
}
