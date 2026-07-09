'use client';

import { useEffect, useState } from 'react';

export default function WinProbabilityChart({
  team = 'MCFC',
  initialValue = 68.4,
}: {
  team?: string;
  initialValue?: number;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const id = setInterval(() => {
      setValue((v) => {
        const noise = (Math.random() - 0.5) * 0.35;
        return Math.max(0, Math.min(100, +(v + noise).toFixed(1)));
      });
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 pulse-strip-vert" />

      <div className="flex items-end justify-between mb-6 lg:mb-8 pl-6 flex-wrap gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-on-surface tracking-tighter uppercase">
            Win Probability %
          </h2>
          <p className="text-on-surface-variant text-[11px] tracking-widest font-bold uppercase mt-1">
            Real-time tactical stream
          </p>
        </div>
        <div className="text-right">
          <span className="text-4xl lg:text-5xl text-primary font-black tabular-nums">
            {value.toFixed(1)}%
          </span>
          <p className="text-on-surface-variant text-[11px] tracking-widest font-bold uppercase mt-1">
            {team} advantage
          </p>
        </div>
      </div>

      <div className="relative w-full h-40 lg:h-48 bg-surface-dim/40 rounded-xl overflow-hidden border border-outline-variant/30">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(#2db30e 1px, transparent 1px), linear-gradient(90deg, #2db30e 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 200">
          <defs>
            <linearGradient id="lineGrad" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#2db30e" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#2db30e" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="fillGrad" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#2db30e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#2db30e" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,80 L50,85 L100,70 L150,90 L200,60 L250,75 L300,50 L350,110 L400,90 L450,130 L500,100 L550,40 L600,60 L650,20 L700,50 L750,70 L800,40 L850,30 L900,45 L1000,20 L1000,200 L0,200 Z"
            fill="url(#fillGrad)"
          />
          <path
            className="ecg-line"
            d="M0,80 L50,85 L100,70 L150,90 L200,60 L250,75 L300,50 L350,110 L400,90 L450,130 L500,100 L550,40 L600,60 L650,20 L700,50 L750,70 L800,40 L850,30 L900,45 L1000,20"
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth={3}
            style={{ filter: 'drop-shadow(0 0 10px rgba(45,179,14,0.6))' }}
          />
          <circle cx={980} cy={20} fill="#2db30e" r={5}>
            <animate attributeName="r" dur="1s" repeatCount="indefinite" values="4;7;4" />
            <animate attributeName="opacity" dur="1s" repeatCount="indefinite" values="1;0.4;1" />
          </circle>
        </svg>
        <div className="absolute bottom-2 left-4 text-[10px] text-on-surface-variant/40 font-bold uppercase tracking-widest">
          Match Start
        </div>
        <div className="absolute bottom-2 right-4 text-[10px] text-on-surface-variant/40 font-bold uppercase tracking-widest">
          Full Time
        </div>
      </div>
    </section>
  );
}
