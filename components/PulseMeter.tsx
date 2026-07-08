"use client";

import React from 'react';

interface Point {
  minute: number;
  homePct: number;
  awayPct: number;
}

export default function PulseMeter({ history }: { history: Point[] }) {
  const width = 900;
  const height = 220;
  const padding = 24;

  if (!history || history.length === 0) {
    return (
      <div className="w-full h-56 bg-neutral-900/30 rounded-md flex items-center justify-center text-neutral-400">Waiting for pulse data…</div>
    );
  }

  const maxMinute = Math.max(90, ...history.map((p) => p.minute));
  const toX = (m: number) => padding + (m / maxMinute) * (width - padding * 2);
  const toY = (pct: number) => height - padding - (pct / 100) * (height - padding * 2);

  const homePath = history
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.minute)} ${toY(p.homePct)}`)
    .join(' ');
  const awayPath = history
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.minute)} ${toY(p.awayPct)}`)
    .join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56">
        <defs>
          <linearGradient id="fillGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* faint gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            x2={width}
            y1={height * f}
            y2={height * f}
            stroke="#1f2937"
            strokeOpacity={0.4}
            strokeWidth={1}
          />
        ))}

        {/* area between lines subtle fill */}
        <path d={`${homePath} L ${toX(history[history.length - 1].minute)} ${height} L ${toX(history[0].minute)} ${height} Z`} fill="url(#fillGradient)" />

        <path d={awayPath} fill="none" stroke="#ec4899" strokeWidth={2} opacity={0.95} />
        <path d={homePath} fill="none" stroke="#06b6d4" strokeWidth={2.5} opacity={0.95} />

        {/* minute ticks */}
        {[0, 15, 30, 45, 60, 75, 90].map((m) => (
          <text key={m} x={toX(m)} y={height - 4} fontSize={10} fill="#9CA3AF" textAnchor="middle">{`${m}'`}</text>
        ))}
      </svg>
    </div>
  );
}
