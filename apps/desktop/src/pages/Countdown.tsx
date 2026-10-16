import { useEffect, useState } from 'react';
import { glint } from '../glint';

/** The seconds left before a timed capture freezes the screen. */
export function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => glint().on('countdown:tick', setLeft), []);
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex size-36 items-center justify-center rounded-full bg-black/70 text-6xl font-semibold text-white tabular-nums shadow-2xl">
        {left}
      </div>
    </div>
  );
}
