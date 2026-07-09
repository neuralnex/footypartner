'use client';

import { Bell, Gear, MagnifyingGlass, User } from '@phosphor-icons/react';
import { useState } from 'react';

const NAV = [
  { label: 'All Events', href: '#' },
  { label: 'Competitions', href: '#' },
  { label: 'Schedule', href: '#' },
];

export default function TopNavBar({ activeLabel = 'All Events' }: { activeLabel?: string }) {
  const [query, setQuery] = useState('');

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center h-16 px-margin-mobile lg:px-margin-desktop bg-surface-container/85 backdrop-blur-md border-b border-outline-variant shadow-sm">
      <div className="flex items-center gap-8">
        <h1 className="text-[22px] lg:text-[28px] font-extrabold text-primary tracking-tighter uppercase">
          Live Control
        </h1>
        <nav className="hidden md:flex gap-8 items-center">
          {NAV.map((item) => {
            const active = item.label === activeLabel;
            return (
              <a
                key={item.label}
                href={item.href}
                className={
                  active
                    ? 'text-primary font-bold border-b-2 border-primary pb-1 text-label-sm uppercase tracking-wider'
                    : 'text-on-surface-variant hover:text-primary transition-colors text-label-sm uppercase tracking-wider'
                }
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        <div className="hidden md:flex items-center gap-2 bg-surface-container-highest/50 rounded-full px-4 py-1.5 border border-outline-variant/30 focus-within:border-primary/50 transition-colors">
          <MagnifyingGlass size={18} weight="regular" className="text-on-surface-variant" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fixtures..."
            className="bg-transparent border-none outline-none text-sm w-40 lg:w-48 placeholder-on-surface-variant/50 text-on-surface"
          />
        </div>
        <button
          aria-label="Notifications"
          className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors active:scale-95 duration-150"
        >
          <Bell size={22} />
        </button>
        <button
          aria-label="Settings"
          className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors active:scale-95 duration-150"
        >
          <Gear size={22} />
        </button>
        <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant bg-surface-container-highest flex items-center justify-center">
          <User size={18} className="text-on-surface-variant" />
        </div>
      </div>
    </header>
  );
}
