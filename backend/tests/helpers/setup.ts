import { TradeSetup } from '../../src/types';

export function makeSetup(overrides: Partial<TradeSetup> = {}): TradeSetup {
  return {
    id: `id-${overrides.symbol ?? 'AXP'}`, symbol: 'AXP', strategy: 'REVERSAL', direction: 'LONG',
    entry: 100, stop: 95, target: 112.5, confidence: 75, riskReward: 2.5, detectedAt: 0, signalDate: '2026-10-23',
    status: 'ACTIVE', notes: '',
    stockSuggestion: { shares: 15, capitalRequired: 1500, riskDollars: 75, potentialGainDollars: 187.5 },
    optionsSuggestion: null, exitPlan: { maxHoldDays: 40, targetR: null, trailAtrMult: 3 }, atrAtSignal: 2,
    currentStop: 95, entryHitAt: null, paperFillPrice: null, paperFillDate: null, paperExitPrice: null,
    paperExitDate: null, paperExitReason: null, paperR: null, sessionsHeld: 0, managedThrough: null,
    dismissedAt: null, score: 80, rank: null, entryInstruction: '', invalidationInstruction: '', targetInstruction: '',
    ...overrides,
  };
}
