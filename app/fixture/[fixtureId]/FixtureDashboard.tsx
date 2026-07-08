'use client';

import { useEffect, useRef, useState } from 'react';

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
  voiceScript: string;
}

interface FeedEntry {
  id: number;
  time: string;
  narrative: NarrativeOutput;
}

interface ScoreEvent {
  id: number;
  time: string;
  action: string;
  fixtureId: number;
}

interface CurrentScore {
  home: number;
  away: number;
  homeYellows?: number;
  awayYellows?: number;
  homeReds?: number;
  awayReds?: number;
  homeCorners?: number;
  awayCorners?: number;
}

interface MatchStats {
  possession?: number;
  possessionType?: string;
  stats?: Record<string, number>;
}

interface Player {
  fixturePlayerId: number;
  rosterNumber: string;
  starter: boolean;
  player: { preferredName: string; country?: string };
}

interface HeadToHeadRecord {
  homeWins: number;
  awayWins: number;
  draws: number;
}

const MAX_POINTS = 40;
const MAX_FEED = 12;

export default function FixtureDashboard({
  fixtureId,
  homeTeam,
  awayTeam,
}: {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
}) {
  const [history, setHistory] = useState<ProbabilityPoint[]>([]);
  const [gameState, setGameState] = useState('CONNECTING');
  const [isLive, setIsLive] = useState(false);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [currentScore, setCurrentScore] = useState<CurrentScore>({ home: 0, away: 0 });
  const [matchStats, setMatchStats] = useState<MatchStats>({});
  const [lineups, setLineups] = useState<{ home: Player[]; away: Player[] }>({ home: [], away: [] });
  const [h2h, setH2h] = useState<HeadToHeadRecord>({ homeWins: 0, awayWins: 0, draws: 0 });
  const [scoreHistory, setScoreHistory] = useState<Array<{ time: string; score: string }>>([]);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const feedIdRef = useRef(0);
  const scoreIdRef = useRef(0);

  useEffect(() => {
    // Fetch head-to-head data on mount
    const fetchH2H = async () => {
      try {
        const res = await fetch(`/api/fixtures/${fixtureId}/h2h`);
        if (res.ok) {
          const data = await res.json();
          setH2h({
            homeWins: data.homeWins,
            awayWins: data.awayWins,
            draws: data.draws,
          });
        }
      } catch (err) {
        console.warn('[dashboard] h2h fetch failed:', err);
      }
    };

    fetchH2H();
  }, [fixtureId]);

  useEffect(() => {
    const fetchScoreSnapshot = async () => {
      try {
        const res = await fetch(`/api/scores/snapshot?fixtureId=${fixtureId}`);
        if (!res.ok) {
          throw new Error('Snapshot fetch failed');
        }
        const data = await res.json();
        const latest = Array.isArray(data) && data.length > 0 ? data[data.length - 1] : null;

        if (latest?.scoreSoccer) {
          setCurrentScore({
            home: latest.scoreSoccer.Participant1.Total?.Goals ?? 0,
            away: latest.scoreSoccer.Participant2.Total?.Goals ?? 0,
            homeYellows: latest.scoreSoccer.Participant1.Total?.YellowCards ?? 0,
            awayYellows: latest.scoreSoccer.Participant2.Total?.YellowCards ?? 0,
            homeReds: latest.scoreSoccer.Participant1.Total?.RedCards ?? 0,
            awayReds: latest.scoreSoccer.Participant2.Total?.RedCards ?? 0,
            homeCorners: latest.scoreSoccer.Participant1.Total?.Corners ?? 0,
            awayCorners: latest.scoreSoccer.Participant2.Total?.Corners ?? 0,
          });
        }

        if (latest) {
          setGameState(latest.gameState ?? 'PREMATCH');
          setIsLive(latest.gameState === 'LIVE' || latest.gameState === 'IN_PLAY');
          if (latest.stats) {
            setMatchStats({
              possession: latest.possession,
              possessionType: latest.possessionType,
              stats: latest.stats,
            });
          }
        }
      } catch (err) {
        console.warn('[dashboard] score snapshot failed:', err);
      }
    };

    const fetchScoreHistory = async () => {
      try {
        const res = await fetch(`/api/scores/historical?fixtureId=${fixtureId}`);
        if (!res.ok) {
          throw new Error('History fetch failed');
        }
        const data = await res.json();
        let historyData: Array<{ time: string; score: string }> = [];

        if (Array.isArray(data) && data.length > 0) {
          historyData = data
            .slice(-5)
            .map((item: any) => ({
              time: item.dataSoccer?.Minutes
                ? `${item.dataSoccer.Minutes}'`
                : new Date(item.ts).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Africa/Lagos',
                  }),
              score: `${item.scoreSoccer?.Participant1.Total?.Goals ?? 0} - ${item.scoreSoccer?.Participant2.Total?.Goals ?? 0}`,
            }))
            .reverse();
        }

        if (historyData.length === 0) {
          const fallback = await fetch(`/api/scores/snapshot?fixtureId=${fixtureId}`);
          if (fallback.ok) {
            const fallbackData = await fallback.json();
            if (Array.isArray(fallbackData) && fallbackData.length > 0) {
              const latest = fallbackData[fallbackData.length - 1];
              historyData = [
                {
                  time: latest.dataSoccer?.Minutes
                    ? `${latest.dataSoccer.Minutes}'`
                    : new Date(latest.ts).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Africa/Lagos',
                      }),
                  score: `${latest.scoreSoccer?.Participant1.Total?.Goals ?? 0} - ${latest.scoreSoccer?.Participant2.Total?.Goals ?? 0}`,
                },
              ];
            }
          }
        }

        setScoreHistory(historyData);
      } catch (err) {
        console.warn('[dashboard] score history failed:', err);
      }
    };

    fetchScoreSnapshot();
    fetchScoreHistory();
  }, [fixtureId]);

  useEffect(() => {
    const url = `/api/fixtures/${fixtureId}/stream?home=${encodeURIComponent(
      homeTeam
    )}&away=${encodeURIComponent(awayTeam)}`;
    const source = new EventSource(url);

    source.addEventListener('open', () => setConnection('live'));

    source.addEventListener('odds', (event) => {
      setConnection('live');
      const data = JSON.parse((event as MessageEvent).data);
      setGameState(data.gameState ?? 'LIVE');
      setIsLive(Boolean(data.isLive));
      if (data.probabilities) {
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

    source.addEventListener('scores', (event) => {
      const scoresData = JSON.parse((event as MessageEvent).data);
      if (Array.isArray(scoresData)) {
        const latestScore = scoresData[scoresData.length - 1];
        
        // Update current score
        if (latestScore.scoreSoccer) {
          const homeTotal = latestScore.scoreSoccer.Participant1.Total;
          const awayTotal = latestScore.scoreSoccer.Participant2.Total;
          setCurrentScore({
            home: homeTotal?.Goals ?? 0,
            away: awayTotal?.Goals ?? 0,
            homeYellows: homeTotal?.YellowCards ?? 0,
            awayYellows: awayTotal?.YellowCards ?? 0,
            homeReds: homeTotal?.RedCards ?? 0,
            awayReds: awayTotal?.RedCards ?? 0,
            homeCorners: homeTotal?.Corners ?? 0,
            awayCorners: awayTotal?.Corners ?? 0,
          });
        }

        // Update match stats
        if (latestScore.stats || latestScore.possession) {
          setMatchStats({
            possession: latestScore.possession,
            possessionType: latestScore.possessionType,
            stats: latestScore.stats,
          });
        }

        // Update lineups
        if (latestScore.lineups) {
          const homePlayers: Player[] = [];
          const awayPlayers: Player[] = [];

          latestScore.lineups.forEach((team: any) => {
            team.lineups?.forEach((player: any) => {
              const playerObj: Player = {
                fixturePlayerId: player.fixturePlayerId,
                rosterNumber: player.rosterNumber,
                starter: player.starter,
                player: player.player,
              };
              if (player.starter) {
                homePlayers.push(playerObj);
              } else {
                awayPlayers.push(playerObj);
              }
            });
          });

          if (homePlayers.length > 0 || awayPlayers.length > 0) {
            setLineups({ home: homePlayers, away: awayPlayers });
          }
        }

        // Add score events to feed
        scoresData.forEach((score: any) => {
          scoreIdRef.current += 1;
          const action = score.dataSoccer?.Action || score.action || 'Match Event';
          setScoreEvents((prev) =>
            [
              {
                id: scoreIdRef.current,
                time: new Date().toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Africa/Lagos',
                }),
                action,
                fixtureId: score.fixtureId,
              },
              ...prev,
            ].slice(0, MAX_FEED)
          );
        });
      }
    });

    source.addEventListener('error', () => setConnection('error'));

    return () => source.close();
  }, [fixtureId, homeTeam, awayTeam]);

  const latest = history[history.length - 1];

  const playVoice = async () => {
    setVoiceLoading(true);
    try {
      const url = `/api/fixtures/${fixtureId}/voice?home=${encodeURIComponent(
        homeTeam
      )}&away=${encodeURIComponent(awayTeam)}`;
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
      }
    } finally {
      setVoiceLoading(false);
    }
  };

  return (
    <div style={styles.page} className="min-h-screen px-6 py-8 max-w-[1200px] mx-auto">
      <ScoreBug
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        gameState={gameState}
        isLive={isLive}
        connection={connection}
        currentScore={currentScore}
      />

      {/* Real-Time Score Ticker */}
      <section style={styles.tickerSection} className="bg-[var(--surface)] border-2 border-[var(--pulse)] rounded p-6 mb-6">
        <h2 style={styles.sectionLabel} className="text-[12px] tracking-widest text-[var(--muted)] mb-4">LIVE SCORE</h2>
        <ScoreTicker homeTeam={homeTeam} awayTeam={awayTeam} score={currentScore} />
      </section>

      <div style={styles.grid} className="grid md:grid-cols-[1.6fr,1fr] gap-6">
        <section style={styles.pulseSection} className="bg-[var(--surface)] border border-[var(--hairline)] rounded p-5">
          <h2 style={styles.sectionLabel} className="text-[12px] tracking-widest text-[var(--muted)] mb-4">CHANCE METER</h2>
          <PulseMeter history={history} homeTeam={homeTeam} awayTeam={awayTeam} />
          {history.length > 0 && (
            <div style={styles.probRow}>
              <ProbBadge label={homeTeam} value={history[history.length - 1].home} />
              <ProbBadge label="DRAW" value={history[history.length - 1].draw} muted />
              <ProbBadge label={awayTeam} value={history[history.length - 1].away} />
            </div>
          )}
        </section>

        <section style={styles.feedSection} className="bg-[var(--surface)] border border-[var(--hairline)] rounded p-5 max-h-[520px] overflow-y-auto">
          <h2 style={styles.sectionLabel} className="text-[12px] tracking-widest text-[var(--muted)] mb-4">LIVE NOTES</h2>
          <div style={styles.feedList} className="flex flex-col gap-4">
            {scoreEvents.length === 0 && feed.length === 0 && (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>
                Waiting for the first live match update…
              </p>
            )}
            {scoreEvents.map((event) => (
              <article key={event.id} style={styles.feedCard}>
                <div style={styles.feedTime}>{event.time}</div>
                <p style={styles.feedPulse}>{event.action}</p>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>⚽ LIVE EVENT</span>
              </article>
            ))}
            {feed.map((entry) => (
              <FeedCard key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      </div>

      {/* Match Statistics */}
      {matchStats.stats && Object.keys(matchStats.stats).length > 0 && (
        <section style={styles.statsSection} className="bg-[var(--surface)] border border-[var(--hairline)] rounded p-5 mb-6">
          <h2 style={styles.sectionLabel} className="text-[12px] tracking-widest text-[var(--muted)] mb-4">GAME STATS</h2>
          <MatchStatsDisplay stats={matchStats} homeTeam={homeTeam} awayTeam={awayTeam} />
        </section>
      )}

      {scoreHistory.length > 0 && (
        <section style={styles.statsSection} className="bg-[var(--surface)] border border-[var(--hairline)] rounded p-5 mb-6">
          <h2 style={styles.sectionLabel} className="text-[12px] tracking-widest text-[var(--muted)] mb-4">RECENT SCORE HISTORY</h2>
          <div className="space-y-3">
            {scoreHistory.map((entry, index) => (
              <div key={`${entry.time}-${index}`} className="flex items-center justify-between rounded-2xl border border-[var(--hairline)] bg-black/10 px-4 py-3">
                <span className="text-sm text-[var(--muted)]">{entry.time}</span>
                <span className="font-[var(--font-mono)] text-[var(--pulse)]">{entry.score}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Team Lineups */}
      {(lineups.home.length > 0 || lineups.away.length > 0) && (
        <section style={styles.lineupsSection} className="bg-[var(--surface)] border border-[var(--hairline)] rounded p-5 mb-6">
          <h2 style={styles.sectionLabel} className="text-[12px] tracking-widest text-[var(--muted)] mb-4">TEAM LINEUPS</h2>
          <div style={styles.lineupsGrid} className="grid md:grid-cols-2 gap-6">
            <LineupsDisplay title={`${homeTeam} XI`} players={lineups.home} />
            <LineupsDisplay title={`${awayTeam} XI`} players={lineups.away} />
          </div>
        </section>
      )}

      {/* Head-to-Head */}
      {(h2h.homeWins > 0 || h2h.awayWins > 0 || h2h.draws > 0) && (
        <section style={styles.h2hSection} className="bg-[var(--surface)] border border-[var(--hairline)] rounded p-5 mb-6">
          <h2 style={styles.sectionLabel} className="text-[12px] tracking-widest text-[var(--muted)] mb-4">PAST MEETINGS</h2>
          <H2HDisplay homeTeam={homeTeam} awayTeam={awayTeam} record={h2h} />
        </section>
      )}

      <button
        className="fixed bottom-7 right-8 inline-flex items-center justify-center rounded-full bg-[var(--pulse)] px-5 py-3 text-[var(--floodlight)] font-[var(--font-mono)] text-[13px] tracking-wider shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
        onClick={playVoice}
        disabled={voiceLoading}
        aria-label="Play voice commentary"
      >
        {voiceLoading ? '···' : '● ON AIR'}
      </button>
      <audio ref={audioRef} />
    </div>
  );
}

function ScoreBug({
  homeTeam,
  awayTeam,
  gameState,
  isLive,
  connection,
  currentScore,
}: {
  homeTeam: string;
  awayTeam: string;
  gameState: string;
  isLive: boolean;
  connection: 'connecting' | 'live' | 'error';
  currentScore: CurrentScore;
}) {
  return (
    <header style={styles.scoreBug} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] pb-4 mb-6">
      <div style={styles.matchup}>
        <span style={styles.teamName}>{homeTeam}</span>
        <span style={styles.vs}>vs</span>
        <span style={styles.teamName}>{awayTeam}</span>
      </div>
      <div style={styles.stateBlock}>
        <span
          style={{
            ...styles.liveDot,
            background: isLive ? 'var(--pulse)' : 'var(--muted)',
          }}
        />
        <span style={styles.gameState}>{gameState}</span>
        <span style={{ ...styles.connectionText, color: connectionColor(connection) }}>
          {connection === 'live' ? 'LIVE' : connection === 'error' ? 'RECONNECTING' : 'CONNECTING'}
        </span>
      </div>
    </header>
  );
}

function ScoreTicker({
  homeTeam,
  awayTeam,
  score,
}: {
  homeTeam: string;
  awayTeam: string;
  score: CurrentScore;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 items-center text-center">
      <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
        <span className="block font-[var(--font-display)] text-lg leading-none mb-2">{homeTeam}</span>
        <div className="text-[48px] font-[var(--font-mono)] font-bold text-[var(--pulse)]">{score.home}</div>
        <div className="mt-3 flex justify-center gap-4 text-xs text-[var(--muted)]">
          <span title="Yellow Cards">🟨 {score.homeYellows || 0}</span>
          <span title="Red Cards">🟥 {score.homeReds || 0}</span>
          <span title="Corners">🚩 {score.homeCorners || 0}</span>
        </div>
      </div>

      <div className="text-[var(--muted)] font-[var(--font-mono)] text-xs tracking-[0.28em] uppercase">vs</div>

      <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
        <span className="block font-[var(--font-display)] text-lg leading-none mb-2">{awayTeam}</span>
        <div className="text-[48px] font-[var(--font-mono)] font-bold text-[var(--pulse)]">{score.away}</div>
        <div className="mt-3 flex justify-center gap-4 text-xs text-[var(--muted)]">
          <span title="Yellow Cards">🟨 {score.awayYellows || 0}</span>
          <span title="Red Cards">🟥 {score.awayReds || 0}</span>
          <span title="Corners">🚩 {score.awayCorners || 0}</span>
        </div>
      </div>
    </div>
  );
}

function MatchStatsDisplay({
  stats,
  homeTeam,
  awayTeam,
}: {
  stats: MatchStats;
  homeTeam: string;
  awayTeam: string;
}) {
  const statKeys = Object.keys(stats.stats || {}).slice(0, 6);
  
  return (
    <div className="space-y-6">
      {stats.possession !== undefined && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <span className="text-sm font-[var(--font-mono)] text-[var(--muted)]">{homeTeam} Possession</span>
          <div className="flex-1 h-4 rounded-full bg-[var(--hairline)] overflow-hidden mx-0 md:mx-4">
            <div className="h-full rounded-full bg-[var(--pulse)] transition-all" style={{ width: `${stats.possession}%` }} />
          </div>
          <span className="text-sm font-[var(--font-mono)] text-[var(--muted)]">{stats.possession}%</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {statKeys.map((key) => (
          <div key={key} className="flex items-center justify-between border-b border-[var(--hairline)] pb-2">
            <span className="text-xs font-[var(--font-mono)] text-[var(--muted)] uppercase tracking-[0.16em]">{key}</span>
            <span className="text-sm font-[var(--font-mono)] font-semibold text-[var(--floodlight)]">{stats.stats?.[key] || 0}</span>
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
  players: Player[];
}) {
  return (
    <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-[var(--font-mono)] uppercase tracking-[0.28em] text-[var(--pulse)] mb-4">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        {players.slice(0, 11).map((player) => (
          <div key={player.fixturePlayerId} className="flex items-center gap-3 text-sm text-[var(--floodlight)]">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pulse-dim)] text-[var(--pulse)] font-[var(--font-mono)] text-xs font-semibold">{player.rosterNumber}</span>
            <span>{player.player.preferredName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function H2HDisplay({
  homeTeam,
  awayTeam,
  record,
}: {
  homeTeam: string;
  awayTeam: string;
  record: HeadToHeadRecord;
}) {
  return (
    <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-5">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-[11px] font-[var(--font-mono)] uppercase tracking-[0.28em] text-[var(--muted)] mb-2">{homeTeam} Wins</div>
          <div className="text-3xl font-[var(--font-mono)] font-bold text-[var(--pulse)]">{record.homeWins}</div>
        </div>
        <div>
          <div className="text-[11px] font-[var(--font-mono)] uppercase tracking-[0.28em] text-[var(--muted)] mb-2">Draws</div>
          <div className="text-3xl font-[var(--font-mono)] font-bold text-[var(--floodlight)]">{record.draws}</div>
        </div>
        <div>
          <div className="text-[11px] font-[var(--font-mono)] uppercase tracking-[0.28em] text-[var(--muted)] mb-2">{awayTeam} Wins</div>
          <div className="text-3xl font-[var(--font-mono)] font-bold text-[var(--pulse)]">{record.awayWins}</div>
        </div>
      </div>
    </div>
  );
}

function connectionColor(status: 'connecting' | 'live' | 'error') {
  if (status === 'live') return 'var(--pulse)';
  if (status === 'error') return 'var(--gold)';
  return 'var(--muted)';
}

function PulseMeter({
  history,
  homeTeam,
  awayTeam,
}: {
  history: ProbabilityPoint[];
  homeTeam: string;
  awayTeam: string;
}) {
  const width = 800;
  const height = 220;
  const padding = 16;

  if (history.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-6">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="var(--hairline)"
            strokeWidth={2}
          />
        </svg>
        <p className="text-[13px] text-[var(--muted)]">Waiting for enough data points to draw the pulse…</p>
      </div>
    );
  }

  const toPath = (key: 'home' | 'away') => {
    const step = (width - padding * 2) / (history.length - 1);
    return history
      .map((point, i) => {
        const x = padding + i * step;
        const y = height - padding - (point[key] / 100) * (height - padding * 2);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Win probability over time">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={0}
          x2={width}
          y1={height * f}
          y2={height * f}
          stroke="var(--hairline)"
          strokeWidth={1}
        />
      ))}
      <path d={toPath('away')} fill="none" stroke="var(--muted)" strokeWidth={2} opacity={0.6} />
      <path
        d={toPath('home')}
        fill="none"
        stroke="var(--pulse)"
        strokeWidth={3}
        filter="url(#glow)"
      />
      <text x={padding} y={16} fill="var(--pulse)" fontFamily="var(--font-mono)" fontSize={11}>
        {homeTeam}
      </text>
      <text x={padding} y={height - 4} fill="var(--muted)" fontFamily="var(--font-mono)" fontSize={11}>
        {awayTeam}
      </text>
    </svg>
  );
}

function ProbBadge({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`font-[var(--font-mono)] font-semibold text-2xl ${muted ? 'text-[var(--muted)]' : 'text-[var(--pulse)]'}`}>
        {value.toFixed(0)}%
      </span>
      <span className="text-[11px] text-[var(--muted)] uppercase tracking-[0.22em]">{label}</span>
    </div>
  );
}

function FeedCard({ entry }: { entry: FeedEntry }) {
  return (
    <article className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
      <div className="text-[11px] font-[var(--font-mono)] uppercase tracking-[0.25em] text-[var(--muted)] mb-3">{entry.time}</div>
      <p className="text-base leading-7 text-[var(--floodlight)] mb-3">{entry.narrative.matchPulse}</p>
      <p className="text-sm leading-6 text-[var(--muted)] mb-2">
        <span className="text-[var(--gold)]">WHY IT MATTERS — </span>
        {entry.narrative.whyItMatters}
      </p>
      <p className="text-sm leading-6 text-[var(--muted)]">
        <span className="text-[var(--muted)]">WHAT IF — </span>
        {entry.narrative.whatIf}
      </p>
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    padding: '24px 32px 96px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  scoreBug: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--hairline)',
    paddingBottom: 16,
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  matchup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
  },
  teamName: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    letterSpacing: 0.5,
  },
  vs: {
    color: 'var(--muted)',
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
  },
  stateBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  },
  gameState: {
    color: 'var(--floodlight)',
  },
  connectionText: {
    borderLeft: '1px solid var(--hairline)',
    paddingLeft: 10,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 1fr)',
    gap: 24,
  },
  pulseSection: {
    background: 'var(--surface)',
    border: '1px solid var(--hairline)',
    borderRadius: 4,
    padding: 20,
  },
  feedSection: {
    background: 'var(--surface)',
    border: '1px solid var(--hairline)',
    borderRadius: 4,
    padding: 20,
    maxHeight: 520,
    overflowY: 'auto',
  },
  sectionLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: 2,
    color: 'var(--muted)',
    margin: '0 0 16px',
  },
  pulsePlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  probRow: {
    display: 'flex',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  probBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  probValue: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    fontSize: 22,
  },
  probLabel: {
    fontSize: 11,
    color: 'var(--muted)',
    marginTop: 2,
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  feedCard: {
    borderLeft: '2px solid var(--pulse-dim)',
    paddingLeft: 12,
  },
  feedTime: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--muted)',
    marginBottom: 4,
  },
  feedPulse: {
    margin: '0 0 6px',
    fontSize: 14,
    lineHeight: 1.4,
  },
  feedWhy: {
    margin: '0 0 4px',
    fontSize: 12,
    color: 'var(--muted)',
    lineHeight: 1.4,
  },
  feedWhatIf: {
    margin: 0,
    fontSize: 12,
    color: 'var(--muted)',
    lineHeight: 1.4,
  },
  voiceButton: {
    position: 'fixed',
    bottom: 28,
    right: 32,
    background: 'var(--pulse)',
    color: 'var(--floodlight)',
    border: 'none',
    borderRadius: 999,
    padding: '14px 22px',
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    letterSpacing: 1,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(255, 68, 51, 0.35)',
  },
  tickerSection: {
    background: 'var(--surface)',
    border: '2px solid var(--pulse)',
    borderRadius: 4,
    padding: 24,
    marginBottom: 24,
  },
  scoreTickerContainer: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 24,
  },
  scoreTickerTeam: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  tickerTeamName: {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  tickerScore: {
    fontFamily: 'var(--font-mono)',
    fontSize: 48,
    fontWeight: 700,
    color: 'var(--pulse)',
  },
  tickerStats: {
    display: 'flex',
    gap: 16,
    fontSize: 12,
    color: 'var(--muted)',
  },
  scoreTickerVs: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: 1,
    color: 'var(--muted)',
  },
  statsSection: {
    background: 'var(--surface)',
    border: '1px solid var(--hairline)',
    borderRadius: 4,
    padding: 20,
    marginBottom: 24,
  },
  statsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  possessionBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  barBg: {
    flex: 1,
    height: 24,
    background: 'var(--hairline)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    transition: 'width 0.3s ease',
  },
  statLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--muted)',
    minWidth: 80,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: 12,
  },
  statItem: {
    display: 'flex',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--hairline)',
    paddingBottom: 8,
  },
  statKey: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--muted)',
  },
  statValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    fontWeight: 700,
  },
  lineupsSection: {
    background: 'var(--surface)',
    border: '1px solid var(--hairline)',
    borderRadius: 4,
    padding: 20,
    marginBottom: 24,
  },
  lineupsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 24,
  },
  lineupCard: {
    background: 'var(--background)',
    border: '1px solid var(--hairline)',
    borderRadius: 4,
    padding: 16,
  },
  lineupTitle: {
    fontFamily: 'var(--font-mono)',
    fontSize: 13,
    letterSpacing: 1,
    margin: '0 0 12px',
    color: 'var(--pulse)',
  },
  playersList: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  playerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
  },
  playerNumber: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    background: 'var(--pulse-dim)',
    color: 'var(--pulse)',
    width: 24,
    height: 24,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  playerName: {
    fontSize: 11,
  },
  h2hSection: {
    background: 'var(--surface)',
    border: '1px solid var(--hairline)',
    borderRadius: 4,
    padding: 20,
    marginBottom: 24,
  },
  h2hContainer: {
    display: 'flex',
    justifyContent: 'center',
  },
  h2hRecord: {
    display: 'flex',
    gap: 40,
  },
  h2hItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  h2hLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--muted)',
    marginBottom: 8,
  },
  h2hValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: 32,
    fontWeight: 700,
    color: 'var(--pulse)',
  },
};
