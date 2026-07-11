import { GoogleGenAI } from '@google/genai';
import type { NormalizedMatchState } from '../txline/parser';
import type { ScoreSnapshot } from '../txline/scores';
import { formatMatchEndLabel, formatMatchMinute, scoreFromSnapshot } from '../txline/gameState';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MatchChatContext {
  homeTeam: string;
  awayTeam: string;
  fixtureId: number;
  latestScore?: ScoreSnapshot | null;
  odds?: NormalizedMatchState | null;
  recentEvents?: string[];
}

const SYSTEM_INSTRUCTION = `
You are FootyPartner, a friendly live match companion for casual football fans.
Answer questions about the current match using ONLY the match context provided.
Be concise (2-4 sentences unless the user asks for detail), conversational, and helpful.
Never invent goals, cards, or events not in the context.
If you don't have enough data, say what you do know and what is still updating.
Explain tactics and stakes in plain English — no betting jargon unless the user asks.
`.trim();

export class FootyPartnerChatEngine {
  private client: GoogleGenAI;
  private model = 'gemini-2.5-flash';

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is missing from server env vars.');
    this.client = new GoogleGenAI({ apiKey });
  }

  private buildContextBlock(ctx: MatchChatContext): string {
    const score = scoreFromSnapshot(ctx.latestScore);
    const minute = formatMatchMinute(ctx.latestScore);
    const state = formatMatchEndLabel(ctx.latestScore);

    const scoreLine = score
      ? `Score: ${ctx.homeTeam} ${score.home} - ${score.away} ${ctx.awayTeam}`
      : 'Score: not available yet';

    const probs = ctx.odds?.probabilities
      ? `Win chance — ${ctx.homeTeam} ${ctx.odds.probabilities.homeWin}%, Draw ${ctx.odds.probabilities.draw}%, ${ctx.awayTeam} ${ctx.odds.probabilities.awayWin}%`
      : 'Win probabilities: not available yet';

    const events =
      ctx.recentEvents && ctx.recentEvents.length > 0
        ? `Recent events:\n${ctx.recentEvents.map((e) => `- ${e}`).join('\n')}`
        : 'Recent events: none logged yet';

    return `
Match: ${ctx.homeTeam} vs ${ctx.awayTeam}
Fixture ID: ${ctx.fixtureId}
${scoreLine}
Minute / phase: ${minute || 'pending'}${state ? ` (${state})` : ''}
${probs}
${events}
`.trim();
  }

  async reply(messages: ChatMessage[], ctx: MatchChatContext): Promise<string> {
    const contextBlock = this.buildContextBlock(ctx);
    const history = messages
      .slice(-10)
      .map((m) => `${m.role === 'user' ? 'Fan' : 'FootyPartner'}: ${m.content}`)
      .join('\n');

    const prompt = `
MATCH CONTEXT (authoritative — do not contradict):
${contextBlock}

CONVERSATION:
${history}

Respond as FootyPartner to the Fan's latest message. Plain text only, no JSON.
`.trim();

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    return (response.text ?? '').trim() || "I'm still syncing live data — try again in a moment.";
  }
}
