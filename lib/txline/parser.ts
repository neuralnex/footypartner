// lib/txline/parser.ts
//
// UNVERIFIED SCHEMA WARNING: field names below (PriceNames, Pct, GameState)
// are carried over from the original draft and haven't been confirmed
// against the live API Reference response for /api/odds/updates/{fixtureId}.
// The IDL's on-chain `Odds` type uses price_names + integer prices, which
// doesn't match 1:1 — treat this as a best-effort adapter and verify
// against a real response before shipping.

export interface RawOddsPayload {
  FixtureId: number;
  Ts: number;
  GameState?: string;
  InRunning: boolean;
  PriceNames?: string[];
  Pct?: string[];
}

export interface NormalizedMatchState {
  fixtureId: number;
  timestamp: number;
  gameState: string;
  isLive: boolean;
  probabilities: {
    homeWin: number;
    draw: number;
    awayWin: number;
  } | null;
}

export class TxLineDataParser {
  public static parseLiveOdds(payloads: RawOddsPayload[]): NormalizedMatchState {
    if (!payloads || payloads.length === 0) {
      throw new Error('Empty odds payload — nothing to parse.');
    }

    const mainMarket =
      payloads.find(p => p.PriceNames?.includes('1') && p.PriceNames?.includes('2')) ??
      payloads[0];

    let probabilities: NormalizedMatchState['probabilities'] = null;

    if (mainMarket.PriceNames && mainMarket.Pct) {
      const homeIdx = mainMarket.PriceNames.indexOf('1');
      const drawIdx = mainMarket.PriceNames.indexOf('X');
      const awayIdx = mainMarket.PriceNames.indexOf('2');

      const safeParseFloat = (val: string | undefined): number => {
        if (!val || val === 'NA') return 0.0;
        const parsed = parseFloat(val);
        return Number.isFinite(parsed) ? parsed : 0.0;
      };

      probabilities = {
        homeWin: homeIdx !== -1 ? safeParseFloat(mainMarket.Pct[homeIdx]) : 0,
        draw: drawIdx !== -1 ? safeParseFloat(mainMarket.Pct[drawIdx]) : 0,
        awayWin: awayIdx !== -1 ? safeParseFloat(mainMarket.Pct[awayIdx]) : 0,
      };
    }

    const gameState = (mainMarket.GameState || 'PRE_MATCH').toUpperCase();
    const finishedStates = new Set([
      'F',
      'FET',
      'FPE',
      'A',
      'C',
      'TXCC',
      'TXCS',
      'P',
    ]);
    const activeStates = new Set([
      'H1',
      'HT',
      'H2',
      'WET',
      'ET1',
      'HTET',
      'ET2',
      'WPE',
      'PE',
      'LIVE',
    ]);

    const isLive = finishedStates.has(gameState)
      ? false
      : mainMarket.InRunning || activeStates.has(gameState);

    return {
      fixtureId: mainMarket.FixtureId,
      timestamp: mainMarket.Ts,
      gameState: mainMarket.GameState || 'PRE_MATCH',
      isLive,
      probabilities,
    };
  }
}
