'use client';

import {
  Broadcast,
  ChartLine,
  Gauge,
  Lightning,
  Question,
  ClockCounterClockwise,
  SoccerBall,
  SlidersHorizontal,
  VideoCamera,
} from '@phosphor-icons/react';

const NAV = [
  { label: 'Dashboard', icon: Gauge, key: 'dashboard' },
  { label: 'Match Center', icon: SoccerBall, key: 'match' },
  { label: 'Tactical Cam', icon: VideoCamera, key: 'cam' },
  { label: 'Data Stream', icon: ChartLine, key: 'data' },
  { label: 'Control', icon: SlidersHorizontal, key: 'control' },
];

export default function SideNavBar({ activeKey = 'match' }: { activeKey?: string }) {
  return (
    <aside className="hidden lg:flex fixed left-0 top-16 bottom-0 flex-col z-40 w-64 bg-surface-dim border-r border-outline-variant py-6">
      <div className="px-6 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
          <Broadcast size={22} weight="fill" />
        </div>
        <div>
          <p className="text-[14px] leading-tight text-on-surface font-bold uppercase tracking-tight">
            Broadcast Ops
          </p>
          <p className="text-[10px] text-on-surface-variant tracking-widest uppercase font-semibold">
            Studio 4 · UHD
          </p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map((item) => {
          const active = item.key === activeKey;
          const Icon = item.icon;
          return (
            <a
              key={item.key}
              href="#"
              className={
                active
                  ? 'flex items-center gap-4 text-primary bg-surface-variant/50 border-r-2 border-primary p-3 mx-2 rounded-lg transition-transform translate-x-1'
                  : 'flex items-center gap-4 text-secondary opacity-70 hover:bg-surface-container-high hover:text-primary hover:opacity-100 p-3 mx-2 rounded-lg transition-all'
              }
            >
              <Icon size={22} weight={active ? 'fill' : 'regular'} />
              <span className="text-label-sm uppercase tracking-wider">{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="px-4 mt-4 space-y-4">
        <div className="flex items-center justify-between px-2 text-[10px] text-secondary/60 uppercase tracking-widest font-bold">
          <a href="#" className="flex items-center gap-1 hover:text-primary transition-colors">
            <Question size={14} /> Support
          </a>
          <a href="#" className="flex items-center gap-1 hover:text-primary transition-colors">
            <ClockCounterClockwise size={14} /> Logs
          </a>
        </div>
        <button className="group relative w-full py-3 bg-primary text-on-primary rounded-xl flex items-center justify-center gap-2 overflow-hidden active:scale-95 transition-transform duration-150 shadow-lg shadow-primary/20 hover:brightness-110">
          <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Lightning size={18} weight="fill" />
          <span className="font-extrabold tracking-widest text-sm uppercase">Go Live</span>
        </button>
      </div>
    </aside>
  );
}
