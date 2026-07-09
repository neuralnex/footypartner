import { withFreshSession } from '@/lib/txline/singleton';
import { TxLineDataParser, type NormalizedMatchState, type RawOddsPayload } from '@/lib/txline/parser';
import { apiBaseUrl } from '@/lib/txline/config';
import { FootballPulseNarrativeEngine } from '@/lib/ai/narrativeEngine';
import { getOddsSnapshot, getOddsUpdates } from '@/lib/txline/odds';
import {
  getScoreSnapshot,
  getScoreUpdates,
  getCurrentScore,
  getMatchStats,
  type ScoreSnapshot,
} from '@/lib/txline/scores';
import { isSoccerLive } from '@/lib/txline/gameState';
import { readSseMessages, parseSseData } from '@/lib/txline/sse';
import { deriveMatchStatus } from '@/lib/txline/normalizeScore';
import { isDatabaseEnabled } from '@/lib/db/pool';
import { upsertMatchData } from '@/lib/db/fixtureStore';
import { LOAD_CONFIG } from '@/lib/infra/loadConfig';

const NARRATIVE_COOLDOWN_MS = Number(process.env.TXLINE_SCORE_DELAY_MS ?? '60000');

export type HubListener = (event: string, data: unknown) => void;

function narrativeFingerprint(
  normalized: NormalizedMatchState,
  matchData: { currentScore: { home: number; away: number }; stats: unknown }
) {
  return JSON.stringify({
    gameState: normalized.gameState,
    isLive: normalized.isLive,
    probabilities: normalized.probabilities,
    score: matchData.currentScore,
  });
}

class FixtureLiveHub {
  readonly fixtureId: number;
  private subscribers = new Map<string, HubListener>();
  private started = false;
  private shuttingDown = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private oddsTimer: ReturnType<typeof setInterval> | null = null;
  private scoresTimer: ReturnType<typeof setInterval> | null = null;
  private upstreamAbort: AbortController | null = null;

  private latestScore: ScoreSnapshot | null = null;
  private latestOdds: NormalizedMatchState | null = null;
  private latestSnapshot: ScoreSnapshot[] | null = null;
  private scoreHistory: ScoreSnapshot[] = [];
  private matchIsLive = false;
  private lastNarrativeKey = '';
  private lastNarrativeAt = 0;
  private narrativeEngine: FootballPulseNarrativeEngine | null = null;

  private readonly seenSeq = new Set<number>();
  private readonly seenOddsMsg = new Set<string>();

  constructor(fixtureId: number) {
    this.fixtureId = fixtureId;
    try {
      this.narrativeEngine = new FootballPulseNarrativeEngine();
    } catch {
      this.narrativeEngine = null;
    }
  }

  canAcceptSubscriber(): boolean {
    return this.subscribers.size < LOAD_CONFIG.hub.maxSubscribersPerChannel;
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }

  subscribe(id: string, listener: HubListener): void {
    this.subscribers.set(id, listener);
    this.cancelIdleShutdown();
    this.replay(listener);
    if (!this.started) void this.start();
  }

  unsubscribe(id: string): void {
    this.subscribers.delete(id);
    if (this.subscribers.size === 0) this.scheduleIdleShutdown();
  }

  private replay(listener: HubListener): void {
    listener('meta', {
      devnetDelaySec: Math.round(NARRATIVE_COOLDOWN_MS / 1000),
      message: 'Shared Pulse feed — one upstream connection, many viewers.',
    });
    if (this.latestSnapshot) listener('snapshot', this.latestSnapshot);
    if (this.latestScore) {
      listener('score', {
        source: 'replay',
        latest: this.latestScore,
        minute: this.latestScore.dataSoccer?.Minutes ?? null,
        gameState: this.latestScore.gameState,
        isLive: this.matchIsLive,
      });
    }
    if (this.latestOdds) listener('odds', { ...this.latestOdds, source: 'replay' });
  }

  private broadcast(event: string, data: unknown): void {
    for (const listener of this.subscribers.values()) {
      listener(event, data);
    }
  }

