import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { createProvider, ProviderName } from '../providers/ProviderFactory';
import { TrendPullbackStrategy } from '../strategies/TrendPullbackStrategy';
import { BreakoutStrategy } from '../strategies/BreakoutStrategy';
import { ReversalStrategy } from '../strategies/ReversalStrategy';
import { classifyRegime, REGIME_BARS } from '../services/MarketRegimeService';
import { OHLC, RegimeSnapshot } from '../types';
import { BacktestConfig, BacktestTrade, DEFAULT_CONFIG, barDate, simulateSymbol } from './simulate';
import { StrategyStats, confidenceBucket, groupBy, maxConcurrentPositions, summarize } from './stats';

// Mirrors the default watchlist new users receive (middleware/auth.ts).
const DEFAULT_SYMBOLS = [
  'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMD', 'META', 'AMZN', 'SPY', 'QQQ',
  'GOOGL', 'NFLX', 'AVGO', 'SMCI', 'PLTR', 'JPM', 'XOM', 'UNH', 'CAT', 'CRM',
];
const TRADING_DAYS_PER_YEAR = 252;

const USAGE = `Usage: npm run backtest -- [options]
  --symbols AAPL,MSFT    symbols to test (default: default watchlist)
  --years 5              years of history to replay (default 5)
  --provider alpaca      alpaca | polygon | mock (default: DATA_PROVIDER or alpaca)
  --entry-window 3       days a setup waits for its entry
  --max-hold 10          days before a time exit
  --account 5000         account size for $ sizing
  --risk 1.5             risk percent per trade
  --json                 also print the full report as JSON`;

function parseArgs(argv: string[]): Record<string, string | true> {
  const args: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[a.slice(2)] = true;
    else { args[a.slice(2)] = next; i++; }
  }
  return args;
}

