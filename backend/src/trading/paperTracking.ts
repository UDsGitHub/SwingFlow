/** Pure paper-tracking logic: turns stored setup rows + daily bars into rulebook state and events. */
import { computeIndicators } from '../indicators/technical';
import { completedBars, marketClock } from '../lib/marketTime';
import { ENTRY_WINDOW_DAYS, EXIT_PLANS, MAX_CHASE_PCT, SLIPPAGE_PCT } from '../strategies/strategyConfig';
import {
  BarView, TradeRules, TradeState, applyBar, initialTradeState, rMultiple,
} from './tradeStateMachine';
import { ExitPlan, OHLC, PaperExitReason, SetupStatus, StrategyType } from '../types';

/** Daily bars needed per symbol: covers the entry window + max hold + an ATR window for older rows. */
export const HISTORY_BARS = 200;
const ATR_WINDOW = 120;

const RULES: TradeRules = { entryWindowDays: ENTRY_WINDOW_DAYS, maxChasePct: MAX_CHASE_PCT, slippagePct: SLIPPAGE_PCT };

export type TrackingEventType = 'FILLED' | 'CLOSED' | 'EXPIRED' | 'SKIPPED' | 'STOP_RAISED';

export interface TrackingEvent {
  type: TrackingEventType;
  setupId: string;
  userId: string;
  symbol: string;
  dismissed: boolean;
  fillPrice?: number;
  stop?: number;
  previousStop?: number;
  exitReason?: PaperExitReason;
  r?: number;
}

/** Columns the tracker reads and writes on trade_setups. */
export interface TrackedRow {
  id: string;
  user_id: string;
  symbol: string;
  strategy: StrategyType;
  status: SetupStatus;
  entry: number;
  stop: number;
  target: number;
  signal_date: string | null;
  detected_at: number;
  exit_plan: ExitPlan | null;
  atr_at_signal: number | null;
  current_stop: number | null;
  highest_high: number | null;
  sessions_waited: number;
  sessions_held: number;
  paper_fill_price: number | null;
  paper_fill_date: string | null;
  managed_through: string | null;
  dismissed_at: number | null;
  tracking_version: number;
}

const toBarView = (b: OHLC): BarView => ({ date: marketClock(b.timestamp).date, open: b.open, high: b.high, low: b.low, close: b.close });

export function rowToState(row: TrackedRow, plan: ExitPlan): TradeState {
  const base = initialTradeState(Number(row.entry), Number(row.stop), Number(row.target), plan);
  return {
    ...base,
    phase: row.status === 'TRIGGERED' ? 'OPEN' : 'PENDING',
    stop: row.current_stop != null ? Number(row.current_stop) : base.stop,
    highest: row.highest_high != null ? Number(row.highest_high) : null,
    sessionsWaited: Number(row.sessions_waited ?? 0),
    sessionsHeld: Number(row.sessions_held ?? 0),
    fillPrice: row.paper_fill_price != null ? Number(row.paper_fill_price) : null,
    fillDate: row.paper_fill_date ?? null,
    managedThrough: row.managed_through ?? null,
  };
}

const STATUS_BY_PHASE: Record<TradeState['phase'], SetupStatus> = {
  PENDING: 'ACTIVE', OPEN: 'TRIGGERED', CLOSED: 'CLOSED', EXPIRED: 'EXPIRED', SKIPPED: 'SKIPPED',
};

export function stateToColumns(state: TradeState): Record<string, unknown> {
  const exitReason: PaperExitReason | null = state.phase === 'CLOSED' ? state.exitReason
    : state.phase === 'EXPIRED' ? 'NO_FILL'
    : state.phase === 'SKIPPED' ? 'GAP_SKIP'
    : null;
  return {
    status: STATUS_BY_PHASE[state.phase],
    current_stop: state.stop,
    highest_high: state.highest,
    sessions_waited: state.sessionsWaited,
    sessions_held: state.sessionsHeld,
    paper_fill_price: state.fillPrice,
    paper_fill_date: state.fillDate,
    paper_exit_price: state.exitPrice,
    paper_exit_date: state.exitDate,
    paper_exit_reason: exitReason,
    paper_r: rMultiple(state),
    managed_through: state.managedThrough,
  };
}

/** ATR at the signal: stored at creation, or recomputed from history for rows created before it was stored. */
function atrAtSignal(row: TrackedRow, bars: OHLC[], signalDate: string): number {
  if (row.atr_at_signal != null) return Number(row.atr_at_signal);
  const upToSignal = bars.filter(b => marketClock(b.timestamp).date <= signalDate).slice(-ATR_WINDOW);
  const atr = computeIndicators(upToSignal).atr14.at(-1);
  return atr !== undefined && Number.isFinite(atr) ? atr : NaN;
}

function sma(bars: OHLC[], idx: number, period: number): number | undefined {
  if (idx + 1 < period) return undefined;
  let sum = 0;
  for (let i = idx - period + 1; i <= idx; i++) sum += bars[i].close;
  return sum / period;
}

/**
 * Advance one setup through every completed session since it was last managed, then (when
 * allowed) through today's forming bar. Pure apart from the inputs; returns the new state.
 */
export function advanceSetup(
  row: TrackedRow,
  bars: OHLC[],
  now: number,
  includePartial: boolean,
): { state: TradeState; plan: ExitPlan; atr: number } {
  const plan = row.exit_plan ?? EXIT_PLANS[row.strategy];
  const signalDate = row.signal_date ?? marketClock(Number(row.detected_at)).date;
  const atr = atrAtSignal(row, bars, signalDate);
  let state = rowToState(row, plan);

  const today = marketClock(now).date;
  const finals = completedBars(bars, now);
  for (let i = 0; i < finals.length; i++) {
    const view = toBarView(finals[i]);
    if (view.date <= signalDate) continue;
    // Today's close belongs to the post-close run (it reports trail raises and exits in the digest).
    if (includePartial && view.date === today) continue;
    const smaClose = plan.exitAboveSma !== undefined ? sma(finals, i, plan.exitAboveSma) : undefined;
    state = applyBar(state, view, plan, RULES, { final: true, atr, smaClose });
  }

  const last = bars[bars.length - 1];
  const hasPartial = includePartial && last && finals.length < bars.length && toBarView(last).date === today && today > signalDate;
  if (hasPartial) state = applyBar(state, toBarView(last), plan, RULES, { final: false, atr });

  return { state, plan, atr };
}

export function eventsFor(row: TrackedRow, before: TradeState, after: TradeState): TrackingEvent[] {
  const base = { setupId: row.id, userId: row.user_id, symbol: row.symbol, dismissed: row.dismissed_at != null };
  const events: TrackingEvent[] = [];
  if (before.phase === 'PENDING' && after.fillPrice != null) {
    events.push({ ...base, type: 'FILLED', fillPrice: after.fillPrice, stop: after.initialStop });
  }
  if (after.phase === 'CLOSED') events.push({ ...base, type: 'CLOSED', exitReason: stateToColumns(after).paper_exit_reason as PaperExitReason, r: rMultiple(after) ?? 0 });
  else if (after.phase === 'EXPIRED') events.push({ ...base, type: 'EXPIRED' });
  else if (after.phase === 'SKIPPED') events.push({ ...base, type: 'SKIPPED' });
  else if (after.phase === 'OPEN' && after.stop > before.stop) {
    events.push({ ...base, type: 'STOP_RAISED', previousStop: before.stop, stop: after.stop });
  }
  return events;
}

