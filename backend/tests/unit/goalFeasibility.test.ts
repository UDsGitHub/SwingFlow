import { describe, expect, it } from 'vitest';
import { assessGoal, shareAtOrAbove, verdictFor } from '../../src/trading/goalFeasibility';
import type { EdgeBaseline, RiskGridPoint } from '../../src/backtest/baseline';
import { EDGE_BASELINE, byExpectedValue, expectedValue } from '../../src/config/edgeBaseline';
import { GoalInput } from '../../src/trading/goalFeasibility';

/** Percentiles spread evenly from lo to hi (mean = midpoint). */
const linear = (lo: number, hi: number) => Array.from({ length: 101 }, (_, i) => lo + ((hi - lo) * i) / 100);

function point(riskPercent: number, weekly: number[], drawdownPct = 20): RiskGridPoint {
  const mean = weekly.reduce((a, b) => a + b, 0) / weekly.length;
  const d = { mean, quantiles: weekly, periods: 100 };
  return { riskPercent, annualReturnPct: mean * 52 * 100, maxDrawdownPct: drawdownPct, periods: { DAILY: d, WEEKLY: d, MONTHLY: d } };
}

// On $5k: 1% risk averages $10/week (−$50…+$70), 2% averages $15, 3% $15.50.
const baseline: EdgeBaseline = {
  generatedAt: '', closedTrades: 500, expectancyR: 0.25, winRate: 35, tradesPerWeek: 0.6, maxDrawdownR: 20,
  source: { provider: 'test', symbols: 10, strategies: ['REVERSAL'], from: '2023-01-03', to: '2026-10-23', tradingDays: 956, accountSize: 5000, maxPositions: 5, runs: 1 },
  grid: [point(2, linear(-0.02, 0.026), 30), point(1, linear(-0.01, 0.014), 10), point(3, linear(-0.02, 0.0262), 40)],
};
const noPaper = { closed: 0, expectancyR: null };
const input = (over: Partial<GoalInput> = {}): GoalInput => ({
  goalAmount: 10, goalPeriod: 'WEEKLY', accountSize: 5000, riskPercent: 1, maxRiskPercent: 2, ...over,
});

describe('verdictFor', () => {
  it('is realistic up to the expected P&L, a stretch up to twice it, unrealistic beyond or with no edge', () => {
    expect(verdictFor(10, 10)).toBe('REALISTIC');
    expect(verdictFor(20, 10)).toBe('STRETCH');
    expect(verdictFor(20.01, 10)).toBe('UNREALISTIC');
    expect(verdictFor(1, 0)).toBe('UNREALISTIC');
  });
});

describe('shareAtOrAbove', () => {
  it('reads the share of periods at or above a value off the percentiles', () => {
    const q = linear(0, 1);
    expect(shareAtOrAbove(q, 0)).toBe(100);
    expect(shareAtOrAbove(q, 0.5)).toBeCloseTo(50);
    expect(shareAtOrAbove(q, 0.755)).toBeCloseTo(24.5);
    expect(shareAtOrAbove(q, 1.01)).toBe(0);
  });

  it('handles distributions that are mostly zero', () => {
    const q = [...Array(90).fill(0), ...linear(0.01, 0.1).slice(90)];
    expect(shareAtOrAbove(q, 0.0001)).toBeLessThan(11);
  });
});

