import { OHLC, RegimeSnapshot, StrategyType } from '../types';
import { computeIndicators } from '../indicators/technical';
import { BaseStrategy } from '../strategies/BaseStrategy';
import { allowsRegime } from '../strategies/regimeGate';
import { SetupScoringService } from '../services/SetupScoringService';
import { PositionSizingService } from '../services/PositionSizingService';
import { marketClock } from '../lib/marketTime';

export interface BacktestConfig {
  /** Bars passed to strategies each day — must match the live scan (120). */
  windowBars: number;
  /** Trading days a setup waits for price to reach its entry before expiring. */
  entryWindowDays: number;
  /** Trading days a filled trade is held before a time exit at the close. */
  maxHoldDays: number;
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

      const trade = simulateTrade(bars, i, result.entry, result.stop, result.target, cfg);
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
  stop: number,
  target: number,
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
  const planned = sizing.calculate({ entry, stop, target, accountSize: cfg.accountSize, riskPercent: cfg.riskPercent });
  const shares = Math.max(0, Math.min(planned.shares, Math.floor(cfg.accountSize / fillPrice)));

  // ── Manage: stop/target on daily high/low; both touched in one bar counts as a stop ──
  const lastHoldIdx = fillIdx + cfg.maxHoldDays - 1;
  for (let k = fillIdx; k < bars.length; k++) {
    const bar = bars[k];
    const fillDay = k === fillIdx;
    let exit: { price: number; outcome: TradeOutcome } | null = null;

    if (!fillDay && bar.open <= stop) exit = { price: bar.open, outcome: 'STOP' };
    else if (!fillDay && bar.open >= target) exit = { price: bar.open, outcome: 'TARGET' };
    else if (bar.low <= stop) exit = { price: stop, outcome: 'STOP' };
    // On the fill day the intraday order of fill vs. high is unknown; only count a close above target.
    else if (bar.high >= target && (!fillDay || bar.close >= target)) exit = { price: target, outcome: 'TARGET' };
    else if (k >= lastHoldIdx) exit = { price: bar.close, outcome: 'TIMEOUT' };

    if (exit) {
      const exitPrice = exit.price * (1 - cfg.slippagePct);
      const risk = fillPrice - stop;
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
  }

  return {
    endIndex: bars.length - 1,
    fields: { outcome: 'OPEN', fillDate: barDate(bars[fillIdx]), fillPrice: round(fillPrice), shares },
  };
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
