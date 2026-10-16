import { fileNameFor } from '@glint/capture-core';
import {
  ACTION_LABELS,
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTIONS,
  normalizeAccelerator,
  type ShortcutAction,
} from '@glint/shortcuts';
import {
  CheckCircle2,
  CircleAlert,
  Folder,
  Keyboard,
  LoaderCircle,
  Monitor,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  type AppInfo,
  type PermissionState,
  type ShortcutStatus,
  type ShortcutStatuses,
  type UpdateState,
} from '../../shared/ipc';
import { type Settings as SettingsData, type SettingsPatch } from '../../shared/settings';
import { Card, Row, Segmented, Switch, buttonClass, primaryClass } from '../components/controls';
import { ShortcutRecorder } from '../components/ShortcutRecorder';
import { glint } from '../glint';

type Tab = 'general' | 'shortcuts' | 'screenshots' | 'permissions';

function statusText(status: ShortcutStatus): { text: string; ok: boolean } | null {
  switch (status.state) {
    case 'active':
    case 'off':
      return null;
    case 'taken':
      return {
        text: 'Another app is using this shortcut. Pick another.',
        ok: false,
      };
    case 'duplicate':
      return {
        text: `Already used for ${ACTION_LABELS[status.with]}.`,
        ok: false,
      };
    case 'system':
      return { text: status.reason, ok: false };
    case 'invalid':
      return { text: 'This shortcut cannot be used.', ok: false };
  }
}

function Shortcuts({
  settings,
  statuses,
  info,
  onChange,
}: {
  settings: SettingsData;
  statuses: ShortcutStatuses;
  info: AppInfo;
  onChange: (patch: SettingsPatch) => void;
}) {
  // A shortcut another action already has is refused on the row being edited, with the reason.
  const [refused, setRefused] = useState<{
    action: ShortcutAction;
    other: ShortcutAction;
  } | null>(null);
  const set = useCallback(
    (action: ShortcutAction, value: string | null) => {
      const other =
        value === null
          ? undefined
          : SHORTCUT_ACTIONS.find(
              (a) =>
                a !== action &&
                settings.shortcuts[a] !== null &&
                settings.shortcuts[a] === normalizeAccelerator(value),
            );
      if (other) {
        setRefused({ action, other });
        return;
      }
      setRefused(null);
      onChange({ shortcuts: { [action]: value } });
    },
    [onChange, settings.shortcuts],
  );
  return (
    <div className="flex flex-col gap-6">
      <Card>
        {SHORTCUT_ACTIONS.map((action) => {
          const problem =
            refused?.action === action
              ? {
                  text: `Already used for ${ACTION_LABELS[refused.other]}.`,
                  ok: false,
                }
              : statusText(statuses[action]);
          return (
            <Row
              key={action}
              title={ACTION_LABELS[action]}
              detail={
                problem ? (
                  <span
                    data-testid={`shortcut-problem-${action}`}
                    className="flex items-center gap-1 text-amber-500"
                  >
                    <CircleAlert size={12} aria-hidden />
                    {problem.text}
                  </span>
                ) : undefined
              }
            >
              <ShortcutRecorder
                label={ACTION_LABELS[action]}
                value={settings.shortcuts[action]}
                platform={info.platform}
                onChange={(value) => {
                  set(action, value);
                }}
              />
            </Row>
          );
        })}
      </Card>
      <div>
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            onChange({ shortcuts: DEFAULT_SHORTCUTS });
          }}
        >
          Restore default shortcuts
        </button>
      </div>
    </div>
  );
}

