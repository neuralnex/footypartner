"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import PulseMeter from '@/components/PulseMeter';
import NarrativeFeed from '@/components/NarrativeFeed';

interface LiveMatchState {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  score: string;
  clock: string;
  isLive: boolean;
  history: Array<{ minute: number; homePct: number; awayPct: number }>;
}

interface NarrativeUpdate {
  id: string;
  timestamp: string;
  phaseTitle: string;
  content: string;
  scenarios: string[];
}

export default function MatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id ?? searchParams?.get('id');
  const home = searchParams?.get('home') ?? 'Home';
  const away = searchParams?.get('away') ?? 'Away';

  const [state, setState] = useState<LiveMatchState | null>(null);
  const [narratives, setNarratives] = useState<NarrativeUpdate[]>([]);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!id) return;

    const loadSnapshot = async () => {
      try {
        const res = await fetch(`/api/scores/snapshot?fixtureId=${id}`);
        if (!res.ok) throw new Error('Could not load score snapshot');
        const data = await res.json();
        const latest = Array.isArray(data) && data.length > 0 ? data[data.length - 1] : null;

        setState({
          fixtureId: Number(id),
          homeTeam: home,
          awayTeam: away,
          score: latest?.scoreSoccer
            ? `${latest.scoreSoccer.Participant1.Total?.Goals || 0} - ${latest.scoreSoccer.Participant2.Total?.Goals || 0}`
            : '0 - 0',
          clock: latest?.dataSoccer?.Minutes ? `${latest.dataSoccer.Minutes}'` : "0'",
          isLive: latest?.gameState === 'LIVE' || latest?.gameState === 'IN_PLAY' || false,
          history: [],
        });
      } catch (err) {
        console.warn('initial snapshot failed', err);
      }
    };

    loadSnapshot();

    const source = new EventSource(`/api/fixtures/${id}/stream`);
    source.addEventListener('odds', (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        setState((s) => ({
          ...(s ?? {} as LiveMatchState),
          history: d.probabilities
            ? [...(s?.history || []), { minute: Math.floor((Date.now() - (s?.fixtureId || 0)) / 60000), homePct: d.probabilities.homeWin, awayPct: d.probabilities.awayWin }].slice(-120)
            : s?.history || [],
        } as LiveMatchState));
      } catch {
        // ignore malformed messages
      }
    });

    source.addEventListener('narrative', (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data);
        const update: NarrativeUpdate = {
          id: `${Date.now()}`,
          timestamp: new Date().toISOString(),
          phaseTitle: d.matchPulse.substring(0, 36),
          content: d.matchPulse + '\n\n' + d.whyItMatters,
          scenarios: [d.whatIf || 'If things hold?'],
        };
        setNarratives((p) => [update, ...p].slice(0, 40));
      } catch {}
    });

    source.addEventListener('scores', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        const latest = Array.isArray(data) ? data[data.length - 1] : null;
        if (latest?.scoreSoccer) {
          setState((s) => ({
            ...(s ?? {} as LiveMatchState),
            score: `${latest.scoreSoccer.Participant1.Total?.Goals ?? 0} - ${latest.scoreSoccer.Participant2.Total?.Goals ?? 0}`,
            clock: latest.dataSoccer?.Minutes ? `${latest.dataSoccer.Minutes}'` : s?.clock ?? "0'",
            isLive: latest.gameState === 'LIVE' || latest.gameState === 'IN_PLAY' || s?.isLive || false,
          } as LiveMatchState));
        }
      } catch {}
    });

    return () => source.close();
  }, [id]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 p-6">
      <header className="sticky top-0 z-20 bg-neutral-950/80 backdrop-blur-sm border-b border-neutral-800 py-4 px-6 flex items-center justify-between">
        <div>
          <div className="text-sm text-neutral-400">{state?.homeTeam} · {state?.awayTeam}</div>
          <div className="flex items-baseline gap-4">
            <h1 className="text-3xl font-semibold">{state?.score ?? '0 - 0'}</h1>
            <div className="text-sm text-neutral-400">{state?.clock ?? "0'"}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setListening((v) => !v)}
            className={`px-4 py-2 rounded-full font-medium transition-all ${listening ? 'bg-gradient-to-r from-cyan-500 to-pink-500 text-black' : 'bg-neutral-900/50 border border-neutral-800'}`}>
            {listening ? 'Listening' : 'Listen to Match Audio'}
          </button>
        </div>
      </header>

      <main className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <div className="bg-neutral-900/30 p-4 rounded-md border border-neutral-800">
            <PulseMeter history={(state?.history || []) as any} />
          </div>

          <div className="bg-neutral-900/30 p-4 rounded-md border border-neutral-800">
            <h2 className="text-lg font-semibold mb-3">Chronological Narrative</h2>
            <NarrativeFeed updates={narratives} />
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-neutral-900/30 p-4 rounded-md border border-neutral-800">
            <h3 className="font-semibold">Match Snapshot</h3>
            <div className="mt-2 text-sm text-neutral-300">Score: {state?.score}</div>
            <div className="mt-1 text-sm text-neutral-300">Clock: {state?.clock}</div>
          </div>

          <div className="bg-neutral-900/30 p-4 rounded-md border border-neutral-800">
            <h3 className="font-semibold">Quick Scenarios</h3>
            <div className="mt-2 flex flex-col gap-2">
              <button className="px-3 py-2 rounded-md bg-neutral-900/50 border border-neutral-800 text-left">If the home team presses high</button>
              <button className="px-3 py-2 rounded-md bg-neutral-900/50 border border-neutral-800 text-left">If an early substitution changes tempo</button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
