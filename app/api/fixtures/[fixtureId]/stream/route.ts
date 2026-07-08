// app/api/fixtures/[fixtureId]/stream/route.ts
//
// Server-Sent Events endpoint: pushes a fresh odds+narrative update every
// POLL_INTERVAL_MS while the client tab stays open, instead of the client
// polling on its own. This is what makes the frontend feel "live" rather
// than a page you have to refresh — worth having for the demo even before
// the odds schema is fully nailed down, since it degrades gracefully:
// a schema mismatch just shows up as an `error` event in the stream.

import { NextRequest } from 'next/server';
import axios from 'axios';
import { withFreshSession } from '@/lib/txline/singleton';
import { TxLineDataParser, RawOddsPayload, type NormalizedMatchState } from '@/lib/txline/parser';
import { apiBaseUrl } from '@/lib/txline/config';
import { FootballPulseNarrativeEngine } from '@/lib/ai/narrativeEngine';
import { getScoreUpdates, getScoreSnapshot, getCurrentScore, getMatchStats, type ScoreSnapshot } from '@/lib/txline/scores';

export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 8000;
const SCORE_POPULATE_DELAY_MS = Number(process.env.TXLINE_SCORE_DELAY_MS ?? '60000');

interface FixtureStreamCacheEntry {
  normalized: NormalizedMatchState;
  matchData: { currentScore: { home: number; away: number }; stats: any };
  scores: ScoreSnapshot[];
  lastUpdated: number;
}

const fixtureStreamCache = new Map<number, FixtureStreamCacheEntry>();

function scoreKeyFromSnapshot(scores: ScoreSnapshot[]) {
  if (!scores || scores.length === 0) return '';
  const latest = scores[scores.length - 1];
  return JSON.stringify({
    gameState: latest.gameState,
    score: latest.scoreSoccer ? `${latest.scoreSoccer.Participant1.Total?.Goals ?? 0}-${latest.scoreSoccer.Participant2.Total?.Goals ?? 0}` : null,
  });
}

function narrativeKey(
  normalized: NormalizedMatchState,
  matchData: { currentScore: { home: number; away: number }; stats: any }
) {
  return JSON.stringify({
    gameState: normalized.gameState,
    isLive: normalized.isLive,
    probabilities: normalized.probabilities,
    score: matchData.currentScore,
    possession: matchData.stats?.possession,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const fixtureIdNum = Number(fixtureId);
  const { searchParams } = new URL(request.url);
  const homeTeam = searchParams.get('home') ?? 'Home';
  const awayTeam = searchParams.get('away') ?? 'Away';
  const withNarrative = searchParams.get('narrative') !== 'false';

  if (!Number.isFinite(fixtureIdNum)) {
    return new Response('fixtureId must be numeric', { status: 400 });
  }

  const encoder = new TextEncoder();
  let narrativeEngine: FootballPulseNarrativeEngine | null = null;
  try {
    if (withNarrative) narrativeEngine = new FootballPulseNarrativeEngine();
  } catch {
    // GEMINI_API_KEY missing — stream odds only, skip narrative silently.
  }

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let readyToPublish = false;
      let lastSentScoreKey = '';
      let lastSentNarrativeKey = '';
      let cachedNormalized: NormalizedMatchState | null = null;
      let cachedMatchData: { currentScore: { home: number; away: number }; stats: any } | null = null;
      let cachedScores: ScoreSnapshot[] | null = null;

      const delayTimer = setTimeout(async () => {
        readyToPublish = true;
        if (cachedNormalized && cachedMatchData && cachedScores) {
          const scoreKey = scoreKeyFromSnapshot(cachedScores);
          if (scoreKey && scoreKey !== lastSentScoreKey) {
            lastSentScoreKey = scoreKey;
            send('scores', cachedScores);
          }
          if (cachedNormalized && narrativeEngine) {
            const currentNarrativeKey = narrativeKey(cachedNormalized, cachedMatchData);
            if (currentNarrativeKey && currentNarrativeKey !== lastSentNarrativeKey) {
              lastSentNarrativeKey = currentNarrativeKey;
              try {
                const narrative = await narrativeEngine.generateNarrative(
                  cachedNormalized,
                  homeTeam,
                  awayTeam,
                  cachedMatchData
                );
                send('narrative', narrative);
              } catch (narrativeErr) {
                send('error', { source: 'narrative', message: String(narrativeErr) });
              }
            }
          }
        }
      }, SCORE_POPULATE_DELAY_MS);

      const send = (event: string, data: unknown) => {
        if (closed || !readyToPublish) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const sendUnbuffered = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const tick = async () => {
        try {
          const normalized = await withFreshSession(async (headers) => {
            const response = await axios.get<RawOddsPayload[]>(
              `${apiBaseUrl}/odds/updates/${fixtureIdNum}`,
              { headers }
            );
            return TxLineDataParser.parseLiveOdds(response.data);
          });

          sendUnbuffered('odds', normalized);

          // Fetch rich score data with stats, lineups, etc.
          let matchData: { currentScore: { home: number; away: number }; stats: any } = {
            currentScore: { home: 0, away: 0 },
            stats: null,
          };
          try {
            const scoreSnapshot = await getScoreSnapshot(fixtureIdNum);
            if (scoreSnapshot && scoreSnapshot.length > 0) {
              const latestScore = scoreSnapshot[scoreSnapshot.length - 1];
              matchData.currentScore = getCurrentScore(latestScore);
              const stats = getMatchStats(latestScore);
              if (stats) {
                matchData.stats = stats;
              }
              cachedScores = scoreSnapshot;
            }
          } catch (scoresErr) {
            console.warn('[stream] score snapshot fetch failed:', scoresErr);
          }

          cachedNormalized = normalized;
          cachedMatchData = matchData;

          const shouldEmitNarrative = () => {
            if (!narrativeEngine) return false;
            const currentKey = narrativeKey(normalized, matchData);
            if (currentKey === lastSentNarrativeKey) return false;
            lastSentNarrativeKey = currentKey;
            return true;
          };

          if (narrativeEngine && shouldEmitNarrative() && readyToPublish) {
            try {
              const narrative = await narrativeEngine.generateNarrative(
                normalized,
                homeTeam,
                awayTeam,
                matchData
              );
              send('narrative', narrative);
            } catch (narrativeErr) {
              send('error', { source: 'narrative', message: String(narrativeErr) });
            }
          }

          // Fetch and broadcast score updates
          try {
            const scores = await getScoreUpdates(fixtureIdNum);
            if (scores && scores.length > 0) {
              cachedScores = scores;
              const currentScoreKey = scoreKeyFromSnapshot(scores);
              if (readyToPublish && currentScoreKey !== lastSentScoreKey) {
                lastSentScoreKey = currentScoreKey;
                send('scores', scores);
              }
            }
          } catch (scoresErr) {
            // Silently fail on scores — don't break the odds stream
            console.warn('[stream] scores fetch failed:', scoresErr);
          }

          if (cachedNormalized && cachedMatchData && cachedScores) {
            fixtureStreamCache.set(fixtureIdNum, {
              normalized: cachedNormalized,
              matchData: cachedMatchData,
              scores: cachedScores,
              lastUpdated: Date.now(),
            });
          }
        } catch (err) {
          send('error', { source: 'odds', message: String(err) });
        }
      };

      // Fire immediately, then on interval.
      tick();
      const interval = setInterval(tick, POLL_INTERVAL_MS);

      request.signal.addEventListener('abort', () => {
        closed = true;
        clearTimeout(delayTimer);
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