  private applyScore(score: ScoreSnapshot, source: 'snapshot' | 'update' | 'stream' | 'replay') {
    if (!score || typeof score.fixtureId !== 'number') return;
    if (source !== 'snapshot' && source !== 'replay' && this.seenSeq.has(score.seq)) return;
    if (source !== 'replay') this.seenSeq.add(score.seq);
    this.latestScore = score;
    this.matchIsLive = isSoccerLive(score.gameState);

    this.broadcast('score', {
      source,
      latest: score,
      minute: score.dataSoccer?.Minutes ?? null,
      gameState: score.gameState,
      isLive: this.matchIsLive,
    });

    if (!this.scoreHistory.some((row) => row.seq === score.seq)) {
      this.scoreHistory.push(score);
      if (this.scoreHistory.length > 2000) {
        this.scoreHistory = this.scoreHistory.slice(-2000);
      }
    }

    void this.persistToDatabase();
  }

  private async persistToDatabase(): Promise<void> {
    if (!isDatabaseEnabled() || !this.latestScore) return;

    const status = deriveMatchStatus(this.latestScore, this.latestScore.startTime);
    try {
      await upsertMatchData({
        fixtureId: this.fixtureId,
        status: status === 'upcoming' ? 'live' : status,
        latest: this.latestScore,
        history: this.scoreHistory,
        odds: this.latestOdds,
      });
    } catch {
    }
  }

  private applyOdds(normalized: NormalizedMatchState, source: string): void {
    this.latestOdds = normalized;
    this.matchIsLive = this.matchIsLive || normalized.isLive;
    this.broadcast('odds', { ...normalized, source });
  }

  private async maybeNarrative(): Promise<void> {
    if (!this.matchIsLive || !this.narrativeEngine || !this.latestOdds || !this.latestScore) return;
    const now = Date.now();
    if (now - this.lastNarrativeAt < NARRATIVE_COOLDOWN_MS) return;

    const matchData = {
      currentScore: getCurrentScore(this.latestScore),
      stats: getMatchStats(this.latestScore),
    };
    const key = narrativeFingerprint(this.latestOdds, matchData);
    if (key === this.lastNarrativeKey) return;

    this.lastNarrativeKey = key;
    this.lastNarrativeAt = now;

    try {
      const narrative = await this.narrativeEngine.generateNarrative(
        this.latestOdds,
        'Home',
        'Away',
        matchData
      );
      this.broadcast('narrative', narrative);
    } catch (err) {
      this.broadcast('error', { source: 'narrative', message: String(err) });
    }
  }

  private async pollOdds(): Promise<void> {
    if (!this.matchIsLive) return;
    try {
      const payloads = await getOddsUpdates(this.fixtureId);
      if (!payloads?.length) return;
      this.applyOdds(TxLineDataParser.parseOddsPayloads(payloads), 'poll');
      void this.persistToDatabase();
      await this.maybeNarrative();
    } catch (err) {
      this.broadcast('error', { source: 'odds', message: String(err) });
    }
  }

  private async pollScores(): Promise<void> {
    try {
      const updates = await getScoreUpdates(this.fixtureId);
      if (!Array.isArray(updates) || updates.length === 0) return;
      for (const update of updates) {
        if (update && typeof update.seq === 'number') {
          this.applyScore(update as ScoreSnapshot, 'update');
        }
      }
      await this.maybeNarrative();
    } catch (err) {
      this.broadcast('error', { source: 'scores', message: String(err) });
    }
  }

  private async bootstrap(): Promise<void> {
    try {
      const snapshot = await getScoreSnapshot(this.fixtureId);
      if (Array.isArray(snapshot) && snapshot.length > 0) {
        this.latestSnapshot = snapshot;
        this.scoreHistory = [...snapshot];
        for (const row of snapshot) this.applyScore(row, 'snapshot');
        this.broadcast('snapshot', snapshot);
      }
    } catch (err) {
      this.broadcast('error', { source: 'snapshot', message: String(err) });
    }

    try {
      const oddsPayloads = await getOddsSnapshot(this.fixtureId);
      if (oddsPayloads?.length) {
        this.applyOdds(TxLineDataParser.parseOddsPayloads(oddsPayloads), 'snapshot');
      }
    } catch {
      await this.pollOdds();
    }

    if (this.matchIsLive) {
      await this.pollScores();
    } else {
      this.broadcast('meta', { message: 'Match not live — archive mode. Pulse stream idle.' });
    }
  }

