import { GoalFeasibility, GoalPeriod, GoalVerdict, PaperEdge } from '../types';
import type { EdgeBaseline } from '../backtest/baseline';

/** Closed paper trades needed before the live record can overrule the backtest. */
export const PAPER_MIN_TRADES = 30;
/** A goal is a stretch up to this multiple of the expected P&L; beyond it, unrealistic. */
const STRETCH_MULTIPLE = 2;
/**
 * Returns are capped by buying power, so above ~1% risk they barely grow while drawdowns do.
 * Only suggest more risk when it lifts expected P&L by at least this fraction.
 */
const MIN_RISK_GAIN = 0.25;
/** Below this hit rate the realistic goal is too lumpy for its period; suggest a longer one. */
const LUMPY_HIT_RATE = 40;
const LONGER: Record<GoalPeriod, GoalPeriod | null> = { DAILY: 'WEEKLY', WEEKLY: 'MONTHLY', MONTHLY: null };

export interface GoalInput {
  goalAmount: number;
  goalPeriod: GoalPeriod;
  accountSize: number;
  riskPercent: number;
  maxRiskPercent: number;
}

interface Projection {
  /** Mean P&L per period, fraction of the account. */
  mean: number;
  /** Percentiles 0..100 of P&L per period, fraction of the account. */
  quantiles: number[];
  periods: number;
  annualReturnPct: number;
  maxDrawdownPct: number;
}

/**
 * The baseline at any risk %, interpolated linearly between grid points (clamped to the grid's
 * range). Mixing percentiles point by point keeps the result a valid distribution.
 */
function project(baseline: EdgeBaseline, riskPercent: number, period: GoalPeriod): Projection {
  const grid = [...baseline.grid].sort((a, b) => a.riskPercent - b.riskPercent);
  const r = Math.min(Math.max(riskPercent, grid[0].riskPercent), grid[grid.length - 1].riskPercent);
  const hiIdx = Math.max(grid.findIndex(g => g.riskPercent >= r), 0);
  const hi = grid[hiIdx];
  const lo = grid[Math.max(hiIdx - 1, 0)];
  const w = hi.riskPercent === lo.riskPercent ? 1 : (r - lo.riskPercent) / (hi.riskPercent - lo.riskPercent);
  const mix = (a: number, b: number) => a * (1 - w) + b * w;
  const [l, h] = [lo.periods[period], hi.periods[period]];
  return {
    mean: mix(l.mean, h.mean),
    quantiles: h.quantiles.map((v, i) => mix(l.quantiles[i], v)),
    periods: h.periods,
    annualReturnPct: mix(lo.annualReturnPct, hi.annualReturnPct),
    maxDrawdownPct: mix(lo.maxDrawdownPct, hi.maxDrawdownPct),
  };
}

/** % of periods at or above `x`, read off the percentiles. */
export function shareAtOrAbove(quantiles: number[], x: number): number {
  const last = quantiles.length - 1;
  if (x <= quantiles[0]) return 100;
  if (x > quantiles[last]) return 0;
  for (let i = 0; i < last; i++) {
    if (quantiles[i] < x && x <= quantiles[i + 1]) {
      const pct = (i + (x - quantiles[i]) / (quantiles[i + 1] - quantiles[i])) * (100 / last);
      return 100 - pct;
    }
  }
  return 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Round a suggested goal down to a tidy figure. */
function tidyGoal(amount: number): number {
  return amount >= 10 ? Math.floor(amount / 5) * 5 : Math.floor(amount);
}

export function verdictFor(goal: number, expected: number): GoalVerdict {
  if (expected <= 0) return 'UNREALISTIC';
  if (goal <= expected) return 'REALISTIC';
  return goal <= expected * STRETCH_MULTIPLE ? 'STRETCH' : 'UNREALISTIC';
}

/**
 * Judge a goal against the measured edge: what these settings made per period in the
 * out-of-sample backtest (scaled down to the live paper record once it has enough trades and
 * is worse), how often a period reached the goal, and what would make the goal reachable.
 * Returns scale with account size (fixed-fraction sizing, no compounding).
 */
export function assessGoal(input: GoalInput, baseline: EdgeBaseline, paper: PaperEdge): GoalFeasibility {
  const { goalAmount, goalPeriod, accountSize, riskPercent, maxRiskPercent } = input;
  const usePaper = paper.closed >= PAPER_MIN_TRADES && paper.expectancyR !== null && paper.expectancyR < baseline.expectancyR;
  const expectancyR = usePaper ? (paper.expectancyR as number) : baseline.expectancyR;
  // Scale P&L by how the live edge compares with the backtest; no edge means nothing to project.
  const scale = baseline.expectancyR > 0 ? Math.max(expectancyR, 0) / baseline.expectancyR : 0;

  const dollars = accountSize * scale;
  const expectedAt = (risk: number) => project(baseline, risk, goalPeriod).mean * dollars;
  const hitRateOf = (proj: Projection, goal: number) => (dollars > 0 ? shareAtOrAbove(proj.quantiles, goal / dollars) : 0);

  const proj = project(baseline, riskPercent, goalPeriod);
  const expected = proj.mean * dollars;
  const verdict = verdictFor(goalAmount, expected);

  const higher = baseline.grid
    .map(g => g.riskPercent)
    .filter(r => r > riskPercent && r <= maxRiskPercent)
    .sort((a, b) => a - b);
  const riskSuggestion = verdict === 'REALISTIC'
    ? null
    : higher.find(r => expectedAt(r) >= goalAmount && expectedAt(r) >= expected * (1 + MIN_RISK_GAIN)) ?? null;
  const best = higher.reduce(
    (b, r) => (expectedAt(r) > b.expectedPerPeriod ? { riskPercent: r, expectedPerPeriod: expectedAt(r) } : b),
    { riskPercent, expectedPerPeriod: expected },
  );

  const meanFraction = expected / accountSize;
  const accountSuggestion = verdict !== 'REALISTIC' && meanFraction > 0
    ? Math.ceil(goalAmount / meanFraction / 500) * 500
    : null;

  const realistic = tidyGoal(expected);
  const goalSuggestion = realistic > 0 ? realistic : null;
  const periodSuggestion = goalSuggestion !== null && hitRateOf(proj, goalSuggestion) < LUMPY_HIT_RATE ? LONGER[goalPeriod] : null;

  return {
    verdict,
    expectedPerPeriod: round2(expected),
    medianPerPeriod: round2(proj.quantiles[50] * dollars),
    hitRate: Math.round(hitRateOf(proj, goalAmount) * 10) / 10,
    periodsSampled: proj.periods,
    annualReturnPct: round2(proj.annualReturnPct * scale),
    // Not scaled by the edge: a weaker edge makes drawdowns deeper, not shallower.
    worstDrawdown: Math.round((proj.maxDrawdownPct / 100) * accountSize),
    tradesPerWeek: baseline.tradesPerWeek,
    edge: {
      source: usePaper ? 'PAPER' : 'BACKTEST',
      expectancyR,
      backtest: {
        expectancyR: baseline.expectancyR,
        closedTrades: baseline.closedTrades,
        from: baseline.source.from,
        to: baseline.source.to,
      },
      paper,
      paperMinTrades: PAPER_MIN_TRADES,
    },
    suggestions: {
      riskPercent: riskSuggestion,
      bestWithinCeiling: { riskPercent: best.riskPercent, expectedPerPeriod: round2(best.expectedPerPeriod) },
      accountSize: accountSuggestion,
      goalAmount: goalSuggestion,
      goalPeriod: periodSuggestion,
    },
  };
}
