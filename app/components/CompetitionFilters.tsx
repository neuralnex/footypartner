'use client';

import { useState } from 'react';

const FILTERS = [
  { key: 'all', label: 'All Matches' },
  { key: 'epl', label: 'Premier League' },
  { key: 'ucl', label: 'UCL' },
  { key: 'laliga', label: 'La Liga' },
  { key: 'seriea', label: 'Serie A' },
  { key: 'bundesliga', label: 'Bundesliga' },
];

export default function CompetitionFilters({
  onChange,
}: {
  onChange?: (key: string) => void;
}) {
  const [active, setActive] = useState('all');

  return (
    <div className="bg-surface-container-low/80 backdrop-blur-md sticky top-16 z-30 px-margin-mobile lg:px-margin-desktop py-4 border-b border-outline-variant/30 overflow-x-auto">
      <div className="flex gap-3 min-w-max">
        {FILTERS.map((f) => {
          const isActive = f.key === active;
          return (
            <button
              key={f.key}
              onClick={() => {
                setActive(f.key);
                onChange?.(f.key);
              }}
              className={
                isActive
                  ? 'px-6 py-2 rounded-full bg-primary text-on-primary text-label-sm font-bold shadow-lg shadow-primary/20 uppercase tracking-wider whitespace-nowrap active:scale-95 transition-transform'
                  : 'px-6 py-2 rounded-full border border-outline-variant/50 hover:border-primary/50 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high text-label-sm font-semibold uppercase tracking-wider whitespace-nowrap transition-all active:scale-95'
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