describe('assessGoal', () => {
  it('projects the expected P&L, median and hit rate for the period', () => {
    const f = assessGoal(input(), baseline, noPaper);
    expect(f).toMatchObject({ verdict: 'REALISTIC', expectedPerPeriod: 10, medianPerPeriod: 10, periodsSampled: 100, tradesPerWeek: 0.6 });
    expect(f.hitRate).toBeCloseTo(50, 0);
    expect(f.suggestions).toMatchObject({ riskPercent: null, accountSize: null, goalAmount: 10, goalPeriod: null });
  });

  it('scales with account size', () => {
    expect(assessGoal(input({ accountSize: 10_000 }), baseline, noPaper).expectedPerPeriod).toBe(20);
  });

  it('interpolates between grid points and clamps outside the grid', () => {
    expect(assessGoal(input({ riskPercent: 1.5 }), baseline, noPaper).expectedPerPeriod).toBe(12.5);
    expect(assessGoal(input({ riskPercent: 0.25 }), baseline, noPaper).expectedPerPeriod).toBe(10);
  });

  it('suggests the account size that reaches an out-of-reach goal, never more risk than the ceiling', () => {
    const f = assessGoal(input({ goalAmount: 1000 }), baseline, noPaper);
    expect(f.verdict).toBe('UNREALISTIC');
    expect(f.suggestions.accountSize).toBe(500_000);
    expect(f.suggestions.riskPercent).toBeNull();
    expect(f.suggestions.goalAmount).toBe(10);
  });

  it('suggests a higher risk only within the ceiling', () => {
    expect(assessGoal(input({ goalAmount: 14 }), baseline, noPaper).suggestions.riskPercent).toBe(2);
    expect(assessGoal(input({ goalAmount: 14, maxRiskPercent: 1.5 }), baseline, noPaper).suggestions.riskPercent).toBeNull();
  });

  it('does not suggest more risk that barely adds P&L, but shows what it would buy', () => {
    const f = assessGoal(input({ goalAmount: 15.4, riskPercent: 2, maxRiskPercent: 3 }), baseline, noPaper);
    expect(f.verdict).toBe('STRETCH');
    expect(f.suggestions.riskPercent).toBeNull();
    expect(f.suggestions.bestWithinCeiling).toEqual({ riskPercent: 3, expectedPerPeriod: 15.5 });
  });

  it('suggests a longer period when the realistic goal is rarely hit in one', () => {
    const lumpy = [...Array(85).fill(0), ...linear(0.001, 0.1).slice(85)];
    const b = { ...baseline, grid: [point(1, lumpy)] };
    const f = assessGoal(input({ goalAmount: 500 }), b, noPaper);
    expect(f.hitRate).toBeLessThan(10);
    expect(f.suggestions.goalPeriod).toBe('MONTHLY');
    expect(assessGoal(input({ goalAmount: 500, goalPeriod: 'MONTHLY' }), b, noPaper).suggestions.goalPeriod).toBeNull();
  });

  it('uses the paper record once it has enough trades and is worse than the backtest', () => {
    expect(assessGoal(input(), baseline, { closed: 29, expectancyR: 0.1 }).edge.source).toBe('BACKTEST');
    expect(assessGoal(input(), baseline, { closed: 40, expectancyR: 0.4 }).edge.source).toBe('BACKTEST');
    const f = assessGoal(input(), baseline, { closed: 30, expectancyR: 0.125 });
    expect(f.edge).toMatchObject({ source: 'PAPER', expectancyR: 0.125, backtest: { expectancyR: 0.25, closedTrades: 500 } });
    expect(f.expectedPerPeriod).toBe(5);
    expect(f.verdict).toBe('STRETCH');
    // A weaker edge does not shrink the drawdown.
    expect(f.worstDrawdown).toBe(assessGoal(input(), baseline, noPaper).worstDrawdown);
  });

  it('projects nothing and suggests no goal when the paper edge is gone', () => {
    const f = assessGoal(input(), baseline, { closed: 50, expectancyR: -0.2 });
    expect(f).toMatchObject({ verdict: 'UNREALISTIC', expectedPerPeriod: 0, hitRate: 0 });
    expect(f.suggestions).toMatchObject({ accountSize: null, goalAmount: null, riskPercent: null });
  });
});

describe('committed edge baseline', () => {
  it('is a valid, sorted grid of distributions', () => {
    expect(EDGE_BASELINE.source.strategies).toContain('REVERSAL');
    expect(EDGE_BASELINE.closedTrades).toBeGreaterThan(100);
    expect(EDGE_BASELINE.expectancyR).toBeGreaterThan(0);
    const risks = EDGE_BASELINE.grid.map(g => g.riskPercent);
    expect(risks).toEqual([...risks].sort((a, b) => a - b));
    for (const g of EDGE_BASELINE.grid) {
      for (const d of Object.values(g.periods)) {
        expect(d.quantiles).toHaveLength(101);
        expect(d.quantiles).toEqual([...d.quantiles].sort((a, b) => a - b));
        expect(d.periods).toBeGreaterThan(0);
      }
    }
  });

  it('rates a $100/week goal on $5k unrealistic and points to a bigger account, not more risk', () => {
    const f = assessGoal({ goalAmount: 100, goalPeriod: 'WEEKLY', accountSize: 5000, riskPercent: 1.5, maxRiskPercent: 2 }, EDGE_BASELINE, noPaper);
    expect(f.verdict).toBe('UNREALISTIC');
    expect(f.suggestions.riskPercent).toBeNull();
    expect(f.suggestions.accountSize).toBeGreaterThan(20_000);
    expect(f.suggestions.goalAmount).toBeLessThan(100);
  });
});

describe('expected value', () => {
  it('is the baseline expectancy times dollars at risk, for measured strategies only', () => {
    expect(expectedValue('REVERSAL', 100)).toBeCloseTo(EDGE_BASELINE.expectancyR * 100, 2);
    expect(expectedValue('BREAKOUT', 100)).toBeNull();
  });

  it('orders by expected value, unmeasured last, then by score', () => {
    const rows = [
      { id: 'a', expectedValue: 10, score: 50 },
      { id: 'b', expectedValue: null, score: 99 },
      { id: 'c', expectedValue: 20, score: 10 },
      { id: 'd', expectedValue: 10, score: 60 },
    ];
    expect(rows.sort(byExpectedValue).map(r => r.id)).toEqual(['c', 'd', 'a', 'b']);
  });
});
