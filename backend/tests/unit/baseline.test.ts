import { describe, expect, it } from 'vitest';
import { buildBaseline, periodReturns, resizeTrade } from '../../src/backtest/baseline';
import { BacktestTrade } from '../../src/backtest/simulate';

let seq = 0;
const closed = (r: number, fillDate: string, exitDate: string, extra: Partial<BacktestTrade> = {}): BacktestTrade => ({
  symbol: `S${seq++}`, strategy: 'REVERSAL', regime: 'RANGING', allowedByRegime: true, inUngated: true, inGated: true,
  confidence: 70, score: 70, signalDate: fillDate, entry: 100, stop: 95, target: 110,
  outcome: r > 0 ? 'TARGET' : 'STOP', fillDate, fillPrice: 100, exitDate, exitPrice: 100 + 5 * r, holdDays: 3,
  shares: 15, rMultiple: r, pnl: 75 * r, ...extra,
});

// Mon 2025-01-06 … Fri 2025-02-28: 40 trading days (no holidays modelled).
const DATES = Array.from({ length: 60 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 0, 6 + i));
  return d.toISOString().slice(0, 10);
}).filter(d => ![0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()) && d <= '2025-02-28');
const portfolio = { accountSize: 5000, maxPositions: 5, rank: () => 0 };

describe('resizeTrade', () => {
  it('sizes from the risk budget, capped by buying power', () => {
    expect(resizeTrade(closed(1, '2025-01-07', '2025-01-10'), 5000, 1)).toMatchObject({ shares: 10, pnl: 50 });
    // 5% of $5k / $5 risk = 50 shares, but only 50 × $100 = $5k fits → 50; 10% would want 100.
    expect(resizeTrade(closed(1, '2025-01-07', '2025-01-10'), 5000, 10).shares).toBe(50);
  });

  it('leaves unfilled trades alone', () => {
    const t = { ...closed(1, '2025-01-07', '2025-01-10'), fillPrice: undefined };
    expect(resizeTrade(t, 5000, 2)).toBe(t);
  });
});

describe('periodReturns', () => {
  const trades = [closed(1, '2025-01-07', '2025-01-08'), closed(-1, '2025-01-14', '2025-01-15'), closed(2, '2025-01-14', '2025-01-16')];

  it('buckets P&L by exit day, including zero days, as a fraction of the account', () => {
    const daily = periodReturns(trades, DATES, 5000, 'DAILY');
    expect(daily).toHaveLength(DATES.length);
    expect(daily[DATES.indexOf('2025-01-08')]).toBeCloseTo(0.015);
    expect(daily.reduce((a, b) => a + b, 0)).toBeCloseTo(150 / 5000);
  });

  it('drops the first and last (partial) week and month', () => {
    const weekly = periodReturns(trades, DATES, 5000, 'WEEKLY');
    expect(weekly).toHaveLength(6); // 8 weeks, minus the edges
    expect(weekly[0]).toBeCloseTo(75 / 5000); // week of Jan 13: −75 + 150
    expect(periodReturns(trades, DATES, 5000, 'MONTHLY')).toHaveLength(0);
  });
});

describe('buildBaseline', () => {
  const trades = [
    closed(2, '2025-01-07', '2025-01-15'), closed(-1, '2025-01-21', '2025-01-23'),
    closed(1, '2025-02-03', '2025-02-05'), closed(-1, '2025-02-10', '2025-02-12'),
  ];
  const build = (seed = 1) => buildBaseline(trades, DATES, portfolio, { provider: 'test', symbols: 4, strategies: ['REVERSAL'] }, { riskGrid: [1, 2], runs: 50, seed });

  it('reports the stream edge and one distribution per risk level and period', () => {
    const b = build();
    expect(b).toMatchObject({ closedTrades: 4, expectancyR: 0.25, winRate: 50, source: { from: '2025-01-06', to: '2025-02-28', tradingDays: 40, runs: 50 } });
    expect(b.tradesPerWeek).toBeCloseTo(4 / 8);
    expect(b.grid.map(g => g.riskPercent)).toEqual([1, 2]);
    for (const g of b.grid) {
      expect(g.periods.WEEKLY.quantiles).toHaveLength(101);
      expect(g.periods.WEEKLY.periods).toBe(6);
      expect(g.periods.DAILY.periods).toBe(40);
    }
  });

  it('averages outcomes drawn from the stream, so mean P&L tracks expectancy × risk', () => {
    const b = buildBaseline(trades, DATES, portfolio, { provider: 'test', symbols: 4, strategies: ['REVERSAL'] }, { riskGrid: [1], runs: 2000 });
    // 4 trades × 0.25R × $50 risk over 40 days.
    expect(b.grid[0].periods.DAILY.mean * 5000 * 40).toBeCloseTo(4 * 0.25 * 50, -1);
  });

  it('is reproducible for a seed', () => {
    expect(build(7).grid).toEqual(build(7).grid);
  });
});
