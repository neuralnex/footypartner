'use client';

import { useMemo, useState } from 'react';
import CompetitionFilters from './CompetitionFilters';
import ConnectionBanner from './ConnectionBanner';
import CreateFeedCard from './CreateFeedCard';
import EmptyState from './EmptyState';
import FixtureCard, { FixtureCardData } from './FixtureCard';
import PredictivePulseCard from './PredictivePulseCard';
import ScheduleHeader from './ScheduleHeader';
import Ticker from './Ticker';

const MOCK_FIXTURES: FixtureCardData[] = [
  {
    fixtureId: 500001,
    competition: 'Premier League',
    homeCode: 'MNC',
    awayCode: 'LIV',
    homeName: 'Manchester City',
    awayName: 'Liverpool',
    status: 'live',
    minute: 68,
    homeScore: 2,
    awayScore: 1,
    progressPct: 66,
    liveFeed: true,
  },
  {
    fixtureId: 500002,
    competition: 'Champions League',
    homeCode: 'RMA',
    awayCode: 'ACM',
    homeName: 'Real Madrid',
    awayName: 'AC Milan',
    status: 'upcoming',
    kickoff: '20:00',
  },
  {
    fixtureId: 500003,
    competition: 'La Liga',
    homeCode: 'BAR',
    awayCode: 'ATM',
    homeName: 'FC Barcelona',
    awayName: 'Atletico Madrid',
    status: 'live',
    minute: 12,
    homeScore: 0,
    awayScore: 0,
    progressPct: 20,
    criticalMoment: true,
  },
  {
    fixtureId: 500004,
    competition: 'Serie A',
    homeCode: 'INT',
    awayCode: 'JUV',
    homeName: 'Inter Milan',
    awayName: 'Juventus',
    status: 'upcoming',
    kickoff: '22:45',
  },
];

export default function ExplorerScreen({
  fixtures = MOCK_FIXTURES,
}: {
  fixtures?: FixtureCardData[];
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState('all');
  const [emptyMode, setEmptyMode] = useState(false);

  const visible = useMemo(() => (emptyMode ? [] : fixtures), [emptyMode, fixtures]);

  return (
    <>
      <ConnectionBanner state="live" />

      <CompetitionFilters onChange={setFilter} />

      <section className="p-margin-mobile lg:p-margin-desktop pb-32">
        <ScheduleHeader view={view} onViewChange={setView} />

        <div className="flex items-center gap-3 mb-6 text-[11px] text-on-surface-variant uppercase tracking-widest font-bold">
          <span>Filter: <span className="text-primary">{filter}</span></span>
          <span>·</span>
          <button
            onClick={() => setEmptyMode((v) => !v)}
            className="hover:text-primary transition-colors underline underline-offset-4"
          >
            Toggle empty state (demo)
          </button>
        </div>

        {visible.length === 0 ? (
          <EmptyState onReset={() => setEmptyMode(false)} onChangeDate={() => setEmptyMode(false)} />
        ) : (
          <div
            className={
              view === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8'
                : 'grid grid-cols-1 gap-4'
            }
          >
            {visible.map((f) => (
              <FixtureCard key={f.fixtureId} data={f} />
            ))}
            <CreateFeedCard />
            <PredictivePulseCard />
          </div>
        )}
      </section>

      <Ticker />
    </>
  );
}
