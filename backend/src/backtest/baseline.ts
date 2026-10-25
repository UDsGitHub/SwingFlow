import { GoalPeriod } from '../types';
import { periodStart } from '../lib/marketTime';
import { BacktestTrade } from './simulate';
import { PortfolioConfig, simulatePortfolio } from './portfolio';
import { summarize } from './stats';

/** Risk levels the baseline is replayed at, so goal feasibility can answer "what if I risked more?". */
export const RISK_GRID = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
const TRADING_DAYS_PER_YEAR = 252;
const PERIODS: GoalPeriod[] = ['DAILY', 'WEEKLY', 'MONTHLY'];

/** Distribution of P&L per period, as a fraction of the account. */
export interface PeriodDistribution {
  mean: number;
  /** Percentiles 0..100 of P&L per period, pooled over every run. */
  quantiles: number[];
  /** Periods in the window per run. */
  periods: number;
}

export interface RiskGridPoint {
  riskPercent: number;
  /** Mean yearly P&L as % of the account (no compounding), averaged over runs. */
  annualReturnPct: number;
  /** Median over runs of the largest peak-to-trough drop of cumulative P&L, % of the account. */
  maxDrawdownPct: number;
  periods: Record<GoalPeriod, PeriodDistribution>;
}

/**
 * The measured edge the app judges goals against: the out-of-sample, regime-gated portfolio
 * (capital and position-slot limits applied), committed as config/edge-baseline.json.
 */
export interface EdgeBaseline {
  generatedAt: string;
  source: {
    provider: string;
    symbols: number;
    strategies: string[];
    from: string;
    to: string;
    tradingDays: number;
    accountSize: number;
    maxPositions: number;
    /** Portfolio replays per risk level, each with a random order for same-day fills. */
    runs: number;
  };
  /** Closed trades in the whole gated stream (every setup, as the paper tracker follows them). */
  closedTrades: number;
  /** Mean R per closed trade of that stream; comparable with the paper record. */
  expectancyR: number;
  winRate: number;
  /** Closed trades per week one account could take (capital and slot limits). */
  tradesPerWeek: number;
  maxDrawdownR: number;
  grid: RiskGridPoint[];
}

/** Re-size a trade at another risk %, with the same rules as the simulator (risk budget, then buying power). */
export function resizeTrade(t: BacktestTrade, accountSize: number, riskPercent: number): BacktestTrade {
  if (!t.fillPrice || t.exitPrice === undefined) return t;
  const riskShares = Math.floor((accountSize * riskPercent / 100) / Math.max(t.entry - t.stop, 0.01));
  const shares = Math.max(0, Math.min(riskShares, Math.floor(accountSize / t.fillPrice)));
  return { ...t, shares, pnl: (t.exitPrice - t.fillPrice) * shares };
}

/**
 * Bucket closed-trade P&L by exit date into every period of the window. WEEKLY and MONTHLY
 * drop the first and last period, which the window usually covers only in part.
 */
export function periodReturns(trades: BacktestTrade[], dates: string[], accountSize: number, period: GoalPeriod): number[] {
  const keys = [...new Set(dates.map(d => periodStart(d, period)))].sort();
  const kept = period === 'DAILY' ? keys : keys.slice(1, -1);
  const pnl = new Map(kept.map(k => [k, 0]));
  for (const t of trades) {
    if (!t.exitDate || t.pnl === undefined) continue;
    const k = periodStart(t.exitDate, period);
    if (pnl.has(k)) pnl.set(k, (pnl.get(k) as number) + t.pnl);
  }
  return kept.map(k => round((pnl.get(k) as number) / accountSize, 6));
}

function maxDrawdown(returns: number[]): number {
  let cum = 0, peak = 0, dd = 0;
  for (const r of returns) {
    cum += r;
    peak = Math.max(peak, cum);
    dd = Math.max(dd, peak - cum);
  }
  return dd;
}

