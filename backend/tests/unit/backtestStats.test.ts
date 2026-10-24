import { describe, expect, it } from 'vitest';
import { confidenceBucket, groupBy, maxConcurrentPositions, summarize } from '../../src/backtest/stats';
import { simulatePortfolio } from '../../src/backtest/portfolio';
import { BacktestTrade } from '../../src/backtest/simulate';

let seq = 0;
function trade(fields: Partial<BacktestTrade>): BacktestTrade {
  return {
    symbol: `S${seq++}`, strategy: 'REVERSAL', regime: 'RANGING', allowedByRegime: true, inUngated: true, inGated: true,
    confidence: 70, score: 70, signalDate: '2025-01-06', entry: 100, stop: 95, target: 110, outcome: 'TARGET',
    ...fields,
  };
}
const closed = (r: number, exitDate: string, extra: Partial<BacktestTrade> = {}) =>
  trade({ outcome: r > 0 ? 'TARGET' : 'STOP', rMultiple: r, pnl: r * 75, fillDate: '2025-01-07', exitDate, holdDays: 3, shares: 10, fillPrice: 100, ...extra });

describe('summarize', () => {
  it('computes win rate, expectancy, profit factor and P&L from closed trades only', () => {
    const s = summarize([closed(2, '2025-01-10'), closed(-1, '2025-01-11'), closed(-1, '2025-01-12'), trade({ outcome: 'NO_FILL' })]);
    expect(s).toMatchObject({ signals: 4, closed: 3, noFill: 1, targets: 1, stops: 2, totalPnl: 0, profitFactor: 1 });
    expect(s.winRate).toBeCloseTo(33.33, 1);
    expect(s.expectancyR).toBeCloseTo(0);
    expect(s.avgWinR).toBe(2);
    expect(s.avgLossR).toBe(-1);
  });

  it('measures max drawdown on cumulative R in exit-date order', () => {
    // Exit order: +1, −1, −1, +3 → peak 1, trough −1 → drawdown 2
    const s = summarize([closed(3, '2025-01-14'), closed(-1, '2025-01-12'), closed(1, '2025-01-10'), closed(-1, '2025-01-13')]);
    expect(s.maxDrawdownR).toBe(2);
  });

  it('returns nulls when nothing closed', () => {
    expect(summarize([trade({ outcome: 'GAP_SKIP' })])).toMatchObject({ closed: 0, winRate: null, expectancyR: null, profitFactor: null, gapSkip: 1 });
  });
});

describe('grouping helpers', () => {
  it('groups by key in sorted order', () => {
    const g = groupBy([closed(1, '2025-01-10', { strategy: 'REVERSAL' }), closed(-1, '2025-01-10', { strategy: 'BREAKOUT' })], t => t.strategy);
    expect(Object.keys(g)).toEqual(['BREAKOUT', 'REVERSAL']);
  });

  it('buckets confidence', () => {
    expect([65, 70, 85, 95].map(confidenceBucket)).toEqual(['<70', '70-79', '80-89', '90+']);
  });

  it('counts peak concurrent positions, treating same-day exit and entry as overlapping', () => {
    const ts = [
      closed(1, '2025-01-10', { fillDate: '2025-01-07' }),
      closed(1, '2025-01-12', { fillDate: '2025-01-10' }),
      closed(1, '2025-01-09', { fillDate: '2025-01-08' }),
    ];
    expect(maxConcurrentPositions(ts)).toBe(2);
  });
});

describe('simulatePortfolio', () => {
  const pos = (fillDate: string, exitDate: string, cost: number, confidence = 70) =>
    closed(1, exitDate, { fillDate, shares: 1, fillPrice: cost, confidence });

  it('only takes trades that fit in unused capital', () => {
    const taken = simulatePortfolio([pos('2025-01-06', '2025-01-10', 3000), pos('2025-01-07', '2025-01-09', 3000)], {
      accountSize: 5000, maxPositions: 5, rank: t => t.confidence,
    });
    expect(taken).toHaveLength(1);
  });

  it('respects the position-slot limit', () => {
    const taken = simulatePortfolio([1, 2, 3].map(() => pos('2025-01-06', '2025-01-10', 100)), {
      accountSize: 5000, maxPositions: 2, rank: t => t.confidence,
    });
    expect(taken).toHaveLength(2);
  });

  it('releases capital the day after a position exits', () => {
    const base = pos('2025-01-06', '2025-01-08', 4000);
    const sameDay = simulatePortfolio([base, pos('2025-01-08', '2025-01-10', 4000)], { accountSize: 5000, maxPositions: 5, rank: () => 0 });
    const nextDay = simulatePortfolio([base, pos('2025-01-09', '2025-01-10', 4000)], { accountSize: 5000, maxPositions: 5, rank: () => 0 });
    expect(sameDay).toHaveLength(1);
    expect(nextDay).toHaveLength(2);
  });

  it('prefers the higher-ranked setup when several fill the same day', () => {
    const low = pos('2025-01-06', '2025-01-10', 4000, 60);
    const high = pos('2025-01-06', '2025-01-10', 4000, 90);
    expect(simulatePortfolio([low, high], { accountSize: 5000, maxPositions: 5, rank: t => t.confidence })).toEqual([high]);
  });

  it('ignores trades that never filled or closed', () => {
    expect(simulatePortfolio([trade({ outcome: 'NO_FILL' })], { accountSize: 5000, maxPositions: 5, rank: () => 0 })).toEqual([]);
  });
});
