import { AppWindow, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { type WindowSource } from '../../shared/ipc';
import { buttonClass } from '../components/controls';
import { glint } from '../glint';

/**
 * Pick a window to capture. Electron cannot tell where windows are on screen, so instead of
 * hovering over them (that arrives with the native capture module) you pick one from this list.
 */
export function WindowPicker() {
  const [sources, setSources] = useState<readonly WindowSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchList = useCallback(() => {
    glint()
      .invoke('capture:window-list')
      .then(setSources, (failure: unknown) => {
        setError(failure instanceof Error ? failure.message : 'The windows could not be listed.');
        setSources([]);
      });
  }, []);
  useEffect(() => {
    fetchList();
  }, [fetchList]);
  const load = () => {
    setSources(null);
    setError(null);
    fetchList();
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-edge px-5 py-3">
        <h1 className="text-[15px] font-semibold">Capture a window</h1>
        <span className="text-[12px] text-ink-subtle">Click a window to capture it.</span>
        <button type="button" className={`${buttonClass} ml-auto`} onClick={load}>
          <RefreshCw size={13} aria-hidden />
          Refresh
        </button>
      </header>
      {sources === null ? (
        <p className="flex flex-1 items-center justify-center text-ink-subtle">
          Looking for windows…
        </p>
      ) : sources.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <AppWindow size={30} className="text-ink-subtle" aria-hidden />
          <p className="font-medium">No windows to capture</p>
          <p className="max-w-sm text-ink-muted">
            {error ?? 'Open the window you want, then press Refresh.'}
          </p>
        </div>
      ) : (
        <ul
          aria-label="Windows"
          className="grid auto-rows-min grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 overflow-y-auto p-5"
        >
          {sources.map((source) => (
            <li key={source.id}>
              <button
                type="button"
                data-testid="window-source"
                onClick={() => void glint().invoke('capture:window', source.id)}
                className="flex w-full flex-col overflow-hidden rounded-xl border border-edge text-left hover:border-accent"
              >
                <span className="flex h-32 items-center justify-center bg-black/[0.04] dark:bg-black/30">
                  <img
                    src={source.thumbnail}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </span>
                <span className="flex items-center gap-2 px-2.5 py-2">
                  {source.icon ? <img src={source.icon} alt="" className="size-4" /> : null}
                  <span className="truncate text-[12px] font-medium">{source.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
