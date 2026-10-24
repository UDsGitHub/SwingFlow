import { OHLC, RegimeSnapshot, StrategyType } from '../types';
import { computeIndicators } from '../indicators/technical';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { allowsRegime } from '../strategies/regimeGate';
import { SetupScoringService } from '../services/SetupScoringService';
import { PositionSizingService } from '../services/PositionSizingService';
import { marketClock } from '../lib/marketTime';

/** How a filled trade is managed. Mirrors what the live lifecycle tracker must implement. */
export interface ExitPlan {
  /** Trading days held before a time exit at the close. */
  maxHoldDays: number;
  /** Override the strategy's target as entry + targetR × risk; null = no fixed target. */
  targetR?: number | null;
  /** Chandelier trail: after each close, stop = max(stop, highest high since fill − mult × ATR at signal). */
  trailAtrMult?: number;
  /** Once the high reaches fill + breakevenAtR × risk, raise the stop to the fill price. */
  breakevenAtR?: number;
  /** Exit at the close once it is above the N-day simple moving average of closes. */
  exitAboveSma?: number;
}

export interface BacktestConfig {
  /** Bars passed to strategies each day — must match the live scan (120). */
  windowBars: number;
  /** Trading days a setup waits for price to reach its entry before expiring. */
  entryWindowDays: number;
  /** Default trading days a filled trade is held before a time exit at the close. */
  maxHoldDays: number;
  /** Per-strategy exit overrides (defaults: strategy target, maxHoldDays, no trailing). */
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
  entryWindowDays: 3,
  maxHoldDays: 10,
  maxChasePct: 0.01,
  slippagePct: 0.0005,
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
  // ── Fill: buy-stop at the entry within the entry window ──
  let fillIdx = -1;
  let fillPrice = 0;
  const lastEntryIdx = Math.min(signalIdx + cfg.entryWindowDays, bars.length - 1);
  for (let j = signalIdx + 1; j <= lastEntryIdx; j++) {
    const bar = bars[j];
    if (bar.open > entry * (1 + cfg.maxChasePct)) {
      return { endIndex: j, fields: { outcome: 'GAP_SKIP' } };
    }
    if (bar.high >= entry) {
      fillIdx = j;
      fillPrice = Math.max(bar.open, entry) * (1 + cfg.slippagePct);
      break;
    }
  }
  if (fillIdx < 0) {
    const outcome = signalIdx + cfg.entryWindowDays > bars.length - 1 ? 'OPEN' : 'NO_FILL';
    return { endIndex: lastEntryIdx, fields: { outcome } };
  }

  // Size from the planned levels like the live app, capped at the account's buying power.
  const planned = sizing.calculate({ entry, stop: initialStop, target: strategyTarget, accountSize: cfg.accountSize, riskPercent: cfg.riskPercent });
  const shares = Math.max(0, Math.min(planned.shares, Math.floor(cfg.accountSize / fillPrice)));

  const risk = fillPrice - initialStop;
  const target = plan.targetR === undefined ? strategyTarget
    : plan.targetR === null ? Infinity
    : entry + plan.targetR * (entry - initialStop);
  let stop = initialStop;
  let highest = -Infinity;

  // ── Manage: stop/target on daily high/low; both touched in one bar counts as a stop ──
  const lastHoldIdx = fillIdx + plan.maxHoldDays - 1;
  for (let k = fillIdx; k < bars.length; k++) {
    const bar = bars[k];
    const fillDay = k === fillIdx;
    let exit: { price: number; outcome: TradeOutcome } | null = null;

    if (!fillDay && bar.open <= stop) exit = { price: bar.open, outcome: 'STOP' };
    else if (!fillDay && bar.open >= target) exit = { price: bar.open, outcome: 'TARGET' };
    else if (bar.low <= stop) exit = { price: stop, outcome: 'STOP' };
    // On the fill day the intraday order of fill vs. high is unknown; only count a close above target.
    else if (bar.high >= target && (!fillDay || bar.close >= target)) exit = { price: target, outcome: 'TARGET' };
    else if (plan.exitAboveSma !== undefined && !fillDay && bar.close > sma(bars, k, plan.exitAboveSma)) {
      exit = { price: bar.close, outcome: bar.close >= fillPrice ? 'TARGET' : 'TIMEOUT' };
    }
    else if (k >= lastHoldIdx) exit = { price: bar.close, outcome: 'TIMEOUT' };

    if (exit) {
      const exitPrice = exit.price * (1 - cfg.slippagePct);
      return {
        endIndex: k,
        fields: {
          outcome: exit.outcome,
          fillDate: barDate(bars[fillIdx]),
          fillPrice: round(fillPrice),
          exitDate: barDate(bar),
          exitPrice: round(exitPrice),
          holdDays: k - fillIdx + 1,
          shares,
          rMultiple: risk > 0 ? round((exitPrice - fillPrice) / risk, 3) : 0,
          pnl: round((exitPrice - fillPrice) * shares),
        },
      };
    }

    // End-of-day stop adjustments take effect from the next bar.
    highest = Math.max(highest, bar.high);
    if (plan.breakevenAtR !== undefined && risk > 0 && highest >= fillPrice + plan.breakevenAtR * risk) {
      stop = Math.max(stop, fillPrice);
    }
    if (plan.trailAtrMult !== undefined && atr > 0) {
      stop = Math.max(stop, highest - plan.trailAtrMult * atr);
    }
  }

  return {
    endIndex: bars.length - 1,
    fields: { outcome: 'OPEN', fillDate: barDate(bars[fillIdx]), fillPrice: round(fillPrice), shares },
  };
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
