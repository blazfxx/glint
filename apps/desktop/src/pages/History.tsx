import { Camera, Copy, Download, FolderOpen, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { matches } from '../../electron/history-index';
import { type CaptureItem } from '../../shared/ipc';
import { buttonClass } from '../components/controls';
import { formatBytes, formatWhen, historyImage } from '../format';
import { glint } from '../glint';

/** Every capture Glint has kept, newest first, with search and the actions for each. */
export function History({ mac }: { mac: boolean }) {
  const [items, setItems] = useState<readonly CaptureItem[] | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void glint().invoke('history:list').then(setItems);
    return glint().on('history:changed', setItems);
  }, []);

  const shown = useMemo(() => (items ?? []).filter((item) => matches(item, query)), [items, query]);
  const current = shown.find((item) => item.id === selected) ?? shown[0] ?? null;

  if (items === null)
    return <div className="flex h-full items-center justify-center text-ink-subtle">Loading…</div>;

  return (
    <div className="flex h-full flex-col">
      <header
        className={`drag flex items-center gap-3 border-b border-edge px-5 pb-3 ${mac ? 'pt-11' : 'pt-4'}`}
      >
        <h1 className="text-[15px] font-semibold">History</h1>
        <span className="text-[12px] text-ink-subtle">{items.length} captures</span>
        <label className="no-drag ml-auto flex h-8 w-64 items-center gap-2 rounded-lg border border-edge-strong bg-panel px-2.5">
          <Search size={14} className="text-ink-subtle" aria-hidden />
          <input
            aria-label="Search history"
            placeholder="Search by name or date"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
      </header>
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Camera size={32} className="text-ink-subtle" aria-hidden />
          <p className="font-medium">No captures yet</p>
          <p className="max-w-xs text-ink-muted">
            Screenshots you take show up here, so you can copy them again later.
          </p>
          <button
            type="button"
            className={buttonClass}
            onClick={() => void glint().invoke('capture:area')}
          >
            Capture an area
          </button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ul
            aria-label="Captures"
            className="grid min-w-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 overflow-y-auto p-5"
          >
            {shown.length === 0 ? (
              <li className="col-span-full text-ink-muted">Nothing matches “{query}”.</li>
            ) : null}
            {shown.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid="history-item"
                  aria-pressed={current?.id === item.id}
                  onClick={() => {
                    setSelected(item.id);
                  }}
                  onDoubleClick={() => void glint().invoke('history:copy', item.id)}
                  className={`flex w-full flex-col overflow-hidden rounded-xl border text-left transition-colors ${
                    current?.id === item.id
                      ? 'border-accent ring-2 ring-accent/30'
                      : 'border-edge hover:border-edge-strong'
                  }`}
                >
                  <span className="flex h-28 items-center justify-center bg-black/[0.04] dark:bg-black/30">
                    <img
                      src={historyImage(item.id)}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                      loading="lazy"
                    />
                  </span>
                  <span className="truncate px-2.5 pt-2 text-[12px] font-medium">{item.name}</span>
                  <span className="px-2.5 pb-2 text-[11px] text-ink-subtle">
                    {formatWhen(item.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {current ? (
            <aside
              aria-label="Capture"
              className="flex w-72 shrink-0 flex-col gap-3 border-l border-edge bg-panel p-5"
            >
              <img
                src={historyImage(current.id)}
                alt={current.name}
                className="max-h-48 w-full rounded-lg object-contain"
              />
              <p className="font-semibold break-all">{current.name}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                <dt className="text-ink-muted">Taken</dt>
                <dd>{formatWhen(current.createdAt)}</dd>
                <dt className="text-ink-muted">Size</dt>
                <dd className="tabular-nums">
                  {current.width} × {current.height} px · {formatBytes(current.size)}
                </dd>
                <dt className="text-ink-muted">Saved</dt>
                <dd className="break-all">{current.savedPath ?? 'Only in the history'}</dd>
              </dl>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    void glint()
                      .invoke('history:copy', current.id)
                      .then(() => {
                        setCopied(current.id);
                      });
                  }}
                >
                  <Copy size={13} aria-hidden />
                  {copied === current.id ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => void glint().invoke('history:reveal', current.id)}
                >
                  <FolderOpen size={13} aria-hidden />
                  Show
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => void glint().invoke('history:save-as', current.id)}
                >
                  <Download size={13} aria-hidden />
                  Save as…
                </button>
                <button
                  type="button"
                  data-testid="history-delete"
                  className={`${buttonClass} hover:border-red-400/60 hover:text-red-500`}
                  onClick={() => void glint().invoke('history:delete', current.id)}
                >
                  <Trash2 size={13} aria-hidden />
                  Remove
                </button>
              </div>
              <p className="text-[11.5px] text-ink-subtle">
                Remove takes it out of the history; a file you saved stays.
              </p>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}
