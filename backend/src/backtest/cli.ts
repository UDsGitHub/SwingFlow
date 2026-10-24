import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { createProvider, ProviderName } from '../providers/ProviderFactory';
import { ALL_STRATEGY_TYPES, EXIT_PLANS, createStrategies } from '../strategies/strategyConfig';
import { classifyRegime, REGIME_BARS } from '../services/MarketRegimeService';
import { OHLC, RegimeSnapshot } from '../types';
import { BacktestConfig, BacktestTrade, DEFAULT_CONFIG, barDate, simulateSymbol } from './simulate';
import { StrategyStats, confidenceBucket, groupBy, maxConcurrentPositions, summarize } from './stats';
import { LIQUID_UNIVERSE } from '../config/universe';
import { PortfolioConfig, simulatePortfolio } from './portfolio';

// Mirrors the default watchlist new users receive (middleware/auth.ts).
const DEFAULT_SYMBOLS = [
  'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMD', 'META', 'AMZN', 'SPY', 'QQQ',
  'GOOGL', 'NFLX', 'AVGO', 'SMCI', 'PLTR', 'JPM', 'XOM', 'UNH', 'CAT', 'CRM',
];
const TRADING_DAYS_PER_YEAR = 252;

const USAGE = `Usage: npm run backtest -- [options]
  --symbols AAPL,MSFT    symbols to test (default: default watchlist)
  --universe             test the liquid scan universe (config/universe.ts)
  --split 2023-01-01     report in-sample (before) and out-of-sample (on/after) separately
  --years 5              years of history to replay (default 5)
  --provider alpaca      alpaca | polygon | mock (default: DATA_PROVIDER or alpaca)
  --entry-window 3       days a setup waits for its entry
  --max-hold 10          days before a time exit
  --account 5000         account size for $ sizing
  --max-positions 5      portfolio: max simultaneous positions
  --all-strategies       test every strategy, not just ENABLED_STRATEGIES
  --base-exits           use each strategy's own target and --max-hold instead of EXIT_PLANS
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
    : args.universe ? [...LIQUID_UNIVERSE] : DEFAULT_SYMBOLS;
  const split = typeof args.split === 'string' ? args.split : null;
  const years = num(args.years, 5);
  const providerName = (typeof args.provider === 'string' ? args.provider : process.env.DATA_PROVIDER ?? 'alpaca') as ProviderName;
  const cfg: BacktestConfig = {
    ...DEFAULT_CONFIG,
    entryWindowDays: num(args['entry-window'], DEFAULT_CONFIG.entryWindowDays),
    maxHoldDays: num(args['max-hold'], DEFAULT_CONFIG.maxHoldDays),
    accountSize: num(args.account, DEFAULT_CONFIG.accountSize),
    riskPercent: num(args.risk, DEFAULT_CONFIG.riskPercent),
    exits: args['base-exits'] ? undefined : EXIT_PLANS,
  };

  const portfolio: PortfolioConfig = {
    accountSize: cfg.accountSize,
    maxPositions: num(args['max-positions'], 5),
    rank: t => t.confidence, // the live dashboard orders setups by confidence
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

  const strategies = args['all-strategies'] ? createStrategies(ALL_STRATEGY_TYPES) : createStrategies();
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

  const start = minDate(coverage);
  const dates = [...regimeByDate.keys()].filter(d => d >= start);
  const periods = split
    ? {
        [`in-sample (< ${split})`]: analyze(trades.filter(t => t.signalDate < split), dates.filter(d => d < split).length, portfolio),
        [`out-of-sample (>= ${split})`]: analyze(trades.filter(t => t.signalDate >= split), dates.filter(d => d >= split).length, portfolio),
      }
    : { 'full period': analyze(trades, dates.length, portfolio) };

  const report = {
    generatedAt: new Date().toISOString(),
    provider: provider.name,
    symbols,
    years,
    split,
    config: cfg,
    coverage,
    periods,
    trades,
  };

  console.log(`\n=== SwingFlow backtest — ${provider.name}, ${Object.keys(coverage).length} symbols, ${dates.length} trading days ===`);
  console.log(`Strategies: ${strategies.map(st => st.name).join(', ')}; exits: ${cfg.exits ? 'EXIT_PLANS' : `strategy targets, ${cfg.maxHoldDays}d max hold`}`);
  console.log(`Rules: entry window ${cfg.entryWindowDays}d, skip gaps >${cfg.maxChasePct * 100}%, slippage ${cfg.slippagePct * 100}%/side, $${cfg.accountSize} @ ${cfg.riskPercent}% risk, max ${portfolio.maxPositions} positions`);
  for (const [name, analysis] of Object.entries(periods)) printAnalysis(name, analysis);
  console.log('\nCaveat: the symbol list is today\'s membership (survivorship bias).');

  const outDir = path.resolve(__dirname, '../../backtest-results');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `backtest-${report.generatedAt.replace(/[:.]/g, '-')}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`\nFull report (every simulated trade): ${outFile}`);
  if (args.json) console.log(JSON.stringify(periods, null, 2));
}

