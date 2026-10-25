import { PaperExitReason, TradeSetup } from '../types';

export interface PushPayload {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

const money = (n: number) => `$${n.toFixed(2)}`;
const signedR = (r: number) => `${r >= 0 ? '+' : '−'}${Math.abs(r).toFixed(1)}R`;

const EXIT_LABELS: Record<PaperExitReason, string> = {
  TARGET: 'target', STOP: 'stop', TRAIL_STOP: 'trailing stop', TIME: 'time exit', SMA: 'exit signal',
  GAP_SKIP: 'skipped', NO_FILL: 'expired',
};

export function newSetupPayload(setup: TradeSetup): PushPayload {
  const exit = setup.exitPlan?.targetR === null ? 'trailing stop' : `Target ${money(setup.target)}`;
  return {
    title: `🎯 ${setup.symbol} — ${setup.strategy.replace('_', ' ')}`,
    body: `Entry ${money(setup.entry)} · Stop ${money(setup.stop)} · ${exit} · ${setup.confidence}% confidence`,
    data: { setupId: setup.id, type: 'NEW_SETUP' },
  };
}

/** Sent during market hours when a setup's entry is hit. */
export function fillPayload(fill: { setupId: string; symbol: string; fillPrice: number; stop: number }): PushPayload {
  return {
    title: `🟢 ${fill.symbol} triggered at ${money(fill.fillPrice)}`,
    body: `Entry hit · stop ${money(fill.stop)}. If you took it, record your fill in SwingFlow.`,
    data: { setupId: fill.setupId, type: 'SETUP_FILLED' },
  };
}

export interface DigestInput {
  newSetups: TradeSetup[];
  /** Fills that did not get their own push (e.g. detected only at the close). */
  fills: { symbol: string; fillPrice: number }[];
  /** Paper trades that closed today. */
  closes: { symbol: string; r: number; reason: PaperExitReason }[];
  /** Positions the user holds whose suggested stop rose above the stop they recorded. */
  stopRaises: { symbol: string; stop: number }[];
}

function list<T>(items: T[], fmt: (t: T) => string, max: number): string {
  const shown = items.slice(0, max).map(fmt).join(', ');
  return items.length > max ? `${shown} +${items.length - max} more` : shown;
}

/**
 * One push per user after the close. Returns null when there is nothing to say; a lone new
 * setup gets the regular new-setup push (it deep-links to the setup).
 */
export function dailyDigestPayload(d: DigestInput): PushPayload | null {
  const total = d.newSetups.length + d.fills.length + d.closes.length + d.stopRaises.length;
  if (total === 0) return null;
  if (total === 1 && d.newSetups.length === 1) return newSetupPayload(d.newSetups[0]);

  const parts: string[] = [];
  if (d.stopRaises.length) parts.push(`Raise stop: ${list(d.stopRaises, s => `${s.symbol} → ${money(s.stop)}`, 3)}`);
  if (d.newSetups.length) {
    parts.push(`${d.newSetups.length} new setup${d.newSetups.length > 1 ? 's' : ''}: ${list(d.newSetups, s => s.symbol, 4)}`);
  }
  if (d.fills.length) parts.push(`Triggered: ${list(d.fills, f => `${f.symbol} at ${money(f.fillPrice)}`, 3)}`);
  if (d.closes.length) parts.push(`Closed: ${list(d.closes, c => `${c.symbol} ${signedR(c.r)} (${EXIT_LABELS[c.reason]})`, 3)}`);

  return {
    title: 'SwingFlow · after the close',
    body: parts.join(' · '),
    data: { type: 'DAILY_DIGEST' },
  };
}
