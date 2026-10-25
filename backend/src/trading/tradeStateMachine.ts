import { ExitPlan } from '../types';

/**
 * The single rulebook for how a setup fills and exits, shared by the backtest (which feeds it
 * historical daily bars) and the live paper tracker (which feeds it today's bar as it forms).
 * Keeping one implementation guarantees live tracking behaves exactly like what was validated.
 *
 * Bars come in two kinds:
 * - final: a completed session. Every rule applies, including fill-day target checks, time
 *   exits and end-of-day stop adjustments (trail / break-even).
 * - partial: today's still-forming bar. Only events later prices cannot undo are applied — a
 *   fill, a gap skip, a stop touch, or an open beyond the stop/target. A target touch waits for
 *   the final bar because the same session could still reach the stop (which counts as a stop).
 */

export type TradePhase = 'PENDING' | 'OPEN' | 'CLOSED' | 'EXPIRED' | 'SKIPPED';
export type ExitReason = 'TARGET' | 'STOP' | 'TRAIL_STOP' | 'TIME' | 'SMA';

export interface TradeState {
  phase: TradePhase;
  entry: number;
  initialStop: number;
  /** Resolved profit target; null when the exit plan has no fixed target. */
  target: number | null;
  /** Current stop (rises with trail / break-even, never falls). */
  stop: number;
  /** Highest high since the fill (set by final bars only). */
  highest: number | null;
  /** Final sessions seen while waiting for the entry. */
  sessionsWaited: number;
  /** Final sessions completed while the trade was open (the fill day counts). */
  sessionsHeld: number;
  fillPrice: number | null;
  fillDate: string | null;
  exitPrice: number | null;
  exitDate: string | null;
  exitReason: ExitReason | null;
  /** ET date of the last final bar applied; bars on or before it are ignored. */
  managedThrough: string | null;
}

export interface TradeRules {
  entryWindowDays: number;
  maxChasePct: number;
  slippagePct: number;
}

export interface BarView {
  /** ET trading date, YYYY-MM-DD */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface BarContext {
  final: boolean;
  /** ATR at the signal, used by the chandelier trail. */
  atr: number;
  /** N-day SMA of closes including this bar, when the plan exits above an SMA. */
  smaClose?: number;
}

export function isTerminal(state: TradeState): boolean {
  return state.phase === 'CLOSED' || state.phase === 'EXPIRED' || state.phase === 'SKIPPED';
}

export function initialTradeState(entry: number, initialStop: number, strategyTarget: number, plan: ExitPlan): TradeState {
  const target = plan.targetR === undefined ? strategyTarget
    : plan.targetR === null ? null
    : entry + plan.targetR * (entry - initialStop);
  return {
    phase: 'PENDING', entry, initialStop, target, stop: initialStop, highest: null,
    sessionsWaited: 0, sessionsHeld: 0, fillPrice: null, fillDate: null,
    exitPrice: null, exitDate: null, exitReason: null, managedThrough: null,
  };
}

/** R multiple of a closed trade, measured against the risk at the actual fill. */
export function rMultiple(state: TradeState): number | null {
  if (state.phase !== 'CLOSED' || state.fillPrice == null || state.exitPrice == null) return null;
  const risk = state.fillPrice - state.initialStop;
  return risk > 0 ? (state.exitPrice - state.fillPrice) / risk : 0;
}

/** Apply one daily bar. Pure: returns a new state (or the same one when nothing applies). */
export function applyBar(state: TradeState, bar: BarView, plan: ExitPlan, rules: TradeRules, ctx: BarContext): TradeState {
  if (isTerminal(state)) return state;
  if (state.managedThrough && bar.date <= state.managedThrough) return state;

  const s: TradeState = { ...state };

  if (s.phase === 'PENDING') {
    if (bar.open > s.entry * (1 + rules.maxChasePct)) {
      return { ...s, phase: 'SKIPPED', exitDate: bar.date, managedThrough: ctx.final ? bar.date : s.managedThrough };
    }
    if (bar.high >= s.entry) {
      s.phase = 'OPEN';
      s.fillPrice = Math.max(bar.open, s.entry) * (1 + rules.slippagePct);
      s.fillDate = bar.date;
      // Fall through: the fill bar is also managed (fill-day rules).
    } else {
      if (!ctx.final) return s;
      s.sessionsWaited += 1;
      s.managedThrough = bar.date;
      if (s.sessionsWaited >= rules.entryWindowDays) {
        s.phase = 'EXPIRED';
        s.exitDate = bar.date;
      }
      return s;
    }
  }

  // OPEN
  const fillDay = bar.date === s.fillDate;
  let exit: { price: number; reason: ExitReason } | null = null;

  if (!fillDay && bar.open <= s.stop) exit = { price: bar.open, reason: 'STOP' };
  else if (!fillDay && s.target != null && bar.open >= s.target) exit = { price: bar.open, reason: 'TARGET' };
  else if (bar.low <= s.stop) exit = { price: s.stop, reason: 'STOP' };
  else if (ctx.final) {
    // On the fill day the intraday order of fill vs. high is unknown; only a close above the target counts.
    if (s.target != null && bar.high >= s.target && (!fillDay || bar.close >= s.target)) exit = { price: s.target, reason: 'TARGET' };
    else if (plan.exitAboveSma !== undefined && !fillDay && ctx.smaClose !== undefined && bar.close > ctx.smaClose) {
      exit = { price: bar.close, reason: 'SMA' };
    } else if (s.sessionsHeld + 1 >= plan.maxHoldDays) exit = { price: bar.close, reason: 'TIME' };
  }

  if (exit) {
    return {
      ...s,
      phase: 'CLOSED',
      exitPrice: exit.price * (1 - rules.slippagePct),
      exitDate: bar.date,
      exitReason: exit.reason === 'STOP' && s.stop > s.initialStop ? 'TRAIL_STOP' : exit.reason,
      sessionsHeld: s.sessionsHeld + 1,
      managedThrough: ctx.final ? bar.date : s.managedThrough,
    };
  }

  if (!ctx.final) return s;

  // End-of-day stop adjustments take effect from the next session.
  s.sessionsHeld += 1;
  s.highest = Math.max(s.highest ?? -Infinity, bar.high);
  const risk = (s.fillPrice as number) - s.initialStop;
  if (plan.breakevenAtR !== undefined && risk > 0 && s.highest >= (s.fillPrice as number) + plan.breakevenAtR * risk) {
    s.stop = Math.max(s.stop, s.fillPrice as number);
  }
  if (plan.trailAtrMult !== undefined && ctx.atr > 0) {
    s.stop = Math.max(s.stop, s.highest - plan.trailAtrMult * ctx.atr);
  }
  s.managedThrough = bar.date;
  return s;
}
