'use client';

import { DotsThree, Bell, TrendUp, Microphone } from '@phosphor-icons/react';
import Link from 'next/link';

export interface FixtureCardData {
  fixtureId: string | number;
  competition: string;
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
  status: 'live' | 'upcoming';
  minute?: number;
  kickoff?: string;
  homeScore?: number;
  awayScore?: number;
  progressPct?: number;
  criticalMoment?: boolean;
  liveFeed?: boolean;
}

export default function FixtureCard({ data }: { data: FixtureCardData }) {
  const isLive = data.status === 'live';
  const href = `/fixture/${data.fixtureId}?home=${encodeURIComponent(
    data.homeName
  )}&away=${encodeURIComponent(data.awayName)}`;

  return (
    <Link
      href={href}
      className="fixture-card-hover bg-surface-container border border-outline-variant/30 rounded-2xl overflow-hidden flex flex-col relative group focus:outline-none focus:ring-2 focus:ring-primary/60"
    >
      <div className={`p-6 flex flex-col h-full ${!isLive && 'opacity-80 group-hover:opacity-100 transition-opacity'}`}>
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-primary/50 rounded-full" />
            <span className="text-[10px] text-on-surface-variant tracking-widest uppercase font-bold">
              {data.competition}
            </span>
          </div>
          {isLive ? (
            <div className="flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full border border-primary/30">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] text-primary font-black">{data.minute}&apos;</span>
            </div>
          ) : (
            <div className="px-3 py-1 rounded-full border border-outline-variant bg-surface-variant/30">
              <span className="text-[10px] text-on-surface-variant font-bold">{data.kickoff}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 flex-grow mb-6">
          <TeamRow code={data.homeCode} name={data.homeName} score={data.homeScore} isLive={isLive} />
          <TeamRow code={data.awayCode} name={data.awayName} score={data.awayScore} isLive={isLive} />
        </div>

        <div className="mt-auto pt-5 border-t border-outline-variant/20 flex justify-between items-center">
          {isLive ? (
            data.criticalMoment ? (
              <div className="flex items-center gap-2">
                <TrendUp size={18} className="text-primary" weight="bold" />
                <span className="text-primary text-[11px] font-bold uppercase tracking-wider">
                  Critical Moment
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                  <Microphone size={14} className="text-on-primary" weight="fill" />
                </div>
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">
                  Live Feed Active
                </span>
              </div>
            )
          ) : (
            <span className="text-on-surface-variant text-[11px] uppercase tracking-[0.1em] font-bold">
              Pre-match analysis ready
            </span>
          )}
          <button
            aria-label={isLive ? 'More options' : 'Notify me'}
            className="text-on-surface-variant hover:text-primary transition-colors"
            onClick={(e) => e.preventDefault()}
          >
            {isLive ? <DotsThree size={22} weight="bold" /> : <Bell size={18} />}
          </button>
        </div>
      </div>

      <div className={`h-1 w-full ${isLive ? 'bg-primary/20' : 'bg-outline-variant/20'} overflow-hidden`}>
        {isLive && (
          <div
            className="h-full bg-primary animate-pulse-glow shadow-[0_0_15px_rgba(45,179,14,0.8)]"
            style={{ width: `${data.progressPct ?? 50}%` }}
          />
        )}
      </div>
    </Link>
  );
}

function TeamRow({
  code,
  name,
  score,
  isLive,
}: {
  code: string;
  name: string;
  score?: number;
  isLive: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-surface-container-highest border border-outline-variant/40 flex items-center justify-center">
          <span className="text-[11px] font-black text-on-surface-variant tracking-widest">
            {code.slice(0, 3).toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl text-white font-bold tracking-tight leading-none">
            {code.toUpperCase()}
          </span>
          <span className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1 font-semibold">
            {name}
          </span>
        </div>
      </div>
      {isLive ? (
        <span className="text-[40px] leading-none text-primary font-black">{score ?? 0}</span>
      ) : (
        <span className="text-[40px] leading-none text-on-surface-variant/20 font-black">?</span>
      )}
    </div>
  );
}
