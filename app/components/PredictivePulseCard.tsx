'use client';

import { Lightning } from '@phosphor-icons/react';

export default function PredictivePulseCard() {
  return (
    <div className="bg-gradient-to-br from-surface-container to-surface-container-lowest border border-outline-variant/30 rounded-2xl h-[400px] p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group hover:border-primary/40 transition-colors">
      <div className="absolute top-0 left-0 w-full h-1 bg-primary/30 group-hover:bg-primary/70 transition-colors" />
      <Lightning size={48} weight="fill" className="text-primary mb-6 animate-pulse" />
      <h3 className="text-2xl font-bold text-white mb-3 uppercase tracking-tight">Predictive Pulse</h3>
      <p className="text-on-surface-variant text-sm px-4 leading-relaxed font-medium">
        Access advanced neural-network predictive modeling for all upcoming fixtures with 94.2% data accuracy.
      </p>
      <button className="mt-8 px-8 py-2.5 rounded-full border border-primary/40 text-primary hover:bg-primary hover:text-on-primary transition-all font-bold text-xs uppercase tracking-widest active:scale-95">
        Upgrade to Pro
      </button>
    </div>
  );
}
