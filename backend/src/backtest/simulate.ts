import { OHLC, RegimeSnapshot, StrategyType } from '../types';
import { computeIndicators } from '../indicators/technical';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { allowsRegime } from '../strategies/regimeGate';
import { SetupScoringService } from '../services/SetupScoringService';
import { PositionSizingService } from '../services/PositionSizingService';
import { marketClock } from '../lib/marketTime';
import { ENTRY_WINDOW_DAYS, ExitPlan, MAX_CHASE_PCT, SLIPPAGE_PCT } from '../strategies/strategyConfig';
import { ExitReason, TradeRules, applyBar, initialTradeState, isTerminal, rMultiple } from '../trading/tradeStateMachine';

export interface BacktestConfig {
  /** Bars passed to strategies each day — must match the live scan (120). */
  windowBars: number;
  /** Trading days a setup waits for price to reach its entry before expiring. */
  entryWindowDays: number;
  /** Default trading days a filled trade is held before a time exit at the close. */
  maxHoldDays: number;
  /** Per-strategy exit plans (defaults: strategy target, maxHoldDays, no trailing). */
  exits?: Partial<Record<StrategyType, Partial<ExitPlan>>>;
  /** Skip the fill when the open gaps more than this fraction above the entry. */
  maxChasePct: number;
  /** Adverse slippage applied to each fill and exit, as a fraction of price. */
  slippagePct: number;
  accountSize: number;
  riskPercent: number;
}

export const DEFAULT_CONFIG: BacktestConfig = {
  windowBars: 120,
  entryWindowDays: ENTRY_WINDOW_DAYS,
  maxHoldDays: 10,
  maxChasePct: MAX_CHASE_PCT,
  slippagePct: SLIPPAGE_PCT,
  accountSize: 5000,
  riskPercent: 1.5,
};

export type TradeOutcome = 'TARGET' | 'STOP' | 'TIMEOUT' | 'NO_FILL' | 'GAP_SKIP' | 'OPEN';

export interface BacktestTrade {
  symbol: string;
  strategy: StrategyType;
  regime: RegimeSnapshot['regime'];
  allowedByRegime: boolean;
  /** Part of the stream with no regime gating (one open setup per symbol+strategy). */
  inUngated: boolean;
  /** Part of the stream the live app would produce (regime-gated, one open setup per symbol+strategy). */
  inGated: boolean;
  confidence: number;
  score: number;
  signalDate: string;
  entry: number;
  stop: number;
  target: number;
  outcome: TradeOutcome;
  fillDate?: string;
  fillPrice?: number;
  exitDate?: string;
  exitPrice?: number;
  holdDays?: number;
  shares?: number;
  rMultiple?: number;
  pnl?: number;
}

const scoring = new SetupScoringService();
const sizing = new PositionSizingService();

export function barDate(bar: OHLC): string {
  return marketClock(bar.timestamp).date;
}

/**
 * Replay one symbol's daily history through the strategies and simulate every triggered
 * setup forward with conservative fill/exit rules. `regimeByDate` maps ET dates to the
 * regime the live scan would have seen that day; days without a regime read are skipped.
 */
export function simulateSymbol(
  symbol: string,
  bars: OHLC[],
  regimeByDate: Map<string, RegimeSnapshot>,
  strategies: BaseStrategy[],
  cfg: BacktestConfig = DEFAULT_CONFIG,
): BacktestTrade[] {
  const trades: BacktestTrade[] = [];
  // Index (exclusive) until which each stream is still busy with a setup per strategy.
  const busyUngated = new Map<string, number>();
  const busyGated = new Map<string, number>();

  for (let i = cfg.windowBars - 1; i < bars.length - 1; i++) {
    const regime = regimeByDate.get(barDate(bars[i]));
    if (!regime) continue;

    const window = bars.slice(i - cfg.windowBars + 1, i + 1);
    const indicators = computeIndicators(window);

    for (const strategy of strategies) {
      const result = strategy.evaluate(symbol, window, indicators);
      if (!result.triggered) continue;

      const allowed = allowsRegime(result.strategy, regime.regime);
      const inUngated = (busyUngated.get(result.strategy) ?? 0) <= i;
      const inGated = allowed && (busyGated.get(result.strategy) ?? 0) <= i;
      if (!inUngated && !inGated) continue;

      const atr = indicators.atr14[indicators.atr14.length - 1];
      const plan: ExitPlan = { maxHoldDays: cfg.maxHoldDays, ...cfg.exits?.[result.strategy] };
      const trade = simulateTrade(bars, i, result.entry, result.stop, result.target, atr, plan, cfg);
      const busyUntil = trade.endIndex + 1;
      if (inUngated) busyUngated.set(result.strategy, busyUntil);
      if (inGated) busyGated.set(result.strategy, busyUntil);

      trades.push({
        symbol,
        strategy: result.strategy,
        regime: regime.regime,
        allowedByRegime: allowed,
        inUngated,
        inGated,
        confidence: result.confidence,
        score: scoring.score(result),
        signalDate: barDate(bars[i]),
        entry: result.entry,
        stop: result.stop,
        target: result.target,
        ...trade.fields,
      });
    }
  }
  return trades;
}

