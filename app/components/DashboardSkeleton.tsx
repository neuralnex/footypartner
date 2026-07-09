'use client';

import { Broadcast } from '@phosphor-icons/react';
import ConnectionBanner from './ConnectionBanner';

export default function DashboardSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <ConnectionBanner state="sync" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-surface-container-low p-6 lg:p-8 rounded-2xl border border-outline-variant/40 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-primary animate-heartbeat shadow-[0_0_15px_rgba(45,179,14,0.4)]" />
        <SkelTeam align="right" />
        <div className="flex flex-col items-center gap-4">
          <div className="w-28 h-16 shimmer rounded-xl bg-surface-container-high" />
          <div className="px-3 py-1 rounded bg-surface-container-highest/50 border border-outline-variant/30">
            <div className="w-16 h-4 shimmer rounded opacity-40 bg-primary/20" />
          </div>
        </div>
        <SkelTeam align="left" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-gutter">
        <div className="lg:col-span-2 bg-surface-container rounded-2xl p-6 lg:p-8 border border-outline-variant/40 min-h-[400px] lg:min-h-[440px] flex flex-col">
          <div className="flex justify-between items-center mb-8 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-primary shadow-[0_0_10px_rgba(45,179,14,0.5)]" />
              <span className="text-primary uppercase tracking-tighter font-bold text-lg">
                Live Intensity Index
              </span>
            </div>
            <div className="w-32 h-8 shimmer rounded-full bg-surface-container-high opacity-50" />
          </div>
          <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-surface-container-lowest/50 rounded-xl">
            <svg className="w-full h-full absolute inset-0" preserveAspectRatio="none" viewBox="0 0 800 200">
              <path
                className="ecg-line"
                d="M0,100 L150,100 L170,40 L190,160 L210,100 L400,100 L420,20 L440,180 L460,100 L600,100 L620,60 L640,140 L660,100 L800,100"
                fill="none"
                opacity="0.3"
                stroke="#2db30e"
                strokeWidth="1.5"
              />
              <path
                className="ecg-line"
                d="M0,120 L200,120 L220,70 L240,170 L260,120 L450,120 L470,50 L490,190 L510,120 L800,120"
                fill="none"
                opacity="0.15"
                stroke="#CBD5E1"
                strokeWidth="1"
                style={{ animationDelay: '1s' }}
              />
            </svg>
            <div className="relative flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full border-2 border-primary/20 flex items-center justify-center animate-heartbeat bg-primary/5 shadow-[0_0_30px_rgba(45,179,14,0.15)]">
                <Broadcast size={32} className="text-primary" weight="fill" />
              </div>
              <p className="mt-6 text-label-sm text-primary/60 uppercase tracking-[0.2em] font-bold">
                Establishing Neural Stream
              </p>
              <div className="mt-2 text-secondary/40 text-[10px] font-bold uppercase tracking-widest">
                System Uplink: Stable
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-secondary text-lg uppercase tracking-tight font-bold">Live Intel</span>
          </div>
          {[0.6, 0.4, 0.25, 0.15].map((op, i) => (
            <div
              key={i}
              className="bg-surface-container p-5 rounded-2xl border border-outline-variant/30 border-l-4 border-l-primary/60 shimmer"
              style={{ opacity: op, animationDelay: `${i * 0.15}s` }}
            >
              <div className="w-16 h-4 bg-primary/20 rounded mb-3" />
              <div className="w-full h-4 bg-secondary/10 rounded mb-2" />
              <div className="w-4/5 h-4 bg-secondary/10 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkelTeam({ align }: { align: 'left' | 'right' }) {
  return (
    <div className={`flex flex-col items-center ${align === 'right' ? 'md:items-end' : 'md:items-start'} gap-4`}>
      <div className="w-20 h-20 rounded-full shimmer bg-surface-container-high" />
      <div className="w-32 h-6 shimmer rounded bg-surface-container-high" />
      <div className="w-24 h-4 shimmer rounded opacity-30 bg-surface-container-high" />
    </div>
  );
}