function num(v: string | true | undefined, fallback: number): number {
  const n = typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); return; }

  const symbols = typeof args.symbols === 'string'
    ? args.symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_SYMBOLS;
  const years = num(args.years, 5);
  const providerName = (typeof args.provider === 'string' ? args.provider : process.env.DATA_PROVIDER ?? 'alpaca') as ProviderName;
  const cfg: BacktestConfig = {
    ...DEFAULT_CONFIG,
    entryWindowDays: num(args['entry-window'], DEFAULT_CONFIG.entryWindowDays),
    maxHoldDays: num(args['max-hold'], DEFAULT_CONFIG.maxHoldDays),
    accountSize: num(args.account, DEFAULT_CONFIG.accountSize),
    riskPercent: num(args.risk, DEFAULT_CONFIG.riskPercent),
  };

  const provider = createProvider(providerName);
  const regimeSymbol = process.env.REGIME_SYMBOL ?? 'SPY';
  const tradeBars = Math.round(years * TRADING_DAYS_PER_YEAR);

  console.log(`Fetching ${years}y of daily bars for ${symbols.length} symbols from ${provider.name}…`);
  const regimeBars = await provider.getHistoricalPrices(regimeSymbol, tradeBars + REGIME_BARS);
  const regimeByDate = new Map<string, RegimeSnapshot>();
  for (let i = REGIME_BARS - 1; i < regimeBars.length; i++) {
    regimeByDate.set(barDate(regimeBars[i]), classifyRegime(regimeSymbol, regimeBars.slice(i - REGIME_BARS + 1, i + 1)));
  }

  const strategies = [new TrendPullbackStrategy(), new BreakoutStrategy(), new ReversalStrategy()];
  const trades: BacktestTrade[] = [];
  const coverage: Record<string, { from: string; to: string; bars: number }> = {};
  for (const symbol of symbols) {
    let bars: OHLC[];
    try {
      bars = await provider.getHistoricalPrices(symbol, tradeBars + cfg.windowBars);
    } catch (err) {
      console.warn(`  ${symbol}: skipped (${(err as Error).message})`);
      continue;
    }
    if (bars.length <= cfg.windowBars) {
      console.warn(`  ${symbol}: skipped (only ${bars.length} bars)`);
      continue;
    }
    coverage[symbol] = { from: barDate(bars[cfg.windowBars - 1]), to: barDate(bars[bars.length - 1]), bars: bars.length };
    trades.push(...simulateSymbol(symbol, bars, regimeByDate, strategies, cfg));
  }

  const testedDays = [...regimeByDate.keys()].filter(d => d >= minDate(coverage)).length;
  const gated = trades.filter(t => t.inGated);
  const ungated = trades.filter(t => t.inUngated);
  const gatedAll = summarize(gated);
  const weeks = testedDays / 5;

  const report = {
    generatedAt: new Date().toISOString(),
    provider: provider.name,
    symbols,
    years,
    config: cfg,
    coverage,
    testedTradingDays: testedDays,
    live: {
      description: 'Regime-gated, one open setup per symbol+strategy — what the live app would have produced',
      overall: gatedAll,
      byStrategy: groupBy(gated, t => t.strategy),
    },
    ungated: {
      description: 'No regime gating — shows whether the gate helps',
      overall: summarize(ungated),
      byStrategy: groupBy(ungated, t => t.strategy),
      byStrategyAndRegime: groupBy(ungated, t => `${t.strategy} / ${t.regime}`),
      byConfidence: groupBy(ungated, t => confidenceBucket(t.confidence)),
    },
    goal: {
      closedTradesPerWeek: weeks > 0 ? gatedAll.closed / weeks : 0,
      pnlPerWeek: weeks > 0 ? gatedAll.totalPnl / weeks : 0,
      pnlPerTradingDay: testedDays > 0 ? gatedAll.totalPnl / testedDays : 0,
      maxConcurrentPositions: maxConcurrentPositions(gated),
    },
    trades,
  };

  const outDir = path.resolve(__dirname, '../../backtest-results');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `backtest-${report.generatedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  printReport(report);
  console.log(`\nFull report (every simulated trade): ${outFile}`);
  if (args.json) console.log(JSON.stringify({ ...report, trades: undefined }, null, 2));
}

function minDate(coverage: Record<string, { from: string }>): string {
  return Object.values(coverage).map(c => c.from).sort()[0] ?? '9999-12-31';
}

function printReport(r: {
  provider: string; years: number; config: BacktestConfig; testedTradingDays: number;
  coverage: Record<string, unknown>;
  live: { overall: StrategyStats; byStrategy: Record<string, StrategyStats> };
  ungated: { overall: StrategyStats; byStrategy: Record<string, StrategyStats>; byStrategyAndRegime: Record<string, StrategyStats>; byConfidence: Record<string, StrategyStats> };
  goal: { closedTradesPerWeek: number; pnlPerWeek: number; pnlPerTradingDay: number; maxConcurrentPositions: number };
}): void {
  const c = r.config;
  console.log(`\n=== SwingFlow backtest — ${r.provider}, ${Object.keys(r.coverage).length} symbols, ${r.testedTradingDays} trading days ===`);
  console.log(`Rules: entry window ${c.entryWindowDays}d, max hold ${c.maxHoldDays}d, skip gaps >${c.maxChasePct * 100}%, slippage ${c.slippagePct * 100}%/side, $${c.accountSize} @ ${c.riskPercent}% risk`);

  console.log('\nLive-equivalent (regime-gated):');
  table({ ...r.live.byStrategy, ALL: r.live.overall });
  console.log('\nUngated (does the regime gate help?):');
  table({ ...r.ungated.byStrategy, ALL: r.ungated.overall });
  console.log('\nUngated by strategy / regime:');
  table(r.ungated.byStrategyAndRegime);
  console.log('\nUngated by confidence (is confidence predictive?):');
  table(r.ungated.byConfidence);

  const g = r.goal;
  console.log('\nGoal view (live-equivalent):');
  console.log(`  ${g.closedTradesPerWeek.toFixed(1)} closed trades/week, $${g.pnlPerWeek.toFixed(0)}/week, $${g.pnlPerTradingDay.toFixed(2)}/trading day; peak ${g.maxConcurrentPositions} positions open at once`);
  console.log('  Caveat: today\'s watchlist is survivorship-biased (current winners), and the backtest does not cap concurrent positions.');
}

function table(rows: Record<string, StrategyStats>): void {
  const fmt = (v: number | null, d = 2) => (v === null ? '—' : v.toFixed(d));
  const out: Record<string, Record<string, string | number>> = {};
  for (const [k, s] of Object.entries(rows)) {
    out[k] = {
      signals: s.signals,
      filled: s.filled,
      closed: s.closed,
      'win%': fmt(s.winRate, 1),
      expR: fmt(s.expectancyR),
      avgWinR: fmt(s.avgWinR),
      avgLossR: fmt(s.avgLossR),
      PF: fmt(s.profitFactor),
      hold: fmt(s.avgHoldDays, 1),
      'T/S/TO': `${s.targets}/${s.stops}/${s.timeouts}`,
      'maxDD R': s.maxDrawdownR,
      'P&L $': Math.round(s.totalPnl),
    };
  }
  console.table(out);
}

main().catch(err => {
  console.error('Backtest failed:', err);
  process.exit(1);
});
