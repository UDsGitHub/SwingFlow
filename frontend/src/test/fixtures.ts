import { TradeSetup } from '../types';

export function makeSetup(overrides: Partial<TradeSetup> = {}): TradeSetup {
  return {
    id: 'setup-1',
    symbol: 'AXP',
    strategy: 'REVERSAL',
    direction: 'LONG',
    entry: 98.35,
    stop: 93.94,
    target: 109.37,
    confidence: 75,
    riskReward: 2.5,
    detectedAt: Date.parse('2026-10-23T20:35:00Z'),
    status: 'ACTIVE',
    notes: 'AXP oversold (RSI 33) with bullish candle at support.',
    stockSuggestion: { shares: 17, capitalRequired: 1671.95, riskDollars: 75, potentialGainDollars: 187.34 },
    optionsSuggestion: null,
    exitPrice: null,
    realizedPnl: null,
    closedAt: null,
    entryHitAt: null,
    stopHitAt: null,
    targetHitAt: null,
    pnlEstimate: null,
    score: 80,
    rank: 1,
    entryInstruction: 'WAIT for break above 98.35',
    invalidationInstruction: 'INVALID if price drops below 93.94',
    targetInstruction: 'TAKE profit near 109.37 or trail into strength',
    ...overrides,
  };
}