interface SimulatedTrade {
  /** Last bar index the setup occupied (fill expiry or exit). */
  endIndex: number;
  fields: Pick<BacktestTrade, 'outcome' | 'fillDate' | 'fillPrice' | 'exitDate' | 'exitPrice' | 'holdDays' | 'shares' | 'rMultiple' | 'pnl'>;
}

function simulateTrade(
  bars: OHLC[],
  signalIdx: number,
  entry: number,
  initialStop: number,
  strategyTarget: number,
  atr: number,
  plan: ExitPlan,
  cfg: BacktestConfig,
): SimulatedTrade {
  const rules: TradeRules = { entryWindowDays: cfg.entryWindowDays, maxChasePct: cfg.maxChasePct, slippagePct: cfg.slippagePct };
  let state = initialTradeState(entry, initialStop, strategyTarget, plan);
  let k = signalIdx + 1;
  for (; k < bars.length; k++) {
    const bar = bars[k];
    const smaClose = plan.exitAboveSma !== undefined ? sma(bars, k, plan.exitAboveSma) : undefined;
    state = applyBar(state, { date: barDate(bar), open: bar.open, high: bar.high, low: bar.low, close: bar.close }, plan, rules, { final: true, atr, smaClose });
    if (isTerminal(state)) break;
  }
  const endIndex = Math.min(k, bars.length - 1);

  if (state.phase === 'SKIPPED') return { endIndex, fields: { outcome: 'GAP_SKIP' } };
  if (state.phase === 'EXPIRED') return { endIndex, fields: { outcome: 'NO_FILL' } };
  if (state.phase === 'PENDING') return { endIndex, fields: { outcome: 'OPEN' } };

  // Size from the planned levels like the live app, capped at the account's buying power.
  const fillPrice = state.fillPrice as number;
  const planned = sizing.calculate({ entry, stop: initialStop, target: strategyTarget, accountSize: cfg.accountSize, riskPercent: cfg.riskPercent });
  const shares = Math.max(0, Math.min(planned.shares, Math.floor(cfg.accountSize / fillPrice)));

  if (state.phase === 'OPEN') {
    return { endIndex, fields: { outcome: 'OPEN', fillDate: state.fillDate as string, fillPrice: round(fillPrice), shares } };
  }

  const exitPrice = state.exitPrice as number;
  return {
    endIndex,
    fields: {
      outcome: backtestOutcome(state.exitReason as ExitReason, exitPrice, fillPrice),
      fillDate: state.fillDate as string,
      fillPrice: round(fillPrice),
      exitDate: state.exitDate as string,
      exitPrice: round(exitPrice),
      holdDays: state.sessionsHeld,
      shares,
      rMultiple: round(rMultiple(state) as number, 3),
      pnl: round((exitPrice - fillPrice) * shares),
    },
  };
}

/** Map a rulebook exit to the backtest's outcome labels (an SMA exit is a win or a timeout by P&L). */
function backtestOutcome(reason: ExitReason, exitPrice: number, fillPrice: number): TradeOutcome {
  if (reason === 'TARGET') return 'TARGET';
  if (reason === 'STOP' || reason === 'TRAIL_STOP') return 'STOP';
  if (reason === 'SMA') return exitPrice >= fillPrice ? 'TARGET' : 'TIMEOUT';
  return 'TIMEOUT';
}

function sma(bars: OHLC[], idx: number, period: number): number {
  if (idx + 1 < period) return Infinity;
  let sum = 0;
  for (let i = idx - period + 1; i <= idx; i++) sum += bars[i].close;
  return sum / period;
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
