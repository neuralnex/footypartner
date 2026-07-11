import { NextRequest, NextResponse } from 'next/server';
import { getWorldCupFixturesForDay } from '@/lib/txline/fixtures';
import { getEpochDay, resolveUserTimeZone } from '@/lib/txline/dates';
import { txlineCache } from '@/lib/infra/ttlCache';
import { LOAD_CONFIG } from '@/lib/infra/loadConfig';
import { mapWithConcurrency } from '@/lib/infra/concurrency';
import { guardRequest, rateLimitResponse } from '@/lib/infra/apiGuard';
import { boardFixtureFromResolved, resolveMatchData, isInMatchWindow } from '@/lib/match/resolveMatchData';

export const dynamic = 'force-dynamic';

export type FixtureStatus = 'upcoming' | 'live' | 'finished' | 'unavailable';

export interface BoardFixture {
  FixtureId: number;
  Competition: string;
  StartTime: number;
  homeTeam: string;
  awayTeam: string;
  status: FixtureStatus;
  gameState: string;
  gameStateLabel: string;
  minute: string;
  resultLabel: 'FT' | 'AET' | 'Pens' | null;
  scoreHome: number | null;
  scoreAway: number | null;
  isPulse: boolean;
}

async function enrichFixture(
  fixture: Awaited<ReturnType<typeof getWorldCupFixturesForDay>>[number],
  epochDayNum: number
): Promise<BoardFixture> {
  const home = fixture.Participant1IsHome ? fixture.Participant1 : fixture.Participant2;
  const away = fixture.Participant1IsHome ? fixture.Participant2 : fixture.Participant1;
  const now = Date.now();

  if (fixture.StartTime > now) {
    return {
      FixtureId: fixture.FixtureId,
      Competition: fixture.Competition,
      StartTime: fixture.StartTime,
      homeTeam: home,
      awayTeam: away,
      status: 'upcoming',
      gameState: 'NS',
      gameStateLabel: 'Not started',
      minute: '',
      resultLabel: null,
      scoreHome: null,
      scoreAway: null,
      isPulse: false,
    };
  }

  const resolved = await resolveMatchData(fixture.FixtureId, {
    startTimeMs: fixture.StartTime,
    competition: fixture.Competition,
    homeTeam: home,
    awayTeam: away,
    participant1IsHome: fixture.Participant1IsHome,
    epochDay: epochDayNum,
    forceRefresh: isInMatchWindow(fixture.StartTime),
    fetchOdds: isInMatchWindow(fixture.StartTime),
  });

  return boardFixtureFromResolved(
    {
      FixtureId: fixture.FixtureId,
      Competition: fixture.Competition,
      StartTime: fixture.StartTime,
      homeTeam: home,
      awayTeam: away,
    },
    resolved
  );
}

function boardCacheTtl(epochDay: number, fixtures: BoardFixture[], timeZone: string): number {
  const today = getEpochDay(new Date(), timeZone);
  if (fixtures.some((f) => f.status === 'live')) return LOAD_CONFIG.cache.boardLive;
  if (epochDay < today - 1) return LOAD_CONFIG.cache.boardArchive;
  if (fixtures.length > 0 && fixtures.every((f) => f.status === 'finished')) {
    return LOAD_CONFIG.cache.boardArchive;
  }
  return LOAD_CONFIG.cache.boardDefault;
}

export async function GET(request: NextRequest) {
  const rate = guardRequest(request, 'board');
  if (!rate.ok) return rateLimitResponse(rate);

  const { searchParams } = new URL(request.url);
  const epochDay = searchParams.get('epochDay');
  const timeZone = resolveUserTimeZone(searchParams.get('timeZone'));

  if (!epochDay) {
    return NextResponse.json({ error: 'epochDay query parameter required' }, { status: 400 });
  }

  const epochDayNum = Number(epochDay);
  if (!Number.isFinite(epochDayNum)) {
    return NextResponse.json({ error: 'epochDay must be a valid integer' }, { status: 400 });
  }

  try {
    const cacheKey = `board:${epochDayNum}:${timeZone}`;
    const cached = txlineCache.get<BoardFixture[]>(cacheKey);
    if (cached) {
      const ttlMs = boardCacheTtl(epochDayNum, cached, timeZone);
      return NextResponse.json(cached, {
        headers: {
          'Cache-Control': `public, s-maxage=${Math.floor(ttlMs / 1000)}, stale-while-revalidate=60`,
          'X-Cache': 'HIT',
        },
      });
    }

    const fixtures = await getWorldCupFixturesForDay(epochDayNum, timeZone);
    const enriched = await mapWithConcurrency(
      fixtures,
      LOAD_CONFIG.boardConcurrency,
      (fixture) => enrichFixture(fixture, epochDayNum)
    );

    const visible = enriched.filter((f) => f.status !== 'unavailable');

    visible.sort((a, b) => {
      const rank = (s: FixtureStatus) =>
      s === 'live' ? 0 : s === 'upcoming' ? 1 : s === 'unavailable' ? 3 : 2;
      const statusDiff = rank(a.status) - rank(b.status);
      if (statusDiff !== 0) return statusDiff;
      return a.StartTime - b.StartTime;
    });

    const ttlMs = boardCacheTtl(epochDayNum, visible, timeZone);
    txlineCache.set(cacheKey, visible, ttlMs);

    return NextResponse.json(visible, {
      headers: {
        'Cache-Control': `public, s-maxage=${Math.floor(ttlMs / 1000)}, stale-while-revalidate=60`,
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('[api/fixtures/board]', err);
    return NextResponse.json({ error: 'Failed to fetch fixture board.' }, { status: 502 });
  }
}
