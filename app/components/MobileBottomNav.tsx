'use client';

import { Bell, ChartLine, Broadcast, SlidersHorizontal } from '@phosphor-icons/react';

const ITEMS = [
  { key: 'live', label: 'Live', Icon: Broadcast, fill: true },
  { key: 'pulse', label: 'Pulse', Icon: ChartLine, fill: false },
  { key: 'control', label: 'Control', Icon: SlidersHorizontal, fill: false },
  { key: 'alerts', label: 'Alerts', Icon: Bell, fill: false },
];

export default function MobileBottomNav({ activeKey = 'live' }: { activeKey?: string }) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 pb-safe bg-surface-container-high/95 backdrop-blur-2xl border-t border-outline-variant/30 shadow-lg shadow-primary/10">
      {ITEMS.map(({ key, label, Icon }) => {
        const active = key === activeKey;
        return (
          <a
            key={key}
            href="#"
            className={
              active
                ? 'flex flex-col items-center justify-center text-primary font-bold active:scale-110 transition-transform duration-300'
                : 'flex flex-col items-center justify-center text-on-surface-variant hover:text-primary transition-all'
            }
          >
            <Icon size={24} weight={active ? 'fill' : 'regular'} />
            <span className="text-[10px] uppercase mt-1 font-semibold tracking-wider">{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
