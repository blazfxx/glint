import { type ReactNode } from 'react';

export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        onChange(!checked);
      }}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-150 ${
        checked ? 'bg-accent' : 'bg-edge-strong'
      }`}
    >
      <span
        className={`absolute top-[3px] left-0 size-4 rounded-full bg-white shadow transition-transform duration-150 ${
          checked ? 'translate-x-[19px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-lg border border-edge bg-bg p-0.5"
    >
      {options.map(([option, text]) => (
        <button
          key={String(option)}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => {
            onChange(option);
          }}
          className={`h-7 rounded-md px-3 text-[12px] font-medium transition-colors ${
            option === value ? 'bg-panel text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** One setting: its name and explanation on the left, its control on the right. */
export function Row({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-edge px-5 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {detail ? <p className="mt-0.5 text-[12px] text-ink-muted">{detail}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title ? <h2 className="px-1 text-[12px] font-semibold text-ink-muted">{title}</h2> : null}
      <div className="rounded-xl border border-edge bg-panel">{children}</div>
    </section>
  );
}

export const buttonClass =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-edge-strong px-3 text-[12.5px] font-medium text-ink hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-60';
export const primaryClass =
  'inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-hover disabled:opacity-60';
