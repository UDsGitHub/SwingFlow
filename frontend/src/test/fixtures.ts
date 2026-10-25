import { GoalFeasibility, GoalStatus, Trade, TradeSetup } from '../types';

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
    signalDate: '2026-10-23',
    exitPlan: { maxHoldDays: 40, targetR: null, trailAtrMult: 3 },
    atrAtSignal: 2.1,
    currentStop: 93.94,
    entryHitAt: null,
    paperFillPrice: null,
    paperFillDate: null,
    paperExitPrice: null,
    paperExitDate: null,
    paperExitReason: null,
    paperR: null,
    sessionsHeld: 0,
    managedThrough: null,
    dismissedAt: null,
    score: 80,
    expectedValue: 17.6,
    rank: 1,
    entryInstruction: 'WAIT for break above 98.35',
    invalidationInstruction: 'INVALID if price drops below 93.94',
    targetInstruction: 'NO fixed target — trail the stop 3× ATR below the highest high; exit after 40 sessions at most',
    ...overrides,
  };
}

export function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'trade-1',
    setupId: 'setup-1',
    symbol: 'AXP',
    direction: 'LONG',
    entryPrice: 98.4,
    shares: 17,
    stopPrice: 93.94,
    status: 'OPEN',
    openedAt: Date.parse('2026-10-26T15:00:00Z'),
    exitPrice: null,
    closedAt: null,
    realizedPnl: null,
    notes: null,
    suggestedStop: 93.94,
    strategy: 'REVERSAL',
    ...overrides,
  };
}

export function makeFeasibility(overrides: Partial<GoalFeasibility> = {}): GoalFeasibility {
  return {
    verdict: 'UNREALISTIC',
    expectedPerPeriod: 10.1,
    medianPerPeriod: 0,
    hitRate: 3.2,
    periodsSampled: 196,
    annualReturnPct: 10.5,
    worstDrawdown: 1131,
    tradesPerWeek: 0.6,
    edge: {
      source: 'BACKTEST',
      expectancyR: 0.23,
      backtest: { expectancyR: 0.23, closedTrades: 816, from: '2023-01-03', to: '2026-10-23' },
      paper: { closed: 0, expectancyR: null },
      paperMinTrades: 30,
    },
    suggestions: {
      riskPercent: null,
      bestWithinCeiling: { riskPercent: 1.5, expectedPerPeriod: 10.1 },
      accountSize: 49500,
      goalAmount: 10,
      goalPeriod: 'MONTHLY',
    },
    ...overrides,
  };
}

export function makeGoal(overrides: Partial<GoalStatus> = {}): GoalStatus {
  return {
    goalAmount: 100,
    goalPeriod: 'WEEKLY',
    accountSize: 5000,
    riskPercent: 1.5,
    maxRiskPercent: 2,
    draft: false,
    progress: { periodStart: '2026-10-19', realizedPnl: 0 },
    feasibility: makeFeasibility(),
    ...overrides,
  };
}
