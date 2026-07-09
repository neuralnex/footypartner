'use client';

import { useState } from 'react';

export default function ScheduleHeader({
  view,
  onViewChange,
}: {
  view: 'grid' | 'list';
  onViewChange: (v: 'grid' | 'list') => void;
}) {
  return (
    <div className="flex justify-between items-end mb-8 lg:mb-10 flex-wrap gap-4">
      <div>
        <p className="text-primary text-[12px] tracking-[0.2em] mb-2 font-bold">LIVE BROADCAST FEED</p>
        <h2 className="text-3xl lg:text-4xl uppercase text-white font-extrabold tracking-tight">
          Match Schedule
        </h2>
      </div>
      <div className="flex items-center gap-1 bg-surface-container-high rounded-xl p-1.5 border border-outline-variant/30">
        <button
          onClick={() => onViewChange('grid')}
          className={
            view === 'grid'
              ? 'px-6 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg shadow-sm uppercase tracking-wider'
              : 'px-6 py-2 text-on-surface-variant text-xs font-bold rounded-lg hover:text-on-surface transition-colors uppercase tracking-wider'
          }
        >
          Grid
        </button>
        <button
          onClick={() => onViewChange('list')}
          className={
            view === 'list'
              ? 'px-6 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg shadow-sm uppercase tracking-wider'
              : 'px-6 py-2 text-on-surface-variant text-xs font-bold rounded-lg hover:text-on-surface transition-colors uppercase tracking-wider'
          }
        >
          List
        </button>
      </div>
    </div>
  );
}
