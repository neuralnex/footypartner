'use client';

import { SoccerBall, Warning } from '@phosphor-icons/react';

export default function EmptyState({
  onReset,
  onChangeDate,
}: {
  onReset?: () => void;
  onChangeDate?: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 relative z-10 min-h-[60vh]">
      <div className="max-w-xl w-full glass-panel bg-surface-container/60 border border-outline-variant/30 rounded-2xl p-8 lg:p-12 text-center relative overflow-hidden shadow-2xl shadow-black/70">
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary shadow-[0_0_15px_#2db30e]" />

        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-subtle-pulse" />
          <div className="relative w-32 h-32 flex items-center justify-center rounded-full border-2 border-primary/30 bg-surface-container">
            <SoccerBall size={64} className="text-primary" weight="thin" />
            <div className="absolute inset-0 border border-primary/10 rounded-full scale-125" />
            <div className="absolute -top-1 -right-1 bg-surface-container rounded-full p-0.5">
              <Warning size={20} className="text-primary" weight="fill" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl lg:text-[32px] text-on-surface uppercase tracking-tight font-extrabold">
            No Live Fixtures Scheduled
          </h1>
          <p className="text-body-md text-on-surface-variant max-w-sm mx-auto leading-relaxed">
            No matches currently broadcasting for your selected filters. Try changing the date or
            competition to view upcoming intelligence feeds.
          </p>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={onReset}
            className="px-8 py-3 bg-primary text-on-primary font-extrabold rounded-lg transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_15px_rgba(45,179,14,0.4)] hover:brightness-110 uppercase text-sm tracking-wide"
          >
            Reset Filters
          </button>
          <button
            onClick={onChangeDate}
            className="px-8 py-3 border border-primary/40 text-primary font-bold rounded-lg hover:bg-primary/5 transition-all active:scale-95 uppercase text-sm tracking-wide"
          >
            Change Date
          </button>
        </div>

        <div className="mt-12 pt-8 border-t border-outline-variant/30 flex justify-between items-center opacity-60">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-label-sm text-on-surface-variant tracking-widest uppercase">
              Feed_status: idle
            </span>
          </div>
          <span className="text-label-sm uppercase text-on-surface-variant tracking-widest">
            Region: Global Tactical
          </span>
        </div>
      </div>
    </div>
  );
}
