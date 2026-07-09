'use client';

import { Broadcast } from '@phosphor-icons/react';

const DEFAULT_ITEMS = [
  "GOAL! KEVIN DE BRUYNE (64') — MNC 2-1 LIV",
  "YELLOW CARD: VIRGIL VAN DIJK (61')",
  "SUBSTITUTION: PHIL FODEN IN FOR JACK GREALISH (58')",
  'MATCH DELAY: STADIUM LIGHTING ISSUE AT CAMP NOU',
  "VAR CHECK: POSSIBLE OFFSIDE (68')",
];

export default function Ticker({ items = DEFAULT_ITEMS }: { items?: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="fixed bottom-0 lg:left-64 right-0 h-12 bg-surface-container-highest/95 backdrop-blur-2xl border-t border-outline-variant/30 flex items-center px-6 lg:px-8 overflow-hidden z-40">
      <div className="shrink-0 bg-primary text-on-primary font-black px-3 py-1 rounded-md text-[10px] tracking-[0.2em] flex items-center gap-1.5 mr-6 shadow-lg shadow-primary/20">
        <Broadcast size={14} weight="fill" />
        LIVE UPDATES
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="flex gap-16 whitespace-nowrap text-secondary text-[12px] font-bold animate-marquee">
          {doubled.map((item, i) => (
            <span key={i} className="flex items-center gap-16">
              {item}
              <span className="text-primary/70">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
