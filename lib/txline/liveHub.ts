import { withFreshSession } from '@/lib/txline/singleton';
import { TxLineDataParser, type NormalizedMatchState, type RawOddsPayload } from '@/lib/txline/parser';
import { apiBaseUrl } from '@/lib/txline/config';
import { FootyPartnerNarrativeEngine } from '@/lib/ai/narrativeEngine';
import { getOddsSnapshot, getOddsUpdates } from '@/lib/txline/odds';
import {
  getScoreSnapshot,
  getScoreUpdates,
  getScoreHistorical,
  getCurrentScore,
  getMatchStats,
  type ScoreSnapshot,
} from '@/lib/txline/scores';
import { inferMatchIsLive } from '@/lib/txline/gameState';
import { readSseMessages, parseSseData } from '@/lib/txline/sse';
import { deriveMatchStatus, normalizeScoreEvent } from '@/lib/txline/normalizeScore';
import { isDatabaseEnabled } from '@/lib/db/pool';
import { upsertFixture, upsertMatchData } from '@/lib/db/fixtureStore';
import { LOAD_CONFIG } from '@/lib/infra/loadConfig';

const NARRATIVE_COOLDOWN_MS = Number(process.env.TXLINE_SCORE_DELAY_MS ?? '0');
const NARRATIVE_MIN_INTERVAL_MS = 5_000;

export type HubListener = (event: string, data: unknown) => void;