function Screenshots({
  settings,
  info,
  onChange,
}: {
  settings: SettingsData;
  info: AppInfo;
  onChange: (patch: SettingsPatch) => void;
}) {
  const shots = settings.screenshots;
  const [template, setTemplate] = useState(shots.nameTemplate);
  const example = fileNameFor(template, new Date(), 'Screenshot', shots.format);
  return (
    <div className="flex flex-col gap-6">
      <Card title="After a capture">
        <Row title="Copy to the clipboard">
          <Switch
            label="Copy to the clipboard"
            checked={shots.copyToClipboard}
            onChange={(copyToClipboard) => {
              onChange({ screenshots: { copyToClipboard } });
            }}
          />
        </Row>
        <Row
          title="Save to a folder"
          detail={
            shots.saveToFolder
              ? (shots.folder ?? info.defaultFolder)
              : 'Captures stay in the clipboard and the history.'
          }
        >
          <div className="flex items-center gap-2">
            {shots.saveToFolder ? (
              <button
                type="button"
                className={buttonClass}
                onClick={() => void glint().invoke('settings:choose-folder')}
              >
                <Folder size={13} aria-hidden />
                Choose…
              </button>
            ) : null}
            <Switch
              label="Save to a folder"
              checked={shots.saveToFolder}
              onChange={(saveToFolder) => {
                onChange({ screenshots: { saveToFolder } });
              }}
            />
          </div>
        </Row>
        <Row title="Show the capture in a corner" detail="With Copy, Show and drag into any app.">
          <Switch
            label="Show the capture in a corner"
            checked={settings.quickAccess.enabled}
            onChange={(enabled) => {
              onChange({ quickAccess: { enabled } });
            }}
          />
        </Row>
        {settings.quickAccess.enabled ? (
          <>
            <Row title="Corner">
              <Segmented
                label="Corner"
                value={settings.quickAccess.corner}
                options={[
                  ['bottom-left', 'Bottom left'],
                  ['bottom-right', 'Bottom right'],
                ]}
                onChange={(corner) => {
                  onChange({ quickAccess: { corner } });
                }}
              />
            </Row>
            <Row title="Close it after">
              <Segmented
                label="Close it after"
                value={settings.quickAccess.dismissAfter}
                options={[
                  [5, '5 s'],
                  [10, '10 s'],
                  [20, '20 s'],
                  [60, '1 min'],
                  [0, 'Never'],
                ]}
                onChange={(dismissAfter) => {
                  onChange({ quickAccess: { dismissAfter } });
                }}
              />
            </Row>
          </>
        ) : null}
      </Card>
      <Card title="Files">
        <Row title="Format">
          <Segmented
            label="Format"
            value={shots.format}
            options={[
              ['png', 'PNG'],
              ['jpg', 'JPG'],
              ['webp', 'WebP'],
            ]}
            onChange={(format) => {
              onChange({ screenshots: { format } });
            }}
          />
        </Row>
        {shots.format !== 'png' ? (
          <Row title="Quality" detail={`${String(shots.quality)}%`}>
            <input
              type="range"
              aria-label="Quality"
              min={50}
              max={100}
              value={shots.quality}
              onChange={(event) => {
                onChange({
                  screenshots: { quality: Number(event.target.value) },
                });
              }}
              className="w-44 accent-[var(--accent)]"
            />
          </Row>
        ) : null}
        <Row
          title="Size"
          detail="Retina keeps every pixel of a high-resolution display; 1x halves a Retina capture."
        >
          <Segmented
            label="Size"
            value={shots.retina ? 'retina' : 'one'}
            options={[
              ['retina', 'Retina'],
              ['one', '1x'],
            ]}
            onChange={(size) => {
              onChange({ screenshots: { retina: size === 'retina' } });
            }}
          />
        </Row>
        <div className="flex flex-col gap-2 px-5 py-3.5">
          <label htmlFor="template" className="font-medium">
            File name
          </label>
          <input
            id="template"
            value={template}
            onChange={(event) => {
              setTemplate(event.target.value);
            }}
            onBlur={() => {
              onChange({ screenshots: { nameTemplate: template } });
            }}
            className="h-8 rounded-lg border border-edge-strong bg-bg px-3 text-[13px] outline-none focus:border-accent"
          />
          <p className="text-[12px] text-ink-muted">
            {example} · Use {'{date}'}, {'{time}'}, {'{year}'}, {'{month}'}, {'{day}'}, {'{hour}'},{' '}
            {'{minute}'}, {'{second}'}.
          </p>
        </div>
      </Card>
      <Card title="History">
        <Row
          title="Keep"
          detail="Older captures leave the history; files you saved stay where they are."
        >
          <Segmented
            label="Keep"
            value={settings.history.keep}
            options={[
              [100, '100'],
              [500, '500'],
              [1000, '1000'],
              [0, 'All'],
            ]}
            onChange={(keep) => {
              onChange({ history: { keep } });
            }}
          />
        </Row>
      </Card>
    </div>
  );
}

function updateText(state: UpdateState, version: string): ReactNode {
  switch (state.status) {
    case 'idle':
      return `Version ${version}`;
    case 'unsupported':
      return `Version ${version}. ${state.reason}`;
    case 'checking':
      return 'Checking for updates…';
    case 'current':
      return `You have the latest version, ${version}.`;
    case 'available':
      return state.canInstall
        ? `Version ${state.version} is available.`
        : `Version ${state.version} is available. Download it from GitHub.`;
    case 'downloading':
      return `Downloading the update… ${String(state.percent)}%`;
    case 'ready':
      return `Version ${state.version} is ready. Restart Glint to use it.`;
    case 'error':
      return `The update check failed: ${state.message}`;
  }
}

function General({
  settings,
  info,
  update,
  onChange,
}: {
  settings: SettingsData;
  info: AppInfo;
  update: UpdateState;
  onChange: (patch: SettingsPatch) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        {info.loginItemSupported ? (
          <Row title="Open Glint when you log in">
            <Switch
              label="Open Glint when you log in"
              checked={settings.general.launchAtLogin}
              onChange={(launchAtLogin) => {
                onChange({ general: { launchAtLogin } });
              }}
            />
          </Row>
        ) : null}
        <Row
          title="Update automatically"
          detail="Glint checks GitHub for new versions when it starts."
        >
          <Switch
            label="Update automatically"
            checked={settings.general.autoUpdate}
            onChange={(autoUpdate) => {
              onChange({ general: { autoUpdate } });
            }}
          />
        </Row>
      </Card>
      <Card title="Software update">
        <Row title={`Glint ${info.version}`} detail={updateText(update, info.version)}>
          {update.status === 'ready' || update.status === 'available' ? (
            <button
              type="button"
              className={primaryClass}
              onClick={() => void glint().invoke('update:install')}
            >
              {update.status === 'ready' ? 'Restart' : update.canInstall ? 'Update' : 'Download'}
            </button>
          ) : (
            <button
              type="button"
              className={buttonClass}
              disabled={
                update.status === 'checking' ||
                update.status === 'unsupported' ||
                update.status === 'downloading'
              }
              onClick={() => void glint().invoke('update:check')}
            >
              {update.status === 'checking' ? (
                <LoaderCircle size={13} className="animate-spin" aria-hidden />
              ) : null}
              Check for updates
            </button>
          )}
        </Row>
      </Card>
      <p className="px-1 text-[12px] text-ink-subtle">
        Glint is free and open source (MIT). Nothing you capture leaves this computer.
      </p>
    </div>
  );
}

