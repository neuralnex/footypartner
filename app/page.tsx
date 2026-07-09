'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BOARD_TIMEZONE,
  getEpochDay,
  formatEpochDayLabel,
  WC_2026_START_EPOCH_DAY,
  WC_2026_DURATION_DAYS,
} from '@/lib/txline/dates';

function formatKickoff(ts: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: BOARD_TIMEZONE,
  }).formatToParts(new Date(ts));
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

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
  const [today, setToday] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState(WC_2026_START_EPOCH_DAY);
  const [fixtures, setFixtures] = useState<BoardFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const current = getEpochDay(new Date());
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
        const res = await fetch(`/api/fixtures/board?epochDay=${selectedDay}`, {
          signal: controller.signal,
        });
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
  }, [selectedDay]);

  const filtered = fixtures.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return f.homeTeam.toLowerCase().includes(q) || f.awayTeam.toLowerCase().includes(q);
  });

  const liveCount = fixtures.filter((f) => f.status === 'live').length;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--hairline)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
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

        <div className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 pb-3">
          {tournamentDays.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                selectedDay === day
                  ? 'bg-[var(--gold)] text-[var(--bg)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--floodlight)]'
              }`}
            >
              {today === null ? '…' : formatEpochDayLabel(day, today)}
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
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <p className="mb-6 text-sm text-[var(--muted)]">
          Live matches get the full FootyPartner experience — AI summaries, odds, and chat. Tap any match to
          explore scores and events.
        </p>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="match-card h-28 animate-pulse bg-[var(--surface)]" />
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
              <MatchCard key={fixture.FixtureId} fixture={fixture} />
            ))}
        </div>
      </main>
    </div>
  );
}

function MatchCard({ fixture }: { fixture: BoardFixture }) {
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
    return <span className="text-sm text-[var(--muted)]">{formatKickoff(fixture.StartTime)}</span>;
  };

  const scoreDisplay = () => {
    if (fixture.scoreHome != null && fixture.scoreAway != null) {
      return (
        <span className="font-display-var text-4xl font-semibold tracking-wider text-[var(--floodlight)]">
          {fixture.scoreHome} <span className="text-[var(--muted)]">-</span> {fixture.scoreAway}
        </span>
      );
    }
    return <span className="font-display-var text-2xl text-[var(--muted)]">vs</span>;
  };

  return (
    <a
      href={href}
      className={`match-card block p-5 ${fixture.isPulse ? 'match-card-live' : ''}`}
    >
      <div className="mb-4 flex items-center justify-between">
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

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <p className="truncate text-right font-heading-var text-base font-semibold sm:text-lg">
          {fixture.homeTeam}
        </p>
        {scoreDisplay()}
        <p className="truncate font-heading-var text-base font-semibold sm:text-lg">
          {fixture.awayTeam}
        </p>
      </div>

      {fixture.status === 'finished' && (
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          {fixture.gameStateLabel} · tap to view match archive
        </p>
      )}
      {fixture.status === 'unavailable' && (
        <p className="mt-3 text-center text-xs text-[var(--muted)]">
          Listed by TxLINE with no score feed — match may not have been played
        </p>
      )}
      {fixture.status === 'upcoming' && (
        <p className="mt-3 text-center text-xs text-[var(--muted)]">Kickoff {formatKickoff(fixture.StartTime)}</p>
      )}
    </a>
  );
}
