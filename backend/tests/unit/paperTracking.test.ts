import { describe, expect, it } from 'vitest';
import { TrackedRow, advanceSetup, eventsFor, rowToState, stateToColumns } from '../../src/trading/paperTracking';
import { realizedPnl, validatePrice, validateShares } from '../../src/trading/tradeMath';
import { summarizePaper, summarizeReal } from '../../src/services/recordStats';
import { describeExit } from '../../src/db/tradeSetupMapper';
import { etDayRange, marketClock } from '../../src/lib/marketTime';
import { EXIT_PLANS } from '../../src/strategies/strategyConfig';
import { barsFrom } from '../helpers/bars';

// Thu 2026-10-22 … Wed 2026-10-28 (weekdays). The signal bar is Thu 10-22.
type Row4 = [number, number, number, number];
const FLAT: Row4 = [98, 99, 97, 98];
function bars(after: Row4[], warmup = 30) {
  // 30 warm-up sessions ending on the signal day (so ATR exists), then the scenario sessions.
  const start = new Date('2026-10-22T12:00:00Z');
  let n = 0;
  while (n < warmup - 1) { start.setUTCDate(start.getUTCDate() - 1); if (start.getUTCDay() % 6 !== 0) n++; }
  return barsFrom([...Array(warmup).fill(FLAT), ...after], start.toISOString().slice(0, 10));
}

function row(overrides: Partial<TrackedRow> = {}): TrackedRow {
  return {
    id: 'setup-1', user_id: 'user_a', symbol: 'AXP', strategy: 'REVERSAL', status: 'ACTIVE',
    entry: 100, stop: 95, target: 112.5, signal_date: '2026-10-22', detected_at: Date.parse('2026-10-22T20:35:00Z'),
    exit_plan: { maxHoldDays: 40, targetR: null, trailAtrMult: 3 }, atr_at_signal: 2, current_stop: 95, highest_high: null,
    sessions_waited: 0, sessions_held: 0, paper_fill_price: null, paper_fill_date: null, managed_through: null,
    dismissed_at: null, tracking_version: 0, ...overrides,
  };
}

const at = (iso: string) => Date.parse(iso);

describe('advanceSetup', () => {
  it('applies every completed session after the signal, in order (catch-up after downtime)', () => {
    // Fri fills, Mon raises the trail, Tue stops out on the trail — processed in one run on Tue evening.
    const b = bars([[99, 101, 98, 100], [101, 110, 100, 109], [108, 109, 103, 104]]);
    const { state } = advanceSetup(row(), b, at('2026-10-27T20:35:00Z'), false);
    expect(state).toMatchObject({ phase: 'CLOSED', fillDate: '2026-10-23', exitReason: 'TRAIL_STOP', exitDate: '2026-10-27' });
    expect(state.exitPrice).toBeCloseTo(104 * (1 - 0.0005)); // 110 − 3×2, slippage applied
  });

  it('during market hours, applies today\'s forming bar as partial: fills, but no stop adjustment', () => {
    const b = bars([[99, 101, 98, 100.5]]);
    const { state } = advanceSetup(row(), b, at('2026-10-23T15:00:00Z'), true); // Fri 11:00 ET
    expect(state).toMatchObject({ phase: 'OPEN', fillDate: '2026-10-23', sessionsHeld: 0, managedThrough: null });
  });

  it('after the close, treats today\'s bar as final', () => {
    const { state } = advanceSetup(row(), bars([[99, 101, 98, 100.5]]), at('2026-10-23T20:35:00Z'), false);
    expect(state).toMatchObject({ phase: 'OPEN', sessionsHeld: 1, managedThrough: '2026-10-23' });
  });

  it('market-hours runs leave today\'s final bar to the post-close run', () => {
    const { state } = advanceSetup(row(), bars([[99, 101, 98, 100.5]]), at('2026-10-23T20:25:00Z'), true);
    expect(state).toMatchObject({ phase: 'PENDING', managedThrough: null });
  });

  it('ignores bars on or before the signal date', () => {
    const { state } = advanceSetup(row(), bars([]), at('2026-10-22T20:35:00Z'), false);
    expect(state).toMatchObject({ phase: 'PENDING', sessionsWaited: 0 });
  });

  it('resumes from stored state without re-applying managed sessions', () => {
    const stored = row({ status: 'TRIGGERED', paper_fill_price: 100, paper_fill_date: '2026-10-23', sessions_held: 1, managed_through: '2026-10-23', highest_high: 101, current_stop: 95 });
    // Fri's bar would stop out if re-applied; it must be skipped.
    const b = bars([[99, 101, 90, 100], [100, 102, 99, 101]]);
    const { state } = advanceSetup(stored, b, at('2026-10-26T20:35:00Z'), false);
    expect(state).toMatchObject({ phase: 'OPEN', sessionsHeld: 2, managedThrough: '2026-10-26' });
  });

  it('falls back to the strategy exit plan and recomputes ATR for rows created before they were stored', () => {
    const legacy = row({ exit_plan: null, atr_at_signal: null });
    const { plan, atr } = advanceSetup(legacy, bars([]), at('2026-10-22T20:35:00Z'), false);
    expect(plan).toEqual(EXIT_PLANS.REVERSAL);
    expect(atr).toBeCloseTo(2);
  });

  it('uses the detection date when a row has no signal date', () => {
    const { state } = advanceSetup(row({ signal_date: null }), bars([FLAT]), at('2026-10-23T20:35:00Z'), false);
    expect(state.sessionsWaited).toBe(1);
  });
});

