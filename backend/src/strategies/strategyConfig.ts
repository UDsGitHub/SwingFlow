import { StrategyType } from '../types';
import { BaseStrategy } from './BaseStrategy';
import { TrendPullbackStrategy } from './TrendPullbackStrategy';
import { BreakoutStrategy } from './BreakoutStrategy';
import { ReversalStrategy } from './ReversalStrategy';

/** Trading days a setup waits for price to reach its entry before it expires. */
export const ENTRY_WINDOW_DAYS = 3;
/** A setup is skipped (not filled) when price opens more than this fraction above the entry. */
export const MAX_CHASE_PCT = 0.01;

/** True once ENTRY_WINDOW_DAYS completed sessions (ascending ET dates) have passed after the signal date. */
export function isEntryWindowOver(signalDate: string, sessionDates: string[]): boolean {
  return sessionDates.filter(d => d > signalDate).length >= ENTRY_WINDOW_DAYS;
}

/** How a filled trade is managed. Shared by the backtest and the live lifecycle tracker. */
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

/**
 * Exit rules per strategy, chosen by walk-forward backtest (tuned on 2016–2022, validated on
 * 2023+; see README "Strategy research"). Reversal lets winners run with a 3×ATR trail.
 */
export const EXIT_PLANS: Record<StrategyType, ExitPlan> = {
  REVERSAL:       { maxHoldDays: 40, targetR: null, trailAtrMult: 3 },
  TREND_PULLBACK: { maxHoldDays: 10 },
  BREAKOUT:       { maxHoldDays: 10 },
};

const ALL_STRATEGIES: Record<StrategyType, () => BaseStrategy> = {
  TREND_PULLBACK: () => new TrendPullbackStrategy(),
  BREAKOUT:       () => new BreakoutStrategy(),
  REVERSAL:       () => new ReversalStrategy(),
};

/**
 * Strategies that generate setups. Only Reversal held up out-of-sample; Trend Pullback and
 * Breakout showed no reliable edge. Override with ENABLED_STRATEGIES=REVERSAL,BREAKOUT,...
 */
export function enabledStrategyTypes(): StrategyType[] {
  const raw = process.env.ENABLED_STRATEGIES?.trim() || 'REVERSAL';
  return raw.split(',')
    .map(s => s.trim().toUpperCase())
    .filter((s): s is StrategyType => s in ALL_STRATEGIES);
}

export function createStrategies(types: StrategyType[] = enabledStrategyTypes()): BaseStrategy[] {
  return types.map(t => ALL_STRATEGIES[t]());
}

export const ALL_STRATEGY_TYPES = Object.keys(ALL_STRATEGIES) as StrategyType[];
