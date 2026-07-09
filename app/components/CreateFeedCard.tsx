'use client';

import { Plus } from '@phosphor-icons/react';

export default function CreateFeedCard() {
  return (
    <button
      type="button"
      className="border-2 border-dashed border-outline-variant/50 rounded-2xl flex items-center justify-center group hover:border-primary/50 transition-all cursor-pointer h-[400px] hover:bg-primary/5 active:scale-[0.99]"
    >
      <div className="text-center group-hover:scale-105 transition-transform">
        <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center mx-auto mb-4 border border-outline-variant">
          <Plus size={32} className="text-on-surface-variant group-hover:text-primary transition-colors" />
        </div>
        <p className="text-on-surface-variant uppercase tracking-[0.2em] font-black text-label-sm group-hover:text-primary transition-colors">
          Create Custom Feed
        </p>
      </div>
    </button>
  );
}
