import { ExitPlan, Trade, TradeSetup } from '../types';

const num = (v: unknown): number | null => (v != null ? Number(v) : null);

/** Human-readable profit-taking rule for a setup, derived from its exit plan. */
export function describeExit(target: number, plan: ExitPlan | null): string {
  if (plan && plan.targetR === null) {
    const trail = plan.trailAtrMult ? `trail the stop ${plan.trailAtrMult}× ATR below the highest high` : 'hold';
    return `NO fixed target — ${trail}; exit after ${plan.maxHoldDays} sessions at most`;
  }
  return `TAKE profit near ${target.toFixed(2)} or trail into strength`;
}

export function mapTradeSetupRow(r: Record<string, unknown>): TradeSetup {
  const exitPlan = (r.exit_plan as ExitPlan | null) ?? null;
  const target = Number(r.target);
  return {
    id:               r.id as string,
    symbol:           r.symbol as string,
    strategy:         r.strategy as TradeSetup['strategy'],
    direction:        r.direction as TradeSetup['direction'],
    entry:            Number(r.entry),
    stop:             Number(r.stop),
    target,
    confidence:       Number(r.confidence),
    riskReward:       Number(r.risk_reward),
    detectedAt:       Number(r.detected_at),
    signalDate:       (r.signal_date as string | null) ?? null,
    status:           r.status as TradeSetup['status'],
    notes:            (r.notes as string) ?? '',
    stockSuggestion:  r.stock_suggestion as TradeSetup['stockSuggestion'],
    optionsSuggestion: r.options_suggestion as TradeSetup['optionsSuggestion'] ?? null,
    exitPlan,
    atrAtSignal:      num(r.atr_at_signal),
    currentStop:      num(r.current_stop) ?? Number(r.stop),
    entryHitAt:       num(r.entry_hit_at),
    paperFillPrice:   num(r.paper_fill_price),
    paperFillDate:    (r.paper_fill_date as string | null) ?? null,
    paperExitPrice:   num(r.paper_exit_price),
    paperExitDate:    (r.paper_exit_date as string | null) ?? null,
    paperExitReason:  (r.paper_exit_reason as TradeSetup['paperExitReason']) ?? null,
    paperR:           num(r.paper_r),
    sessionsHeld:     Number(r.sessions_held ?? 0),
    managedThrough:   (r.managed_through as string | null) ?? null,
    dismissedAt:      num(r.dismissed_at),
    score:            r.score != null ? Number(r.score) : Number(r.confidence),
    rank:             null,
    entryInstruction: `WAIT for break above ${Number(r.entry).toFixed(2)}`,
    invalidationInstruction: `INVALID if price drops below ${Number(r.stop).toFixed(2)}`,
    targetInstruction: describeExit(target, exitPlan),
  };
}

export function mapTradeRow(r: Record<string, unknown>): Trade {
  const setup = (r.trade_setups as { current_stop?: unknown; strategy?: string } | null) ?? null;
  return {
    id:          r.id as string,
    setupId:     (r.setup_id as string | null) ?? null,
    symbol:      r.symbol as string,
    direction:   r.direction as Trade['direction'],
    entryPrice:  Number(r.entry_price),
    shares:      Number(r.shares),
    stopPrice:   num(r.stop_price),
    status:      r.status as Trade['status'],
    openedAt:    Number(r.opened_at),
    exitPrice:   num(r.exit_price),
    closedAt:    num(r.closed_at),
    realizedPnl: num(r.realized_pnl),
    notes:       (r.notes as string | null) ?? null,
    suggestedStop: setup ? num(setup.current_stop) : null,
    strategy:    (setup?.strategy as Trade['strategy']) ?? null,
  };
}
