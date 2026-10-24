import { BacktestTrade } from './simulate';

export interface PortfolioConfig {
  accountSize: number;
  maxPositions: number;
  /** Higher ranks win when several setups fill on the same day. */
  rank: (t: BacktestTrade) => number;
}

/**
 * Replay closed trades through a cash account: a fill is taken only if a position slot is
 * free and the position fits in unused capital. Capital from a trade is released the day
 * after it exits (conservative). No compounding — account size is fixed.
 */
export function simulatePortfolio(trades: BacktestTrade[], cfg: PortfolioConfig): BacktestTrade[] {
  const candidates = trades
    .filter(t => t.fillDate && t.exitDate && t.shares && t.fillPrice)
    .sort((a, b) => (a.fillDate as string).localeCompare(b.fillDate as string) || cfg.rank(b) - cfg.rank(a));

  const open: { exitDate: string; cost: number }[] = [];
  const taken: BacktestTrade[] = [];
  for (const t of candidates) {
    const day = t.fillDate as string;
    for (let i = open.length - 1; i >= 0; i--) {
      if (open[i].exitDate < day) open.splice(i, 1);
    }
    const cost = (t.shares as number) * (t.fillPrice as number);
    const used = open.reduce((sum, p) => sum + p.cost, 0);
    if (open.length >= cfg.maxPositions || used + cost > cfg.accountSize) continue;
    open.push({ exitDate: t.exitDate as string, cost });
    taken.push(t);
  }
  return taken;
}