/** Deterministic PRNG (mulberry32), so a rebuilt baseline is reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantiles(values: number[]): number[] {
  const s = [...values].sort((a, b) => a - b);
  return Array.from({ length: 101 }, (_, q) => {
    const pos = (q / 100) * (s.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return round(s[lo] + (s[hi] - s[lo]) * (pos - lo), 6);
  });
}

const median = (xs: number[]) => quantiles(xs)[50];

/**
 * Build the baseline from the live-equivalent (regime-gated) trades of one window and its
 * trading days. One portfolio path is mostly luck: which ~30 trades a year fit in capital
 * decides the result. So each risk level is replayed `runs` times as a Monte Carlo: same-day
 * fills are taken in random order, and each taken trade's result is drawn from the stream's
 * R outcomes and applied to the risk actually taken (after the buying-power cap). The grid
 * reports the mean and the pooled distribution of those runs.
 */
export function buildBaseline(
  gated: BacktestTrade[],
  dates: string[],
  portfolio: PortfolioConfig,
  meta: Pick<EdgeBaseline['source'], 'provider' | 'symbols' | 'strategies'>,
  { riskGrid = RISK_GRID, runs = 1000, seed = 1 }: { riskGrid?: number[]; runs?: number; seed?: number } = {},
): EdgeBaseline {
  const sorted = [...dates].sort();
  // The paper tracker follows every setup, so the comparable edge is the whole gated stream;
  // trades per week is what one account can actually take.
  const stream = summarize(gated);
  const taken = summarize(simulatePortfolio(gated, portfolio));
  const random = rng(seed);
  const outcomes = gated.filter(t => t.exitDate && t.rMultiple !== undefined).map(t => t.rMultiple as number);
  const grid = riskGrid.map((riskPercent): RiskGridPoint => {
    const resized = gated.map(t => resizeTrade(t, portfolio.accountSize, riskPercent));
    const pooled: Record<GoalPeriod, number[]> = { DAILY: [], WEEKLY: [], MONTHLY: [] };
    const annual: number[] = [];
    const drawdowns: number[] = [];
    for (let run = 0; run < runs; run++) {
      const order = new Map(resized.map(t => [t, random()]));
      const taken = simulatePortfolio(resized, { ...portfolio, rank: t => order.get(t) ?? 0 }).map(t => {
        const r = outcomes[Math.floor(random() * outcomes.length)] ?? 0;
        return { ...t, pnl: r * (t.shares ?? 0) * Math.max((t.fillPrice ?? t.entry) - t.stop, 0.01) };
      });
      for (const p of PERIODS) {
        const returns = periodReturns(taken, sorted, portfolio.accountSize, p);
        pooled[p].push(...returns);
        if (p === 'DAILY') {
          annual.push(sorted.length ? (returns.reduce((a, b) => a + b, 0) / sorted.length) * TRADING_DAYS_PER_YEAR * 100 : 0);
          drawdowns.push(maxDrawdown(returns) * 100);
        }
      }
    }
    const periods = Object.fromEntries(PERIODS.map(p => [p, {
      mean: round(pooled[p].reduce((a, b) => a + b, 0) / Math.max(pooled[p].length, 1), 6),
      quantiles: quantiles(pooled[p].length ? pooled[p] : [0]),
      periods: pooled[p].length / runs,
    }])) as Record<GoalPeriod, PeriodDistribution>;
    return {
      riskPercent,
      annualReturnPct: round(annual.reduce((a, b) => a + b, 0) / runs, 2),
      maxDrawdownPct: round(median(drawdowns), 2),
      periods,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    source: {
      ...meta,
      from: sorted[0] ?? '',
      to: sorted[sorted.length - 1] ?? '',
      tradingDays: sorted.length,
      accountSize: portfolio.accountSize,
      maxPositions: portfolio.maxPositions,
      runs,
    },
    closedTrades: stream.closed,
    expectancyR: round(stream.expectancyR ?? 0, 4),
    winRate: round(stream.winRate ?? 0, 2),
    tradesPerWeek: round(sorted.length ? taken.closed / (sorted.length / 5) : 0, 3),
    maxDrawdownR: stream.maxDrawdownR,
    grid,
  };
}

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
