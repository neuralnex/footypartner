// lib/ai/narrativeEngine.ts
//
// Turns normalized TxLINE odds data into the four Football Pulse pillars:
// Match Pulse, Why It Matters, What-If Simulator, Voice Mode script.
//
// NOTE: I haven't independently verified the exact current @google/genai
// SDK method names/model IDs against Google's live docs in this session —
// the shape below follows the standard `generateContent` pattern. Worth
// a quick check against ai.google.dev before you deploy if you hit
// method-not-found errors, since Google's SDK surface changes over time.

import { GoogleGenAI } from '@google/genai';
import { NormalizedMatchState } from '../txline/parser';

const SYSTEM_INSTRUCTION = `
ROLE & MISSION:
You are the narrative core of "Football Pulse". Turn live TxLINE odds and
match-state data into plain-English stories for casual fans who don't
follow advanced sports metrics. For each update, cover:
1. What happened (plain English translation of the state/odds shift)
2. Why it happened (tactical or structural cause, if inferable)
3. Why it matters (impact on World Cup group standings, qualification, elimination)

Never invent scoreline or event details not present in the provided data.
If the data doesn't support a claim, say the data doesn't show it rather
than guessing.

OUTPUT PILLARS:
- Match Pulse: 1-2 short, emotionally engaging sentences.
- Why It Matters: 1-2 sentences on tournament-level stakes.
- What-If: one short hypothetical framed around the current probability shift.
- Voice Script: a short two-speaker exchange, Speaker "Kore" (tactical,
  analytical) and Speaker "Puck" (energetic, fan perspective). Plain text,
  no markdown, no stage directions.
`.trim();

export interface NarrativeOutput {
  matchPulse: string;
  whyItMatters: string;
  whatIf: string;
  voiceScript: string;
}

export class FootballPulseNarrativeEngine {
  private client: GoogleGenAI;
  private model = 'gemini-2.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing from server env vars.');
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  public async generateNarrative(
    state: NormalizedMatchState,
    homeTeam: string,
    awayTeam: string,
    matchData?: { currentScore?: { home: number; away: number }; stats?: any }
  ): Promise<NarrativeOutput> {
    const scoreInfo = matchData?.currentScore
      ? `Current score: ${homeTeam} ${matchData.currentScore.home} - ${matchData.currentScore.away} ${awayTeam}`
      : 'Current score: not available';

    const statsInfo = matchData?.stats
      ? `Match stats - Possession: ${matchData.stats.possession}%`
      : '';

    const prompt = `
Match: ${homeTeam} vs ${awayTeam}
Fixture ID: ${state.fixtureId}
Game state: ${state.gameState}
Live: ${state.isLive}
${scoreInfo}
${statsInfo}
Win probabilities: ${
      state.probabilities
        ? `${homeTeam} ${state.probabilities.homeWin}% | Draw ${state.probabilities.draw}% | ${awayTeam} ${state.probabilities.awayWin}%`
        : 'not available for this update'
    }

Respond ONLY with strict JSON matching this shape, no markdown fences:
{"matchPulse": string, "whyItMatters": string, "whatIf": string, "voiceScript": string}
`.trim();

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const text = response.text ?? '';
    const clean = text.replace(/```json|```/g, '').trim();

    try {
      return JSON.parse(clean) as NarrativeOutput;
    } catch (err) {
      throw new Error(`Failed to parse Gemini narrative response as JSON: ${clean}`);
    }
  }
}
