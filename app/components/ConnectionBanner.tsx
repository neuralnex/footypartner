'use client';

import { ArrowsClockwise } from '@phosphor-icons/react';

export default function ConnectionBanner({
  state = 'live',
  message,
}: {
  state?: 'live' | 'sync' | 'idle' | 'error';
  message?: string;
}) {
  if (state === 'live') {
    return (
      <div className="w-full bg-primary text-on-primary py-1 px-margin-mobile lg:px-margin-desktop flex items-center justify-between z-[60] font-bold text-[10px] tracking-widest uppercase">
        <div className="flex items-center gap-2">
          <ArrowsClockwise size={14} weight="bold" />
          <span>{message ?? 'Synchronizing with live match feed...'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Streams Optimized</span>
          <div className="w-2 h-2 rounded-full bg-on-primary animate-pulse" />
        </div>
      </div>
    );
  }

  if (state === 'sync') {
    return (
      <div className="w-full h-10 bg-primary/5 border border-primary/20 rounded-lg flex items-center px-4 gap-3">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(45,179,14,0.6)]" />
        <span className="text-label-sm text-primary uppercase tracking-widest">
          {message ?? 'Awaiting match sync from London Data Hub...'}
        </span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="w-full bg-error/10 border border-error/30 text-error px-margin-mobile lg:px-margin-desktop py-2 text-[10px] uppercase tracking-widest font-bold">
        {message ?? 'Connection lost — retrying...'}
      </div>
    );
  }

  return (
    <div className="w-full bg-surface-container-high text-primary px-6 py-1.5 flex justify-center items-center gap-2 border-b border-primary/20">
      <ArrowsClockwise size={16} className="animate-pulse" />
      <span className="text-label-sm tracking-widest font-bold uppercase">
        {message ?? 'System status: synchronized with global feed'}
      </span>
    </div>
  );
}
