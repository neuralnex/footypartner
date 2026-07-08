// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { FixtureSnapshot } from '@/lib/txline/fixtures';

const MAX_FIXTURES = 12;

// No demo fixtures — only World Cup fixtures are shown. Use empty fallback.
const FALLBACK_FIXTURES: FixtureSnapshot[] = [];

const LAGOS_TIMEZONE = 'Africa/Lagos';

function getEpochDay(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LAGOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value ?? 0);
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? 1);
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? 1);

  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function formatDate(epochDay: number): string {
  const ms = epochDay * 86400000;
  const date = new Date(ms);
  return date.toLocaleDateString('en-GB', {
    timeZone: LAGOS_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isLiveFixture(fixture: FixtureSnapshot): boolean {
  const now = Date.now();
  return fixture.StartTime <= now;
}

export default function HomePage() {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<FixtureSnapshot[]>(FALLBACK_FIXTURES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = getEpochDay(new Date());
    setSelectedDay(today);
  }, []);

  useEffect(() => {
    if (selectedDay === null) return;

    setLoading(true);
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`/api/fixtures?epochDay=${selectedDay}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to fetch fixtures');
        const data = await response.json();
        // Only surface World Cup fixtures for this product
        const worldCup = data.filter((f: any) => /world cup/i.test(String(f.Competition || '')));
        setFixtures(worldCup);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.warn('[home] failed to load fixtures, using fallback', err);
          setFixtures(FALLBACK_FIXTURES);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [selectedDay]);

  const dayBefore = selectedDay ? selectedDay - 1 : null;
  const dayAfter = selectedDay ? selectedDay + 1 : null;
  const today = getEpochDay(new Date());

  const sortedFixtures = [...fixtures].sort((a, b) => a.StartTime - b.StartTime);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50 px-4 py-10 md:px-8 lg:px-14">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-[var(--font-display)] text-4xl sm:text-5xl mb-2">FOOTBALL PULSE</h1>
        <p className="text-neutral-400 mb-10">Live World Cup action made simple: scores, plays, and story updates in one place.</p>

        {selectedDay !== null && (
          <div className="mb-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => dayBefore !== null && setSelectedDay(dayBefore)}
                className="px-4 py-2 rounded-md border border-neutral-800 bg-neutral-900 text-neutral-100 text-xs font-[var(--font-mono)] tracking-[0.18em] hover:border-pulse hover:text-pulse transition"
              >
                ← PREV
              </button>

              <div className="text-center">
                <div className="text-xs font-[var(--font-mono)] text-neutral-400">
                  {formatDate(selectedDay)}
                </div>
                {selectedDay === today && (
                  <div className="text-[11px] font-[var(--font-mono)] text-[var(--pulse)] mt-1 tracking-[0.24em] uppercase">
                    TODAY
                  </div>
                )}
              </div>

              <button
                onClick={() => dayAfter !== null && setSelectedDay(dayAfter)}
                className="px-4 py-2 rounded-md border border-neutral-800 bg-neutral-900 text-neutral-100 text-xs font-[var(--font-mono)] tracking-[0.18em] hover:border-pulse hover:text-pulse transition"
              >
                NEXT →
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {loading && <p className="text-neutral-400 text-sm">Loading fixtures…</p>}
          {!loading && sortedFixtures.length === 0 && (
            <p className="text-neutral-400 text-sm">No fixtures for this day.</p>
          )}

          {!loading &&
            sortedFixtures.slice(0, MAX_FIXTURES).map((fixture) => {
              const home = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
              const away = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;
              const isLive = isLiveFixture(fixture);
              const startDate = new Date(fixture.StartTime);
              const timeStr = startDate.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: LAGOS_TIMEZONE,
              });

              return (
                <a
                  key={fixture.FixtureId}
                  href={`/match/${fixture.FixtureId}?home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`}
                  className={`block rounded-3xl border bg-[var(--surface)] p-5 text-neutral-50 transition ${isLive ? 'border-2 border-pulse shadow-[0_0_0_1px_rgba(255,68,51,0.3)]' : 'border border-neutral-800 hover:border-pulse'}`}
                >
                  {isLive && (
                    <div className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-black/30 px-3 py-1 text-[10px] font-[var(--font-mono)] uppercase tracking-[0.24em] text-[var(--pulse)]">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--pulse)]" />
                      LIVE
                    </div>
                  )}
                  <span className="text-[var(--muted)] text-xs font-[var(--font-mono)]">
                    {fixture.Competition} · {timeStr}
                  </span>
                  <div className="mt-3 text-2xl font-[var(--font-display)]">
                    {home} vs {away}
                  </div>
                </a>
              );
            })}
        </div>

        <p className="mt-10 text-sm text-neutral-500">
          Click a match to open live play-by-play, score updates, and easy-to-follow insights.
        </p>
      </div>
    </main>
  );
}