describe('row ⇄ state mapping', () => {
  it('round-trips the stored tracking state', () => {
    const stored = row({ status: 'TRIGGERED', paper_fill_price: 100.05, paper_fill_date: '2026-10-23', sessions_held: 3, managed_through: '2026-10-27', highest_high: 108, current_stop: 102 });
    const state = rowToState(stored, EXIT_PLANS.REVERSAL);
    expect(state).toMatchObject({ phase: 'OPEN', stop: 102, highest: 108, fillPrice: 100.05, sessionsHeld: 3, target: null });
    expect(stateToColumns(state)).toMatchObject({
      status: 'TRIGGERED', current_stop: 102, highest_high: 108, paper_fill_price: 100.05, paper_fill_date: '2026-10-23',
      sessions_held: 3, managed_through: '2026-10-27', paper_exit_reason: null, paper_r: null,
    });
  });

  it('records the reason a setup never entered', () => {
    const base = rowToState(row(), EXIT_PLANS.REVERSAL);
    expect(stateToColumns({ ...base, phase: 'EXPIRED' })).toMatchObject({ status: 'EXPIRED', paper_exit_reason: 'NO_FILL' });
    expect(stateToColumns({ ...base, phase: 'SKIPPED' })).toMatchObject({ status: 'SKIPPED', paper_exit_reason: 'GAP_SKIP' });
  });
});

describe('eventsFor', () => {
  const r = row();
  const plan = EXIT_PLANS.REVERSAL;
  const pending = rowToState(r, plan);

  it('reports a fill, and a fill and a close in the same run', () => {
    const open = { ...pending, phase: 'OPEN' as const, fillPrice: 100, fillDate: '2026-10-23' };
    expect(eventsFor(r, pending, open)).toEqual([expect.objectContaining({ type: 'FILLED', fillPrice: 100, stop: 95 })]);
    const closed = { ...open, phase: 'CLOSED' as const, exitPrice: 95, exitReason: 'STOP' as const };
    expect(eventsFor(r, pending, closed).map(e => e.type)).toEqual(['FILLED', 'CLOSED']);
  });

  it('reports a trailing-stop raise only for an open position whose stop rose', () => {
    const open = { ...pending, phase: 'OPEN' as const, fillPrice: 100, stop: 95 };
    expect(eventsFor(r, open, { ...open, stop: 97 })).toEqual([expect.objectContaining({ type: 'STOP_RAISED', previousStop: 95, stop: 97 })]);
    expect(eventsFor(r, open, open)).toEqual([]);
  });

  it('flags dismissed setups so they can be kept out of notifications', () => {
    const expired = { ...pending, phase: 'EXPIRED' as const };
    expect(eventsFor(row({ dismissed_at: 1 }), pending, expired)).toEqual([expect.objectContaining({ type: 'EXPIRED', dismissed: true })]);
  });
});

