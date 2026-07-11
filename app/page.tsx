'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  DEFAULT_USER_TIMEZONE,
  getEpochDay,
  formatEpochDayLabel,
  formatHostDayHint,
  formatKickoff,
  formatKickoffDual,
  formatTimezoneShort,
  resolveUserTimeZone,
  WC_2026_START_EPOCH_DAY,
  WC_2026_DURATION_DAYS,
} from '@/lib/txline/dates';

interface BoardFixture {
  FixtureId: number;
  Competition: string;
  StartTime: number;
  homeTeam: string;
  awayTeam: string;
  status: 'upcoming' | 'live' | 'finished' | 'unavailable';
  gameStateLabel: string;
  minute: string;
  resultLabel: 'FT' | 'AET' | 'Pens' | null;
  scoreHome: number | null;
  scoreAway: number | null;
  isPulse: boolean;
}

export default function HomePage() {
  const tournamentDays = useMemo(
    () => Array.from({ length: WC_2026_DURATION_DAYS }, (_, i) => WC_2026_START_EPOCH_DAY + i),
    []
  );
  const [userTimeZone, setUserTimeZone] = useState(DEFAULT_USER_TIMEZONE);
  const [today, setToday] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(WC_2026_START_EPOCH_DAY);
  const [fixtures, setFixtures] = useState<BoardFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const dateTabsRef = useRef<HTMLDivElement | null>(null);
  const dateButtonRefs = useRef(new Map<number, HTMLButtonElement>());
  useEffect(() => {
    const detected = resolveUserTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    setUserTimeZone(detected);
    const current = getEpochDay(new Date(), detected);
    setToday(current);
    if (current >= WC_2026_START_EPOCH_DAY && current < WC_2026_START_EPOCH_DAY + WC_2026_DURATION_DAYS) {
      setSelectedDay(current);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    let backoffMs = 0;

    const loadBoard = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const res = await fetch(
          `/api/fixtures/board?epochDay=${selectedDay}&timeZone=${encodeURIComponent(userTimeZone)}`,
          { signal: controller.signal }
        );
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('Retry-After') || '30');
          backoffMs = Math.min(retryAfter * 1000, 120_000);
          return;
        }
        backoffMs = 0;
        if (res.ok) setFixtures(await res.json());
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') setFixtures([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    };

    void loadBoard(true);

    const scheduleRefresh = () => {
      const jitter = Math.floor(Math.random() * 10_000);
      const base = 45_000 + jitter + backoffMs;
      refreshTimer = setTimeout(() => {
        void loadBoard(false).finally(scheduleRefresh);
      }, base);
    };
    scheduleRefresh();

    return () => {
      controller.abort();
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [selectedDay, userTimeZone]);

  useEffect(() => {
    if (today === null) return;

    const tabList = dateTabsRef.current;
    const activeTab = dateButtonRefs.current.get(selectedDay);
    if (!tabList || !activeTab) return;

    const nextLeft =
      activeTab.offsetLeft - tabList.clientWidth / 2 + activeTab.clientWidth / 2;

    tabList.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: 'smooth',
    });
  }, [selectedDay, today]);

  const filtered = fixtures.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.homeTeam.toLowerCase().includes(q) || f.awayTeam.toLowerCase().includes(q);
  });

  const liveCount = fixtures.filter((f) => f.status === 'live').length;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <h1 className="font-display-var text-3xl tracking-wide">
            Footy<span className="gold-gradient-text">Partner</span>
          </h1>
          <div className="hidden sm:flex flex-1 max-w-xs">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teams…"
              className="w-full rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--floodlight)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--gold)]"
            />
          </div>
          {liveCount > 0 && (
            <span className="flex items-center gap-2 rounded-full border border-[var(--gold)]/30 bg-[var(--gold-dim)] px-3 py-1 text-xs font-medium text-[var(--gold)]">
              <span className="pulse-live h-2 w-2 rounded-full bg-[var(--pulse)]" />
              {liveCount} live
            </span>
          )}
        </div>

        <div
          ref={dateTabsRef}
          className="no-scrollbar mx-auto flex max-w-7xl flex-col gap-1 px-4 pb-3"
        >
          <p className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Match days · {formatTimezoneShort(userTimeZone)} · US Eastern host kickoffs on cards
          </p>
          <div className="flex items-center gap-2 overflow-x-auto">
          {tournamentDays.map((day) => (
            <button
              key={day}
              ref={(node) => {
                if (node) {
                  dateButtonRefs.current.set(day, node);
                } else {
                  dateButtonRefs.current.delete(day);
                }
              }}
              onClick={() => setSelectedDay(day)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                selectedDay === day
                  ? 'bg-[var(--gold)] text-[var(--bg)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--floodlight)]'
              }`}
              title={formatHostDayHint(day, userTimeZone) ?? undefined}
            >
              {today === null ? '…' : formatEpochDayLabel(day, today, userTimeZone)}
            </button>
          ))}
          <button
            onClick={() => setSelectedDay((d) => Math.max(WC_2026_START_EPOCH_DAY, d - 1))}
            className="ml-auto shrink-0 rounded-lg px-3 py-2 text-xs text-[var(--muted)] hover:text-[var(--gold)]"
          >
            ← Earlier
          </button>
          <button
            onClick={() =>
              setSelectedDay((d) =>
                Math.min(WC_2026_START_EPOCH_DAY + WC_2026_DURATION_DAYS - 1, d + 1)
              )
            }
            className="shrink-0 rounded-lg px-3 py-2 text-xs text-[var(--muted)] hover:text-[var(--gold)]"
          >
            Later →
          </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_280px]">
          <aside className="order-2 lg:order-1">
            <TournamentOverview />
          </aside>

          <section className="order-1 lg:order-2">
            <p className="mb-6 text-sm text-[var(--muted)]">
              Live matches get the full FootyPartner experience — AI summaries, odds, and chat. Tap any match to
              explore scores and events.
            </p>

            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="match-card h-40 animate-pulse bg-[var(--surface)]" />
                ))}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="match-card p-10 text-center">
                <p className="text-[var(--muted)]">No World Cup fixtures for this day.</p>
              </div>
            )}

            <div className="space-y-3">
              {!loading &&
                filtered.map((fixture) => (
                  <MatchCard key={fixture.FixtureId} fixture={fixture} userTimeZone={userTimeZone} />
                ))}
            </div>
          </section>

          <aside className="order-3">
            <TopScorers />
          </aside>
        </div>
      </main>
    </div>
  );
}

const TOURNAMENT_STATS = [
  { label: 'Total Goals', value: '172' },
  { label: 'Total Matches', value: '48' },
  { label: 'Yellow Cards', value: '210' },
  { label: 'Red Cards', value: '8' },
  { label: 'Avg. Goals / Match', value: '3.58' },
];

function TournamentOverview() {
  return (
    <div className="match-card p-5">
      <h2 className="mb-4 font-heading-var text-sm font-bold uppercase tracking-wider text-[var(--floodlight)]">
        Tournament Overview
      </h2>
      <div className="space-y-3">
        {TOURNAMENT_STATS.map((stat) => (
          <div key={stat.label} className="stat-tile flex items-center justify-between">
            <span className="text-sm text-[var(--muted)]">{stat.label}</span>
            <span className="font-display-var text-2xl font-semibold text-[var(--floodlight)]">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TOP_SCORERS = [
  { name: 'Kylian Mbappé', country: 'FRA', goals: 10 },
  { name: 'Álvaro Morata', country: 'ESP', goals: 8 },
  { name: 'Lionel Messi', country: 'ARG', goals: 7 },
  { name: 'J. Bellingham', country: 'ENG', goals: 6 },
  { name: 'R. Lewandowski', country: 'POL', goals: 6 },
];

function TopScorers() {
  return (
    <div className="match-card p-5">
      <h2 className="mb-4 font-heading-var text-sm font-bold uppercase tracking-wider text-[var(--floodlight)]">
        Top Scorers
      </h2>
      <div className="space-y-3">
        {TOP_SCORERS.map((scorer, i) => (
          <div key={scorer.name} className="flex items-center justify-between">
            <div>
              <p className="font-heading-var text-sm font-semibold text-[var(--floodlight)]">
                {i + 1}. {scorer.name}
              </p>
              <p className="text-xs text-[var(--muted)]">{scorer.country}</p>
            </div>
            <span className="font-display-var text-xl font-semibold text-[var(--gold)]">
              {scorer.goals}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchCard({ fixture, userTimeZone }: { fixture: BoardFixture; userTimeZone: string }) {
  const href = `/fixture/${fixture.FixtureId}?home=${encodeURIComponent(fixture.homeTeam)}&away=${encodeURIComponent(fixture.awayTeam)}`;

  const statusBadge = () => {
    if (fixture.status === 'live') {
      return (
        <span className="flex items-center gap-2 font-display-var text-lg text-[var(--gold)]">
          <span className="pulse-live inline-block h-2.5 w-2.5 rounded-full bg-[var(--pulse)]" />
          {fixture.minute}
        </span>
      );
    }
    if (fixture.status === 'finished') {
      return <span className="text-sm font-medium text-[var(--muted)]">{fixture.minute}</span>;
    }
    if (fixture.status === 'unavailable') {
      return <span className="text-sm font-medium text-[var(--muted)]">No data</span>;
    }
    return <span className="text-sm text-[var(--muted)]">{formatKickoff(fixture.StartTime, userTimeZone)}</span>;
  };

  const scoreDisplay = () => {
    if (fixture.scoreHome != null && fixture.scoreAway != null) {
      return (
        <span className="font-display-var text-5xl font-semibold tracking-wider text-[var(--floodlight)] sm:text-6xl">
          {fixture.scoreHome} <span className="text-[var(--muted)]">-</span> {fixture.scoreAway}
        </span>
      );
    }
    return <span className="font-display-var text-2xl text-[var(--muted)]">vs</span>;
  };

  return (
    <a
      href={href}
      className={`match-card block p-8 ${fixture.isPulse ? 'match-card-live' : ''}`}
    >
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[var(--muted)]">
          {fixture.Competition}
        </span>
        <div className="flex items-center gap-3">
          {fixture.isPulse && (
            <span className="rounded-full bg-[var(--gold-dim)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">
              Live
            </span>
          )}
          {statusBadge()}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        <p className="truncate text-right font-heading-var text-xl font-semibold sm:text-2xl">
          {fixture.homeTeam}
        </p>
        {scoreDisplay()}
        <p className="truncate font-heading-var text-xl font-semibold sm:text-2xl">
          {fixture.awayTeam}
        </p>
      </div>

      {fixture.status === 'finished' && (
        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          {fixture.gameStateLabel} · tap to view match archive
        </p>
      )}
      {fixture.status === 'unavailable' && (
        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          Listed by TxLINE with no score feed — match may not have been played
        </p>
      )}
      {fixture.status === 'upcoming' && (
        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          Kickoff {formatKickoffDual(fixture.StartTime, userTimeZone)}
        </p>
      )}
    </a>
  );
}
