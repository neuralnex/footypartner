'use client';

import { useEffect, useRef, useState } from 'react';
import {
  describeScoreEvent,
  extractLineups,
  formatGameState,
  formatMatchEndLabel,
  formatMatchMinute,
  isSoccerLive,
  scoreFromSnapshot,
} from '@/lib/txline/gameState';
import type { ScoreSnapshot } from '@/lib/txline/scores';

import type { OddsMarketView } from '@/lib/txline/parser';

interface ProbabilityPoint {
  t: number;
  home: number;
  draw: number;
  away: number;
}

interface NarrativeOutput {
  matchPulse: string;
  whyItMatters: string;
  whatIf: string;
}

interface FeedEntry {
  id: number;
  time: string;
  narrative: NarrativeOutput;
}

interface ScoreEvent {
  id: number;
  minute: string;
  action: string;
  seq: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type Tab = 'summary' | 'odds' | 'events' | 'stats' | 'lineups' | 'chat';

const MAX_POINTS = 40;
const MAX_FEED = 12;

export default function FixtureDashboard({
  fixtureId,
  homeTeam,
  awayTeam,
  isPulse: initialPulse = false,
}: {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  isPulse?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialPulse ? 'summary' : 'events');
  const [history, setHistory] = useState<ProbabilityPoint[]>([]);
  const [gameState, setGameState] = useState('CONNECTING');
  const [matchMinute, setMatchMinute] = useState('—');
  const [isLive, setIsLive] = useState(initialPulse);
  const [isPulse, setIsPulse] = useState(initialPulse);
  const [oddsBookmaker, setOddsBookmaker] = useState<string | null>(null);
  const [oddsMarkets, setOddsMarkets] = useState<OddsMarketView[]>([]);
  const [latestProbs, setLatestProbs] = useState<{ home: number; draw: number; away: number } | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [currentScore, setCurrentScore] = useState(scoreFromSnapshot(null));
  const [matchStats, setMatchStats] = useState<{
    possession?: number;
    possessionType?: string;
    stats?: Record<string, number>;
  }>({});
  const [lineups, setLineups] = useState<{
    home: ReturnType<typeof extractLineups>['home'];
    away: ReturnType<typeof extractLineups>['away'];
  }>({ home: [], away: [] });
  const [connection, setConnection] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [devnetNote, setDevnetNote] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: initialPulse
        ? `FootyPartner is live! Ask me anything about ${homeTeam} vs ${awayTeam} as the match unfolds.`
        : `Viewing match archive for ${homeTeam} vs ${awayTeam}. Ask me about the final score or key moments.`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const feedIdRef = useRef(0);
  const seenSeqRef = useRef(new Set<number>());
  const historyRef = useRef<ScoreSnapshot[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const applyLatestScore = (latest: ScoreSnapshot, history = historyRef.current) => {
    setCurrentScore(scoreFromSnapshot(latest));
    setGameState(formatMatchEndLabel(latest, history));
    setMatchMinute(formatMatchMinute(latest, history));
    setIsLive(isSoccerLive(latest.gameState));

    if (latest.stats || latest.possession !== undefined) {
      setMatchStats({
        possession: latest.possession,
        possessionType: latest.possessionType,
        stats: latest.stats,
      });
    }

    const teams = extractLineups(latest);
    if (teams.home.length > 0 || teams.away.length > 0) {
      setLineups(teams);
    }
  };

  const pushScoreEvent = (score: ScoreSnapshot) => {
    if (seenSeqRef.current.has(score.seq)) return;
    seenSeqRef.current.add(score.seq);

    const action = describeScoreEvent(score);
    if (!action) return;

    feedIdRef.current += 1;
    setScoreEvents((prev) =>
      [
        {
          id: feedIdRef.current,
          minute: formatMatchMinute(score, historyRef.current),
          action,
          seq: score.seq,
        },
        ...prev,
      ].slice(0, MAX_FEED)
    );
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await fetch(`/api/fixtures/${fixtureId}/match-data?home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}`);
        if (!res.ok) return;

        const data = await res.json();
        const live = data.status === 'live';
        const history = Array.isArray(data.history) ? data.history : [];
        historyRef.current = history;

        if (data.latest) {
          applyLatestScore(data.latest as ScoreSnapshot, history);
          setIsLive(live);
          setIsPulse(live);
        } else if (data.status === 'unavailable') {
          setGameState('No coverage');
          setMatchMinute('—');
        }

        history.forEach((row: ScoreSnapshot) => pushScoreEvent(row));

        if (data.odds?.probabilities) {
          setLatestProbs({
            home: data.odds.probabilities.homeWin,
            draw: data.odds.probabilities.draw,
            away: data.odds.probabilities.awayWin,
          });
          setOddsBookmaker(data.odds.bookmaker);
          setOddsMarkets(data.odds.markets ?? []);
        }
      } catch (err) {
        console.warn('[dashboard] initial load failed:', err);
      }
    };

    fetchInitial();
  }, [fixtureId, homeTeam, awayTeam]);

  useEffect(() => {
    if (!isPulse) {
      setConnection('live');
      return;
    }

    const url = `/api/fixtures/${fixtureId}/stream?home=${encodeURIComponent(
      homeTeam
    )}&away=${encodeURIComponent(awayTeam)}`;
    const source = new EventSource(url);

    source.addEventListener('open', () => setConnection('live'));

    source.addEventListener('meta', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      if (data.devnetDelaySec) {
        setDevnetNote(`Devnet feed · AI summaries refresh ~every ${data.devnetDelaySec}s`);
      }
    });

    source.addEventListener('odds', (event) => {
      setConnection('live');
      const data = JSON.parse((event as MessageEvent).data);
      setGameState(formatGameState(data.gameState));
      setIsLive(Boolean(data.isLive));
      setIsPulse(Boolean(data.isLive));
      if (data.bookmaker) setOddsBookmaker(data.bookmaker);
      if (data.markets) setOddsMarkets(data.markets);
      if (data.probabilities) {
        setLatestProbs({
          home: data.probabilities.homeWin,
          draw: data.probabilities.draw,
          away: data.probabilities.awayWin,
        });
        setHistory((prev) => {
          const next = [
            ...prev,
            {
              t: Date.now(),
              home: data.probabilities.homeWin,
              draw: data.probabilities.draw,
              away: data.probabilities.awayWin,
            },
          ];
          return next.slice(-MAX_POINTS);
        });
      }
    });

    source.addEventListener('score', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      const latest = data.latest as ScoreSnapshot;
      if (!latest) return;
      applyLatestScore(latest);
      pushScoreEvent(latest);
    });

    source.addEventListener('narrative', (event) => {
      const narrative = JSON.parse((event as MessageEvent).data) as NarrativeOutput;
      feedIdRef.current += 1;
      setFeed((prev) =>
        [
          {
            id: feedIdRef.current,
            time: new Date().toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Africa/Lagos',
            }),
            narrative,
          },
          ...prev,
        ].slice(0, MAX_FEED)
      );
    });

    source.addEventListener('error', () => setConnection('error'));

    return () => source.close();
  }, [fixtureId, homeTeam, awayTeam, isPulse]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const nextMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch(`/api/fixtures/${fixtureId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, homeTeam, awayTeam }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Couldn't reach the AI right now — live data may still be syncing." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--floodlight)]">
      <div className="mx-auto max-w-4xl px-4 py-6 pb-24">
        <a href="/" className="mb-4 inline-flex text-sm text-[var(--muted)] hover:text-[var(--gold)]">
          ← All matches
        </a>

        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
              {isPulse ? (
                <span className="text-[var(--gold)]">● Live</span>
              ) : (
                'Match archive'
              )}
            </p>
            <h1 className="mt-1 font-display-var text-3xl sm:text-4xl tracking-wide">
              {homeTeam} <span className="text-[var(--muted)]">vs</span> {awayTeam}
            </h1>
          </div>
          <div className="text-right">
            {isPulse ? (
              <div className="flex items-center justify-end gap-2">
                <span className="pulse-live h-2.5 w-2.5 rounded-full bg-[var(--pulse)]" />
                <span className="font-display-var text-xl text-[var(--gold)]">
                  {connection === 'live' ? 'LIVE' : connection === 'error' ? '···' : '···'}
                </span>
              </div>
            ) : (
              <span className="text-sm text-[var(--muted)]">{gameState}</span>
            )}
            <p className="mt-1 text-sm text-[var(--muted)]">{isPulse ? gameState : 'Final / archive'}</p>
          </div>
        </header>

        <section className={`match-card mb-4 p-5 ${isPulse ? 'match-card-live' : ''}`}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div>
              <p className="truncate text-sm text-[var(--muted)]">{homeTeam}</p>
              <p className="font-display-var text-5xl text-[var(--floodlight)]">{currentScore.home}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                🟨 {currentScore.homeYellows} · 🟥 {currentScore.homeReds} · 🚩 {currentScore.homeCorners}
              </p>
            </div>
            <div className="px-2">
              {isPulse ? (
                <p className="pulse-live inline-flex items-center gap-2 font-display-var text-3xl text-[var(--gold)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--pulse)]" />
                  {matchMinute}
                </p>
              ) : (
                <p className="font-display-var text-2xl text-[var(--muted)]">{matchMinute}</p>
              )}
            </div>
            <div>
              <p className="truncate text-sm text-[var(--muted)]">{awayTeam}</p>
              <p className="font-display-var text-5xl text-[var(--floodlight)]">{currentScore.away}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                🟨 {currentScore.awayYellows} · 🟥 {currentScore.awayReds} · 🚩 {currentScore.awayCorners}
              </p>
            </div>
          </div>
          {devnetNote && isPulse && (
            <p className="mt-4 text-center text-xs text-[var(--gold)]">{devnetNote}</p>
          )}
          {!isPulse && (
            <p className="mt-4 text-center text-xs text-[var(--muted)]">
              FootyPartner AI summaries and live odds are only available during live matches.
            </p>
          )}
        </section>

        <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-1">
          {(
            [
              ['summary', 'Summary'],
              ...(isPulse ? [['odds', 'Odds'] as const] : []),
              ['events', 'Events'],
              ['stats', 'Stats'],
              ['lineups', 'Lineups'],
              ['chat', 'Ask AI'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === key
                  ? 'bg-[var(--gold)] text-[var(--bg)]'
                  : 'text-[var(--muted)] hover:text-[var(--floodlight)]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'summary' && (
          <div className="space-y-4">
            {(latestProbs || history.length > 0) && (
              <section className="match-card p-5">
                <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Win probability {oddsBookmaker ? `· ${oddsBookmaker}` : ''}
                </h2>
                <OddsBar
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  probs={latestProbs ?? history[history.length - 1]}
                />
              </section>
            )}

            <section className="match-card p-5">
              <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                {isPulse ? 'AI match summary' : 'Match summary'}
              </h2>
              {!isPulse && feed.length === 0 && (
                <p className="text-sm text-[var(--muted)]">
                  Archive view — explore events and stats from this match. Live summaries appear during play.
                </p>
              )}
              {isPulse && feed.length === 0 && (
                <p className="text-sm text-[var(--muted)]">
                  Waiting for the first AI summary — odds and scores update live on devnet (~60s sampling).
                </p>
              )}
              <div className="space-y-4">
                {feed.map((entry) => (
                  <FeedCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'odds' && isPulse && (
          <section className="match-card p-5">
            <h2 className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Live odds</h2>
            {oddsBookmaker && (
              <p className="mb-4 text-sm text-[var(--gold)]">Source: {oddsBookmaker}</p>
            )}
            {oddsMarkets.length === 0 && !latestProbs ? (
              <p className="text-sm text-[var(--muted)]">Odds syncing from TxLINE…</p>
            ) : (
              <div className="space-y-4">
                {latestProbs && (
                  <OddsBar homeTeam={homeTeam} awayTeam={awayTeam} probs={latestProbs} />
                )}
                {oddsMarkets.map((market, i) => (
                  <div key={i} className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)] p-4">
                    <div className="mb-3 flex justify-between text-xs text-[var(--muted)]">
                      <span>{market.bookmaker}</span>
                      <span>{market.marketPeriod} · {market.inRunning ? 'In-play' : 'Pre-match'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {market.selections.map((sel) => (
                        <div
                          key={sel.name}
                          className="rounded-lg bg-[var(--bg)] p-3 text-center"
                        >
                          <p className="text-xs text-[var(--muted)]">{sel.name}</p>
                          <p className="font-display-var text-2xl text-[var(--gold)]">
                            {sel.pct != null ? `${sel.pct.toFixed(1)}%` : '—'}
                          </p>
                          {sel.price != null && (
                            <p className="text-[10px] text-[var(--muted)]">{sel.price}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'events' && (
          <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
            <h2 className="mb-4 text-xs font-mono-var uppercase tracking-[0.2em] text-[var(--muted)]">
              Live events
            </h2>
            {scoreEvents.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No events yet — the match may be about to kick off.</p>
            ) : (
              <div className="space-y-3">
                {scoreEvents.map((event) => (
                  <div
                    key={event.seq}
                    className="flex items-center gap-4 border-b border-[var(--hairline)] pb-3 last:border-0"
                  >
                    <span className="w-10 text-sm text-[var(--gold)]">{event.minute}</span>
                    <span className="text-sm">{event.action}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'stats' && (
          <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
            <h2 className="mb-4 text-xs font-mono-var uppercase tracking-[0.2em] text-[var(--muted)]">
              Match stats
            </h2>
            {matchStats.stats && Object.keys(matchStats.stats).length > 0 ? (
              <MatchStatsDisplay stats={matchStats} homeTeam={homeTeam} awayTeam={awayTeam} />
            ) : (
              <p className="text-sm text-[var(--muted)]">Stats will appear once live coverage begins.</p>
            )}
          </section>
        )}

        {tab === 'lineups' && (
          <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
            <h2 className="mb-4 text-xs font-mono-var uppercase tracking-[0.2em] text-[var(--muted)]">
              Lineups
            </h2>
            {lineups.home.length > 0 || lineups.away.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <LineupsDisplay title={homeTeam} players={lineups.home} />
                <LineupsDisplay title={awayTeam} players={lineups.away} />
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Lineups not available yet.</p>
            )}
          </section>
        )}

        {tab === 'chat' && (
          <section className="flex h-[min(70vh,560px)] flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--surface)]">
            <div className="border-b border-[var(--hairline)] px-5 py-3">
              <h2 className="text-xs font-mono-var uppercase tracking-[0.2em] text-[var(--muted)]">
                Ask about the match
              </h2>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    msg.role === 'user'
                      ? 'ml-auto bg-[var(--gold)] text-[var(--bg)]'
                      : 'mr-auto border border-[var(--hairline)] bg-[var(--surface-raised)]'
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <p className="text-sm text-[var(--muted)]">Thinking…</p>
              )}
              <div ref={chatEndRef} />
            </div>
            <form
              className="flex gap-2 border-t border-[var(--hairline)] p-4"
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Who's winning? What just happened?"
                className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--bg)] px-4 py-3 text-sm outline-none focus:border-[var(--gold)]"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-medium text-[var(--bg)] disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

function MatchStatsDisplay({
  stats,
  homeTeam,
  awayTeam,
}: {
  stats: { possession?: number; possessionType?: string; stats?: Record<string, number> };
  homeTeam: string;
  awayTeam: string;
}) {
  const statKeys = Object.keys(stats.stats || {}).slice(0, 8);

  return (
    <div className="space-y-6">
      {stats.possession !== undefined && (
        <div>
          <div className="mb-2 flex justify-between text-xs text-[var(--muted)]">
            <span>{homeTeam}</span>
            <span>{awayTeam}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--hairline)]">
            <div
              className="h-full rounded-full bg-[var(--gold)] transition-all"
              style={{ width: `${stats.possession}%` }}
            />
          </div>
          <p className="mt-2 text-center text-xs text-[var(--muted)]">
            {homeTeam} {stats.possession}% possession
            {stats.possessionType ? ` · ${stats.possessionType}` : ''}
          </p>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {statKeys.map((key) => (
          <div key={key} className="flex justify-between border-b border-[var(--hairline)] py-2 text-sm">
            <span className="text-[var(--muted)]">{key}</span>
            <span className="font-mono-var">{stats.stats?.[key] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineupsDisplay({
  title,
  players,
}: {
  title: string;
  players: Array<{
    fixturePlayerId: number;
    rosterNumber: string;
    starter: boolean;
    player: { preferredName: string };
  }>;
}) {
  const starters = players.filter((p) => p.starter);
  const subs = players.filter((p) => !p.starter);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-[var(--gold)]">{title}</h3>
      <div className="space-y-2">
        {starters.map((player) => (
          <div key={player.fixturePlayerId} className="flex items-center gap-3 text-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gold-dim)] text-xs text-[var(--gold)]">
              {player.rosterNumber}
            </span>
            <span>{player.player.preferredName}</span>
          </div>
        ))}
      </div>
      {subs.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-xs uppercase tracking-wider text-[var(--muted)]">Subs</p>
          <div className="space-y-2">
            {subs.map((player) => (
              <div key={player.fixturePlayerId} className="flex items-center gap-3 text-sm text-[var(--muted)]">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--hairline)] font-mono-var text-xs">
                  {player.rosterNumber}
                </span>
                <span>{player.player.preferredName}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OddsBar({
  homeTeam,
  awayTeam,
  probs,
}: {
  homeTeam: string;
  awayTeam: string;
  probs: { home: number; draw: number; away: number };
}) {
  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--hairline)]">
        <div className="bg-[var(--gold)] transition-all" style={{ width: `${probs.home}%` }} />
        <div className="bg-[var(--muted)] transition-all" style={{ width: `${probs.draw}%` }} />
        <div className="bg-[var(--surface-raised)] transition-all" style={{ width: `${probs.away}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <ProbBadge label={homeTeam} value={probs.home} />
        <ProbBadge label="DRAW" value={probs.draw} muted />
        <ProbBadge label={awayTeam} value={probs.away} />
      </div>
    </div>
  );
}

function ProbBadge({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2">
      <span
        className={`font-display-var text-2xl ${muted ? 'text-[var(--muted)]' : 'text-[var(--gold)]'}`}
      >
        {value.toFixed(1)}%
      </span>
      <span className="max-w-[90px] truncate text-center text-[10px] uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
    </div>
  );
}

function FeedCard({ entry }: { entry: FeedEntry }) {
  return (
    <article className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)] p-4">
      <div className="mb-2 text-[11px] font-mono-var uppercase tracking-wider text-[var(--muted)]">
        {entry.time}
      </div>
      <p className="mb-3 text-base leading-7">{entry.narrative.matchPulse}</p>
      <p className="mb-2 text-sm leading-6 text-[var(--muted)]">
        <span className="text-[var(--gold)]">Why it matters — </span>
        {entry.narrative.whyItMatters}
      </p>
      <p className="text-sm leading-6 text-[var(--muted)]">
        <span>What if — </span>
        {entry.narrative.whatIf}
      </p>
    </article>
  );
}