export interface LiveHubContext {
  homeTeam?: string;
  awayTeam?: string;
  startTimeMs?: number;
}

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
  private context: LiveHubContext;
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
  private narrativeEngine: FootyPartnerNarrativeEngine | null = null;

  private readonly seenSeq = new Set<number>();
  private readonly seenOddsMsg = new Set<string>();

  updateContext(context: LiveHubContext): void {
    this.context = { ...this.context, ...context };
    this.refreshLiveState();
  }

  private startTimeMs(): number {
    return this.context.startTimeMs ?? this.latestScore?.startTime ?? 0;
  }

  private refreshLiveState(): void {
    this.matchIsLive = inferMatchIsLive(
      this.latestScore,
      this.scoreHistory,
      Boolean(this.latestOdds?.isLive)
    );
  }

  private coerceScore(raw: unknown): ScoreSnapshot | null {
    if (!raw || typeof raw !== 'object') return null;
    const row = raw as ScoreSnapshot;
    if (typeof row.seq === 'number' && row.scoreSoccer) {
      return row;
    }
    return normalizeScoreEvent(raw as Record<string, unknown>);
  }

  constructor(fixtureId: number, context: LiveHubContext = {}) {
    this.fixtureId = fixtureId;
    this.context = context;
    try {
      this.narrativeEngine = new FootyPartnerNarrativeEngine();
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
      message: 'Shared FootyPartner feed — one upstream connection, many viewers.',
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
    this.refreshLiveState();

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

    void this.maybePersistArchive();
    void this.maybeNarrative();
  }

  private async maybePersistArchive(): Promise<void> {
    if (!LOAD_CONFIG.archiveToDb || !isDatabaseEnabled() || !this.latestScore) return;

    const finalised = this.scoreHistory.some(
      (h) =>
        h.action?.toLowerCase() === 'game_finalised' ||
        h.action?.toLowerCase() === 'match_ended'
    );
    if (!finalised && this.matchIsLive) return;

    const startTime = this.startTimeMs();
    const status = deriveMatchStatus(
      this.latestScore,
      startTime,
      this.scoreHistory,
      Boolean(this.latestOdds?.isLive)
    );

    try {
      if (this.context.homeTeam && this.context.awayTeam) {
        await upsertFixture({
          fixtureId: this.fixtureId,
          competition: 'World Cup',
          startTime,
          homeTeam: this.context.homeTeam,
          awayTeam: this.context.awayTeam,
          participant1IsHome: true,
        });
      }

      if (finalised || status === 'finished') {
        await upsertMatchData({
          fixtureId: this.fixtureId,
          status,
          latest: this.latestScore,
          history: this.scoreHistory,
          odds: this.latestOdds,
        });
      }
    } catch {
      // archive write is best-effort
    }
  }

  private applyOdds(normalized: NormalizedMatchState, source: string): void {
    this.latestOdds = normalized;
    this.refreshLiveState();
    this.broadcast('odds', { ...normalized, source, isLive: this.matchIsLive });
  }

  private async maybeNarrative(): Promise<void> {
    if (!this.matchIsLive || !this.narrativeEngine || !this.latestScore) return;
    if (!this.latestOdds) return;

    const now = Date.now();
    const waitMs = Math.max(NARRATIVE_COOLDOWN_MS, NARRATIVE_MIN_INTERVAL_MS);
    if (now - this.lastNarrativeAt < waitMs) return;

    const matchData = {
      currentScore: getCurrentScore(this.latestScore),
      stats: getMatchStats(this.latestScore),
    };
    const key = narrativeFingerprint(this.latestOdds, matchData);
    if (key === this.lastNarrativeKey) return;

    this.lastNarrativeKey = key;
    this.lastNarrativeAt = now;

    const homeTeam = this.context.homeTeam;
    const awayTeam = this.context.awayTeam;
    if (!homeTeam || !awayTeam) return;

    try {
      const narrative = await this.narrativeEngine.generateNarrative(
        this.latestOdds,
        homeTeam,
        awayTeam,
        matchData
      );
      this.broadcast('narrative', narrative);
    } catch (err) {
      this.broadcast('error', { source: 'narrative', message: String(err) });
    }
  }

  private shouldTrackLive(): boolean {
    this.refreshLiveState();
    return this.hasSubscribers();
  }

  private async pollOdds(): Promise<void> {
    if (!this.shouldTrackLive()) return;
    try {
      const payloads = await getOddsUpdates(this.fixtureId);
      if (!payloads?.length) return;
      this.applyOdds(TxLineDataParser.parseOddsPayloads(payloads), 'poll');
      void this.maybePersistArchive();
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
        const score = this.coerceScore(update);
        if (score) this.applyScore(score, 'update');
      }
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
        for (const row of snapshot) {
          const score = this.coerceScore(row);
          if (score) this.applyScore(score, 'snapshot');
        }
        this.broadcast('snapshot', snapshot);
      }
    } catch (err) {
      this.broadcast('error', { source: 'snapshot', message: String(err) });
    }

    if (this.scoreHistory.length === 0) {
      try {
        const historical = await getScoreHistorical(this.fixtureId);
        if (historical.length > 0) {
          this.scoreHistory = historical;
          this.latestSnapshot = historical;
          const latest = historical[historical.length - 1];
          const score = this.coerceScore(latest);
          if (score) {
            this.latestScore = score;
            this.refreshLiveState();
          }
          this.broadcast('snapshot', historical);
          this.broadcast('score', {
            source: 'historical',
            latest: this.latestScore,
            minute: this.latestScore?.dataSoccer?.Minutes ?? null,
            gameState: this.latestScore?.gameState,
            isLive: this.matchIsLive,
          });
        }
      } catch (err) {
        this.broadcast('error', { source: 'historical', message: String(err) });
      }
    }

    this.refreshLiveState();

    try {
      const oddsPayloads = await getOddsSnapshot(this.fixtureId);
      if (oddsPayloads?.length) {
        this.applyOdds(TxLineDataParser.parseOddsPayloads(oddsPayloads), 'snapshot');
        await this.maybeNarrative();
      }
    } catch {
      await this.pollOdds();
    }

    this.refreshLiveState();
    await this.pollScores();
  }

  private hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  private async connectScoresStream(): Promise<void> {
    while (!this.shuttingDown && this.hasSubscribers()) {
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

            const payload = parseSseData<unknown>(message.data);
            const score = this.coerceScore(payload);
            if (score) this.applyScore(score, 'stream');
          }
        });
      } catch (err) {
        if (!this.shuttingDown) {
          this.broadcast('stream', {
            channel: 'scores',
            status: 'reconnecting',
            message: String(err),
          });
          await new Promise((r) => setTimeout(r, 3_000));
        }
      }
    }
  }

  private async connectOddsStream(): Promise<void> {
    while (!this.shuttingDown && this.hasSubscribers()) {
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
                await this.maybeNarrative();
              }
            }
          }
        });
      } catch (err) {
        if (!this.shuttingDown) {
          this.broadcast('stream', { channel: 'odds', status: 'reconnecting', message: String(err) });
          await new Promise((r) => setTimeout(r, 3_000));
        }
      }
    }
  }

  private async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.shuttingDown = false;

    await this.bootstrap();
    this.refreshLiveState();

    this.oddsTimer = setInterval(() => void this.pollOdds(), LOAD_CONFIG.hub.oddsPollMs);
    this.scoresTimer = setInterval(() => void this.pollScores(), LOAD_CONFIG.hub.scoresPollMs);

    void this.connectScoresStream();
    void this.connectOddsStream();
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

export function getLiveHub(fixtureId: number, context?: LiveHubContext): FixtureLiveHub | null {
  if (hubRegistry.size >= LOAD_CONFIG.hub.maxChannels && !hubRegistry.has(fixtureId)) {
    return null;
  }
  let hub = hubRegistry.get(fixtureId);
  if (!hub) {
    hub = new FixtureLiveHub(fixtureId, context);
    hubRegistry.set(fixtureId, hub);
  } else if (context) {
    hub.updateContext(context);
  }
  return hub;
}

export function liveHubStats() {
  return {
    channels: hubRegistry.size,
    subscribers: [...hubRegistry.values()].reduce((n, h) => n + h.subscriberCount, 0),
  };
}