  private async connectScoresStream(): Promise<void> {
    if (!this.matchIsLive || this.shuttingDown) return;
    try {
      this.upstreamAbort = new AbortController();
      await withFreshSession(async (headers) => {
        const streamUrl = `${apiBaseUrl}/scores/stream?fixtureId=${this.fixtureId}`;
        const response = await fetch(streamUrl, {
          headers: { ...headers, Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
          signal: this.upstreamAbort!.signal,
        });

        if (!response.ok) throw new Error(`scores stream: ${response.status}`);
        this.broadcast('stream', { channel: 'scores', status: 'connected' });

        for await (const message of readSseMessages(response)) {
          if (this.shuttingDown) break;
          if (message.event === 'heartbeat') continue;
          if (!message.data) continue;

          const payload = parseSseData<ScoreSnapshot>(message.data);
          if (payload && typeof payload === 'object' && 'seq' in payload) {
            this.applyScore(payload, 'stream');
            await this.maybeNarrative();
          }
        }
      });
    } catch (err) {
      if (!this.shuttingDown) {
        this.broadcast('stream', { channel: 'scores', status: 'reconnecting', message: String(err) });
      }
    }
  }

  private async connectOddsStream(): Promise<void> {
    if (!this.matchIsLive || this.shuttingDown) return;
    try {
      await withFreshSession(async (headers) => {
        const streamUrl = `${apiBaseUrl}/odds/stream?fixtureId=${this.fixtureId}`;
        const response = await fetch(streamUrl, {
          headers: { ...headers, Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
          signal: this.upstreamAbort?.signal,
        });

        if (!response.ok) throw new Error(`odds stream: ${response.status}`);
        this.broadcast('stream', { channel: 'odds', status: 'connected' });

        for await (const message of readSseMessages(response)) {
          if (this.shuttingDown) break;
          if (message.event === 'heartbeat') continue;
          if (!message.data) continue;

          const payload = parseSseData<RawOddsPayload>(message.data);
          if (payload && typeof payload === 'object' && 'FixtureId' in payload) {
            const msgKey = payload.MessageId ?? `${payload.Ts}`;
            if (this.seenOddsMsg.has(msgKey)) continue;
            this.seenOddsMsg.add(msgKey);

            try {
              const batch = await getOddsUpdates(this.fixtureId);
              if (batch?.length) {
                this.applyOdds(TxLineDataParser.parseOddsPayloads(batch), 'stream');
                await this.maybeNarrative();
              }
            } catch {
              this.applyOdds(TxLineDataParser.parseOddsPayloads([payload]), 'stream-single');
            }
          }
        }
      });
    } catch (err) {
      if (!this.shuttingDown) {
        this.broadcast('stream', { channel: 'odds', status: 'reconnecting', message: String(err) });
      }
    }
  }

  private async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.shuttingDown = false;

    await this.bootstrap();

    this.oddsTimer = setInterval(() => void this.pollOdds(), LOAD_CONFIG.hub.oddsPollMs);
    this.scoresTimer = setInterval(() => void this.pollScores(), LOAD_CONFIG.hub.scoresPollMs);

    if (this.matchIsLive) {
      void this.connectScoresStream();
      void this.connectOddsStream();
    }
  }

  private scheduleIdleShutdown(): void {
    this.cancelIdleShutdown();
    this.idleTimer = setTimeout(() => this.shutdown(), LOAD_CONFIG.hub.idleShutdownMs);
  }

  private cancelIdleShutdown(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private shutdown(): void {
    if (this.subscribers.size > 0) return;
    this.shuttingDown = true;
    this.started = false;
    if (this.oddsTimer) clearInterval(this.oddsTimer);
    if (this.scoresTimer) clearInterval(this.scoresTimer);
    this.upstreamAbort?.abort();
    this.upstreamAbort = null;
    hubRegistry.delete(this.fixtureId);
  }
}

declare global {

  var __fpLiveHubs: Map<number, FixtureLiveHub> | undefined;
}

const hubRegistry = globalThis.__fpLiveHubs ?? new Map<number, FixtureLiveHub>();
if (process.env.NODE_ENV !== 'production') globalThis.__fpLiveHubs = hubRegistry;

export function getLiveHub(fixtureId: number): FixtureLiveHub | null {
  if (hubRegistry.size >= LOAD_CONFIG.hub.maxChannels && !hubRegistry.has(fixtureId)) {
    return null;
  }
  let hub = hubRegistry.get(fixtureId);
  if (!hub) {
    hub = new FixtureLiveHub(fixtureId);
    hubRegistry.set(fixtureId, hub);
  }
  return hub;
}

export function liveHubStats() {
  return {
    channels: hubRegistry.size,
    subscribers: [...hubRegistry.values()].reduce((n, h) => n + h.subscriberCount, 0),
  };
}