describe('trade math', () => {
  it('computes long P&L to the cent', () => {
    expect(realizedPnl(98.35, 109.37, 17)).toBe(187.34);
    expect(realizedPnl(100, 95.004, 3)).toBe(-14.99);
  });

  it('validates prices and share counts', () => {
    expect([1, 0.01].every(validatePrice)).toBe(true);
    expect([0, -1, NaN, Infinity, '5', null].some(validatePrice)).toBe(false);
    expect(validateShares(17)).toBe(true);
    expect([0, 1.5, -2, '3'].some(validateShares)).toBe(false);
  });
});

describe('record summaries', () => {
  it('summarizes the paper record from closed paper trades only', () => {
    const s = summarizePaper([
      { status: 'CLOSED', paper_r: 2.6, paper_exit_reason: 'TRAIL_STOP', sessions_held: 12 },
      { status: 'CLOSED', paper_r: -1, paper_exit_reason: 'STOP', sessions_held: 4 },
      { status: 'TRIGGERED', paper_r: null, paper_exit_reason: null, sessions_held: 2 },
      { status: 'ACTIVE', paper_r: null, paper_exit_reason: null, sessions_held: 0 },
      { status: 'EXPIRED', paper_r: null, paper_exit_reason: 'NO_FILL', sessions_held: 0 },
      { status: 'SKIPPED', paper_r: null, paper_exit_reason: 'GAP_SKIP', sessions_held: 0 },
    ]);
    expect(s).toEqual({ closed: 2, wins: 1, winRate: 50, expectancyR: 0.8, avgHoldDays: 8, open: 1, waiting: 1, expired: 1, skipped: 1 });
  });

  it('summarizes real trades', () => {
    expect(summarizeReal([
      { status: 'CLOSED', realized_pnl: 187.34 }, { status: 'CLOSED', realized_pnl: -75.1 }, { status: 'OPEN', realized_pnl: null },
    ])).toEqual({ closed: 2, open: 1, wins: 1, winRate: 50, totalPnl: 112.24 });
    expect(summarizeReal([]).winRate).toBeNull();
  });
});

describe('etDayRange', () => {
  it('spans ET midnight to midnight', () => {
    const { start, end } = etDayRange('2026-10-23');
    expect(new Date(start).toISOString()).toBe('2026-10-23T04:00:00.000Z');
    expect(new Date(end).toISOString()).toBe('2026-10-24T04:00:00.000Z');
    expect(marketClock(start)).toMatchObject({ date: '2026-10-23', minutes: 0 });
  });

  it('is 23 hours on spring-forward day and 25 hours on fall-back day', () => {
    const spring = etDayRange('2026-03-08');
    const fall = etDayRange('2026-11-01');
    expect((spring.end - spring.start) / 3_600_000).toBe(23);
    expect((fall.end - fall.start) / 3_600_000).toBe(25);
  });
});

describe('describeExit', () => {
  it('describes a trailing exit with no fixed target', () => {
    expect(describeExit(112.5, { maxHoldDays: 40, targetR: null, trailAtrMult: 3 }))
      .toBe('NO fixed target — trail the stop 3× ATR below the highest high; exit after 40 sessions at most');
  });

  it('describes a fixed target', () => {
    expect(describeExit(112.5, { maxHoldDays: 10 })).toBe('TAKE profit near 112.50 or trail into strength');
    expect(describeExit(112.5, null)).toBe('TAKE profit near 112.50 or trail into strength');
  });
});
