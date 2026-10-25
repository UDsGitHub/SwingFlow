import { PaperExitReason, TradeSetup } from '../types';

export const STRATEGY_LABELS: Record<string, string> = {
  TREND_PULLBACK: 'Trend Pullback',
  BREAKOUT:       'Breakout',
  REVERSAL:       'Reversal',
};

export const EXIT_REASON_LABELS: Record<PaperExitReason, string> = {
  TARGET:     'Target',
  STOP:       'Stop',
  TRAIL_STOP: 'Trailing stop',
  TIME:       'Time exit',
  SMA:        'Exit signal',
  GAP_SKIP:   'Gapped past entry',
  NO_FILL:    'Entry never hit',
};

/** False when the exit plan has no fixed profit target (exits by trailing stop or time). */
export function hasFixedTarget(setup: Pick<TradeSetup, 'exitPlan'>): boolean {
  return setup.exitPlan?.targetR !== null;
}

/** Short description of how the trade takes profit, e.g. "Trailing stop 3× ATR · up to 40 days". */
export function exitSummary(setup: Pick<TradeSetup, 'exitPlan' | 'target'>): string {
  const plan = setup.exitPlan;
  if (!plan || plan.targetR !== null) return `Target $${setup.target.toFixed(2)}`;
  const trail = plan.trailAtrMult ? `Trailing stop ${plan.trailAtrMult}× ATR` : 'No fixed target';
  return `${trail} · up to ${plan.maxHoldDays} days`;
}

export function formatR(r: number): string {
  return `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}R`;
}

export function formatMoney(n: number, signed = false): string {
  const sign = signed ? (n >= 0 ? '+' : '−') : n < 0 ? '−' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export type Tone = 'neutral' | 'up' | 'down' | 'muted' | 'brand';

/** Paper status of a setup as a label and tone, e.g. "Closed +1.8R". */
export function paperStatus(setup: Pick<TradeSetup, 'status' | 'paperR' | 'paperFillPrice'>): { label: string; tone: Tone } {
  switch (setup.status) {
    case 'ACTIVE':    return { label: 'Waiting for entry', tone: 'neutral' };
    case 'TRIGGERED': return { label: setup.paperFillPrice != null ? `Triggered $${setup.paperFillPrice.toFixed(2)}` : 'Triggered', tone: 'brand' };
    case 'CLOSED': {
      const r = setup.paperR ?? 0;
      return { label: `Closed ${formatR(r)}`, tone: r > 0 ? 'up' : r < 0 ? 'down' : 'neutral' };
    }
    case 'EXPIRED':   return { label: 'Expired', tone: 'muted' };
    case 'SKIPPED':   return { label: 'Skipped (gap)', tone: 'muted' };
  }
}

export const TONE_BADGE: Record<Tone, string> = {
  neutral: 'border border-surface-500 text-gray-300 bg-surface-700/50',
  brand:   'border border-brand-500/40 text-brand-300 bg-brand-500/10',
  up:      'border border-bull-500/30 text-data-up bg-bull-500/5',
  down:    'border border-bear-500/30 text-data-down bg-bear-500/5',
  muted:   'border border-surface-600 text-gray-400 bg-surface-800',
};

/** True when the trailing stop has moved above the stop the user has at their broker. */
export function shouldRaiseStop(trade: { stopPrice: number | null; suggestedStop: number | null }): boolean {
  return trade.suggestedStop != null && (trade.stopPrice == null || trade.suggestedStop > trade.stopPrice + 0.005);
}
