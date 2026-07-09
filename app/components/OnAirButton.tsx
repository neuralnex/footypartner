'use client';

import { Record, CircleNotch } from '@phosphor-icons/react';

export default function OnAirButton({
  loading = false,
  awaiting = false,
  onClick,
}: {
  loading?: boolean;
  awaiting?: boolean;
  onClick?: () => void;
}) {
  if (awaiting) {
    return (
      <div className="fixed bottom-24 right-6 lg:bottom-10 lg:right-10 z-[70]">
        <div className="relative group">
          <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full on-air-glow" />
          <button
            aria-label="Awaiting uplink"
            className="relative w-16 h-16 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-[0_0_20px_rgba(45,179,14,0.5)] cursor-wait"
          >
            <CircleNotch size={30} className="animate-spin" weight="bold" />
          </button>
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-surface-container-highest px-3 py-1.5 rounded-lg border border-primary/20 text-primary text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md uppercase tracking-widest font-bold">
            Awaiting Uplink
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label={loading ? 'Loading voice commentary' : 'Go on air'}
      className="fixed bottom-24 right-6 lg:bottom-10 lg:right-10 z-[70] bg-primary text-on-primary flex items-center gap-3 px-6 lg:px-8 py-3 lg:py-4 rounded-2xl text-base lg:text-lg font-black on-air-glow transition-all hover:scale-110 active:scale-95 shadow-2xl shadow-primary/30 uppercase tracking-tighter disabled:opacity-70 disabled:cursor-wait"
    >
      {loading ? (
        <CircleNotch size={22} className="animate-spin" weight="bold" />
      ) : (
        <Record size={22} weight="fill" />
      )}
      <span>{loading ? 'Cueing' : 'On Air'}</span>
    </button>
  );
}