function Permissions() {
  const [state, setState] = useState<PermissionState>('unknown');
  // Checks again every second, so the page turns green as soon as the permission is given.
  useEffect(() => {
    const read = () => void glint().invoke('permissions:screen').then(setState);
    read();
    const timer = window.setInterval(read, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  const granted = state === 'granted';
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <Row
          title="Screen Recording"
          detail={
            granted
              ? 'Glint can capture your screen.'
              : 'macOS needs your OK before any app can see the screen. Turn on Glint in System Settings › Privacy & Security › Screen & System Audio Recording, then reopen Glint if macOS asks.'
          }
        >
          {granted ? (
            <span
              data-testid="permission-granted"
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-500"
            >
              <CheckCircle2 size={15} aria-hidden />
              Allowed
            </span>
          ) : (
            <button
              type="button"
              className={primaryClass}
              onClick={() => void glint().invoke('permissions:open-settings')}
            >
              Open System Settings
            </button>
          )}
        </Row>
      </Card>
    </div>
  );
}

const TABS: readonly {
  id: Tab;
  label: string;
  icon: ReactNode;
  macOnly?: boolean;
}[] = [
  {
    id: 'general',
    label: 'General',
    icon: <Settings2 size={15} aria-hidden />,
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    icon: <Keyboard size={15} aria-hidden />,
  },
  {
    id: 'screenshots',
    label: 'Screenshots',
    icon: <Monitor size={15} aria-hidden />,
  },
  {
    id: 'permissions',
    label: 'Permissions',
    icon: <ShieldCheck size={15} aria-hidden />,
    macOnly: true,
  },
];

export function Settings({ initialTab }: { initialTab: string | null }) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [statuses, setStatuses] = useState<ShortcutStatuses | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' });
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.id === initialTab) ? (initialTab as Tab) : 'general',
  );

  useEffect(() => {
    const bridge = glint();
    void Promise.all([
      bridge.invoke('settings:get'),
      bridge.invoke('shortcuts:status'),
      bridge.invoke('app:info'),
      bridge.invoke('update:state'),
    ]).then(([s, st, i, u]) => {
      setSettings(s);
      setStatuses(st);
      setInfo(i);
      setUpdate(u);
    });
    const stops = [
      bridge.on('settings:changed', setSettings),
      bridge.on('shortcuts:changed', setStatuses),
      bridge.on('update:changed', setUpdate),
    ];
    return () => {
      for (const stop of stops) stop();
    };
  }, []);

  const change = useCallback((patch: SettingsPatch) => {
    void glint()
      .invoke('settings:set', patch as Record<string, unknown>)
      .then(setSettings);
  }, []);

  if (!settings || !statuses || !info) {
    return <div className="flex h-full items-center justify-center text-ink-subtle">Loading…</div>;
  }
  const tabs = TABS.filter((t) => !t.macOnly || info.platform === 'darwin');
  return (
    <div className="flex h-full">
      <nav
        aria-label="Settings"
        className="flex w-48 shrink-0 flex-col gap-0.5 border-r border-edge bg-rail px-2.5 pb-3"
      >
        <div className={info.platform === 'darwin' ? 'drag h-11 shrink-0' : 'h-3 shrink-0'} />
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              setTab(t.id);
            }}
            className={`no-drag flex h-8 items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors ${
              tab === t.id
                ? 'bg-black/[0.06] font-medium text-ink dark:bg-white/[0.07]'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className={`${info.platform === 'darwin' ? 'drag pt-11' : 'pt-6'} px-8 pb-4`}>
          <h1 className="text-xl font-semibold tracking-tight">
            {tabs.find((t) => t.id === tab)?.label}
          </h1>
        </header>
        <div className="px-8 pb-10">
          {tab === 'general' ? (
            <General settings={settings} info={info} update={update} onChange={change} />
          ) : null}
          {tab === 'shortcuts' ? (
            <Shortcuts settings={settings} statuses={statuses} info={info} onChange={change} />
          ) : null}
          {tab === 'screenshots' ? (
            <Screenshots settings={settings} info={info} onChange={change} />
          ) : null}
          {tab === 'permissions' ? <Permissions /> : null}
        </div>
      </main>
    </div>
  );
}