function minDate(coverage: Record<string, { from: string }>): string {
  return Object.values(coverage).map(c => c.from).sort()[0] ?? '9999-12-31';
}

interface Analysis {
  testedTradingDays: number;
  live: { overall: StrategyStats; byStrategy: Record<string, StrategyStats> };
  ungated: {
    overall: StrategyStats;
    byStrategy: Record<string, StrategyStats>;
    byStrategyAndRegime: Record<string, StrategyStats>;
    byConfidence: Record<string, StrategyStats>;
  };
  /** Live-equivalent trades a cash account could actually take (capital + position limits). */
  portfolio: StrategyStats & { byStrategy: Record<string, StrategyStats> };
  goal: { closedTradesPerWeek: number; pnlPerWeek: number; pnlPerTradingDay: number; uncappedPeakPositions: number };
}

function analyze(trades: BacktestTrade[], testedDays: number, portfolio: PortfolioConfig): Analysis {
  // live: regime-gated, what the app would have produced; ungated shows whether the gate helps.
  const gated = trades.filter(t => t.inGated);
  const ungated = trades.filter(t => t.inUngated);
  const gatedAll = summarize(gated);
  const taken = simulatePortfolio(gated, portfolio);
  const takenAll = summarize(taken);
  const weeks = testedDays / 5;
  return {
    testedTradingDays: testedDays,
    live: { overall: gatedAll, byStrategy: groupBy(gated, t => t.strategy) },
    ungated: {
      overall: summarize(ungated),
      byStrategy: groupBy(ungated, t => t.strategy),
      byStrategyAndRegime: groupBy(ungated, t => `${t.strategy} / ${t.regime}`),
      byConfidence: groupBy(ungated, t => confidenceBucket(t.confidence)),
    },
    portfolio: { ...takenAll, byStrategy: groupBy(taken, t => t.strategy) },
    goal: {
      closedTradesPerWeek: weeks > 0 ? takenAll.closed / weeks : 0,
      pnlPerWeek: weeks > 0 ? takenAll.totalPnl / weeks : 0,
      pnlPerTradingDay: testedDays > 0 ? takenAll.totalPnl / testedDays : 0,
      uncappedPeakPositions: maxConcurrentPositions(gated),
    },
  };
}

function printAnalysis(name: string, a: Analysis): void {
  console.log(`\n──────── ${name}: ${a.testedTradingDays} trading days ────────`);
  console.log('\nLive-equivalent (regime-gated):');
  table({ ...a.live.byStrategy, ALL: a.live.overall });
  console.log('\nUngated (does the regime gate help?):');
  table({ ...a.ungated.byStrategy, ALL: a.ungated.overall });
  console.log('\nUngated by strategy / regime:');
  table(a.ungated.byStrategyAndRegime);
  console.log('\nUngated by confidence (is confidence predictive?):');
  table(a.ungated.byConfidence);
  console.log('\nPortfolio (live-equivalent, limited by capital and position slots):');
  table({ ...a.portfolio.byStrategy, ALL: a.portfolio });
  const g = a.goal;
  console.log('\nGoal view (portfolio):');
  console.log(`  ${g.closedTradesPerWeek.toFixed(1)} trades/week, $${g.pnlPerWeek.toFixed(0)}/week, $${g.pnlPerTradingDay.toFixed(2)}/trading day (uncapped stream peaked at ${g.uncappedPeakPositions} open positions)`);
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
