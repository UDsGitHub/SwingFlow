import { BacktestTrade } from './simulate';

export interface StrategyStats {
  signals: number;
  filled: number;
  noFill: number;
  gapSkip: number;
  closed: number;
  targets: number;
  stops: number;
  timeouts: number;
  /** % of closed trades with a positive R. */
  winRate: number | null;
  /** Mean R per closed trade — the edge per unit of risk. */
  expectancyR: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
  profitFactor: number | null;
  avgHoldDays: number | null;
  totalPnl: number;
  /** Largest peak-to-trough drop of cumulative R, closed trades in exit order. */
  maxDrawdownR: number;
}

const CLOSED = new Set(['TARGET', 'STOP', 'TIMEOUT']);

export function summarize(trades: BacktestTrade[]): StrategyStats {
  const closed = trades
    .filter(t => CLOSED.has(t.outcome) && t.rMultiple !== undefined)
    .sort((a, b) => (a.exitDate ?? '').localeCompare(b.exitDate ?? ''));
  const rs = closed.map(t => t.rMultiple as number);
  const wins = rs.filter(r => r > 0);
  const losses = rs.filter(r => r <= 0);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);

  let peak = 0, cum = 0, maxDd = 0;
  for (const r of rs) {
    cum += r;
    peak = Math.max(peak, cum);
    maxDd = Math.max(maxDd, peak - cum);
  }

  const grossLoss = Math.abs(sum(losses));
  return {
    signals: trades.length,
    filled: trades.filter(t => t.fillDate).length,
    noFill: trades.filter(t => t.outcome === 'NO_FILL').length,
    gapSkip: trades.filter(t => t.outcome === 'GAP_SKIP').length,
    closed: closed.length,
    targets: closed.filter(t => t.outcome === 'TARGET').length,
    stops: closed.filter(t => t.outcome === 'STOP').length,
    timeouts: closed.filter(t => t.outcome === 'TIMEOUT').length,
    winRate: rs.length ? (wins.length / rs.length) * 100 : null,
    expectancyR: mean(rs),
    avgWinR: mean(wins),
    avgLossR: mean(losses),
    profitFactor: grossLoss > 0 ? sum(wins) / grossLoss : null,
    avgHoldDays: mean(closed.map(t => t.holdDays ?? 0)),
    totalPnl: Math.round(sum(closed.map(t => t.pnl ?? 0)) * 100) / 100,
    maxDrawdownR: Math.round(maxDd * 100) / 100,
  };
}

export function groupBy<K extends string>(trades: BacktestTrade[], key: (t: BacktestTrade) => K): Record<K, StrategyStats> {
  const groups = new Map<K, BacktestTrade[]>();
  for (const t of trades) {
    const k = key(t);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const out = {} as Record<K, StrategyStats>;
  for (const [k, ts] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) out[k] = summarize(ts);
  return out;
}

export function confidenceBucket(confidence: number): string {
  if (confidence >= 90) return '90+';
  if (confidence >= 80) return '80-89';
  if (confidence >= 70) return '70-79';
  return '<70';
}

/** Peak number of positions open on the same day (the backtest does not limit concurrency). */
export function maxConcurrentPositions(trades: BacktestTrade[]): number {
  const events: [string, number][] = [];
  for (const t of trades) {
    if (!t.fillDate || !t.exitDate) continue;
    events.push([t.fillDate, 1], [t.exitDate, -1]);
  }
  // Opens sort before closes on the same date: a position exiting today still occupied capital today.
  events.sort(([a, x], [b, y]) => a.localeCompare(b) || y - x);
  let open = 0, peak = 0;
  for (const [, d] of events) {
    open += d;
    peak = Math.max(peak, open);
  }
  return peak;
}
