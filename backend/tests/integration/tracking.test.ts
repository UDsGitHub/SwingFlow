import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { postCloseScan } from '../../src/scheduler/MarketScheduler';
import { trackOpenSetups } from '../../src/services/PaperTradeTracker';
import { collectDigest, sendFillAlerts } from '../../src/scheduler/trackingNotifications';
import { NotificationService } from '../../src/services/NotificationService';
import { MockDataProvider } from '../../src/providers/MockDataProvider';
import { marketClock } from '../../src/lib/marketTime';
import { applyBar, initialTradeState, isTerminal } from '../../src/trading/tradeStateMachine';
import { ENTRY_WINDOW_DAYS, EXIT_PLANS, MAX_CHASE_PCT, SLIPPAGE_PCT } from '../../src/strategies/strategyConfig';
import { OHLC } from '../../src/types';
import { LIQUID_UNIVERSE } from '../../src/config/universe';
import { createUser, db, resetDb, setClock } from './helpers';

const FRIDAY = '2026-10-23';
const RULES = { entryWindowDays: ENTRY_WINDOW_DAYS, maxChasePct: MAX_CHASE_PCT, slippagePct: SLIPPAGE_PCT };

/** Weekday ET dates after `from` (the mock market has no holidays). */
function sessionsAfter(from: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  while (out.length < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
const midday = (date: string) => `${date}T15:30:00Z`;    // 11:30 ET (EDT) / 10:30 (EST)
const afterClose = (date: string) => `${date}T21:40:00Z`; // after 16:20 ET in both EDT and EST

/** Completed mock bars for a symbol, as seen long after the dates under test. */
async function mockBars(symbol: string): Promise<OHLC[]> {
  const saved = process.env.MOCK_MARKET_TIME;
  process.env.MOCK_MARKET_TIME = '2027-03-31T21:00:00Z';
  const bars = await new MockDataProvider().getHistoricalPrices(symbol, 400);
  process.env.MOCK_MARKET_TIME = saved;
  return bars;
}
const barOn = (bars: OHLC[], date: string) => bars.find(b => marketClock(b.timestamp).date === date)!;

let seq = 0;
async function insertSetup(fields: Record<string, unknown>): Promise<string> {
  const { data, error } = await db.from('trade_setups').insert({
    user_id: 'user_a', symbol: `SYM${seq++}`, strategy: 'REVERSAL', direction: 'LONG', confidence: 70, risk_reward: 2.5,
    detected_at: Date.parse(afterClose(FRIDAY)), signal_date: FRIDAY, status: 'ACTIVE', target: 999,
    exit_plan: EXIT_PLANS.REVERSAL, atr_at_signal: 2, ...fields,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}
const getSetup = async (id: string) => (await db.from('trade_setups').select('*').eq('id', id).single()).data!;

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => { vi.useRealTimers(); delete process.env.MOCK_MARKET_TIME; });

beforeEach(async () => {
  await resetDb();
  await createUser('user_a');
  await createUser('user_b');
  setClock(afterClose(FRIDAY));
});

describe('multi-day paper lifecycle', () => {
  it('tracks scan-created setups through intraday and post-close runs exactly like the pure rulebook', async () => {
    await postCloseScan();
    const { data: created } = await db.from('trade_setups').select('*').eq('user_id', 'user_a');
    expect(created!.map(s => s.symbol).sort()).toEqual(['AXP', 'CB']);

    const sessions = sessionsAfter(FRIDAY, 50);
    for (const day of sessions) {
      setClock(midday(day));
      await trackOpenSetups('intraday');
      setClock(afterClose(day));
      await trackOpenSetups('postClose');
      const { data: open } = await db.from('trade_setups').select('id').in('status', ['ACTIVE', 'TRIGGERED']);
      if (!open!.length) break;
    }

    for (const s of created!) {
      const bars = await mockBars(s.symbol);
      const plan = EXIT_PLANS.REVERSAL;
      let expected = initialTradeState(Number(s.entry), Number(s.stop), Number(s.target), plan);
      for (const b of bars) {
        const date = marketClock(b.timestamp).date;
        if (date <= FRIDAY || isTerminal(expected)) continue;
        expected = applyBar(expected, { date, open: b.open, high: b.high, low: b.low, close: b.close }, plan, RULES, { final: true, atr: Number(s.atr_at_signal) });
      }
      const actual = await getSetup(s.id);
      const expectedStatus = { PENDING: 'ACTIVE', OPEN: 'TRIGGERED', CLOSED: 'CLOSED', EXPIRED: 'EXPIRED', SKIPPED: 'SKIPPED' }[expected.phase];
      expect({ symbol: s.symbol, status: actual.status, fill: actual.paper_fill_date, exit: actual.paper_exit_date, held: actual.sessions_held })
        .toEqual({ symbol: s.symbol, status: expectedStatus, fill: expected.fillDate, exit: expected.exitDate, held: expected.sessionsHeld });
      if (expected.phase === 'CLOSED') {
        expect(Number(actual.paper_exit_price)).toBeCloseTo(expected.exitPrice!, 6);
        expect(actual.paper_exit_reason).toBe(expected.exitReason);
      }
    }
  });
});

describe('entry window', () => {
  it('expires a setup that never fills after exactly 3 sessions', async () => {
    const id = await insertSetup({ entry: 1e6, stop: 1, current_stop: 1, symbol: 'AXP' });
    const [mon, tue, wed] = sessionsAfter(FRIDAY, 3);
    for (const day of [mon, tue]) { setClock(afterClose(day)); await trackOpenSetups('postClose'); }
    expect((await getSetup(id)).status).toBe('ACTIVE');
    setClock(afterClose(wed));
    const events = await trackOpenSetups('postClose');
    expect(await getSetup(id)).toMatchObject({ status: 'EXPIRED', paper_exit_reason: 'NO_FILL', sessions_waited: 3, managed_through: wed });
    expect(events.map(e => e.type)).toEqual(['EXPIRED']);
  });

  it('a fill on the last window session keeps the setup open', async () => {
    const [mon, tue, wed] = sessionsAfter(FRIDAY, 3);
    // Find a symbol whose Wednesday high exceeds Mon/Tue highs and Wednesday's open (so an entry
    // between them fills on Wednesday only, without a gap skip).
    let pick: { symbol: string; entry: number } | null = null;
    for (const symbol of LIQUID_UNIVERSE) {
      const bars = await mockBars(symbol);
      const entry = Math.max(barOn(bars, mon).high, barOn(bars, tue).high, barOn(bars, wed).open) * 1.0001;
      if (entry < barOn(bars, wed).high) { pick = { symbol, entry }; break; }
    }
    expect(pick, 'a symbol that fills on the 3rd session').not.toBeNull();
    const { symbol, entry } = pick!;
    const id = await insertSetup({ symbol, entry, stop: entry * 0.5, current_stop: entry * 0.5 });
    for (const day of [mon, tue, wed]) { setClock(afterClose(day)); await trackOpenSetups('postClose'); }
    expect(await getSetup(id)).toMatchObject({ status: 'TRIGGERED', paper_fill_date: wed });
  });

  it('skips the setup when price opens more than 1% above the entry', async () => {
    const bars = await mockBars('CB');
    const [mon] = sessionsAfter(FRIDAY, 1);
    const entry = barOn(bars, mon).open / 1.02;
    const id = await insertSetup({ symbol: 'CB', entry, stop: entry * 0.9, current_stop: entry * 0.9 });
    setClock(midday(mon));
    await trackOpenSetups('intraday');
    expect(await getSetup(id)).toMatchObject({ status: 'SKIPPED', paper_exit_reason: 'GAP_SKIP' });
  });
});

describe('intraday behaviour', () => {
  it('fills during market hours and sends one alert, then marks it notified', async () => {
    const bars = await mockBars('AXP');
    const [mon] = sessionsAfter(FRIDAY, 1);
    const entry = barOn(bars, mon).open; // touched at the open
    const id = await insertSetup({ symbol: 'AXP', entry, stop: entry * 0.5, current_stop: entry * 0.5 });

    setClock(midday(mon));
    const events = await trackOpenSetups('intraday');
    expect(events).toEqual([expect.objectContaining({ type: 'FILLED', setupId: id, fillPrice: expect.any(Number) })]);
    const setup = await getSetup(id);
    expect(setup).toMatchObject({ status: 'TRIGGERED', paper_fill_date: mon, sessions_held: 0, managed_through: null });
    expect(Number(setup.entry_hit_at)).toBe(Date.parse(midday(mon)));

    const notif = new NotificationService();
    const send = vi.spyOn(notif, 'send').mockResolvedValue(true);
    expect(await sendFillAlerts(events, notif)).toBe(1);
    expect(send).toHaveBeenCalledWith('user_a', expect.objectContaining({ data: { setupId: id, type: 'SETUP_FILLED' } }), id);
    expect((await getSetup(id)).fill_notified_at).not.toBeNull();

    // A second intraday run the same day changes nothing and reports nothing.
    expect(await trackOpenSetups('intraday')).toEqual([]);
  });

  it('does not alert for dismissed setups but keeps tracking them', async () => {
    const bars = await mockBars('AXP');
    const [mon] = sessionsAfter(FRIDAY, 1);
    const entry = barOn(bars, mon).open;
    const id = await insertSetup({ symbol: 'AXP', entry, stop: entry * 0.5, current_stop: entry * 0.5, dismissed_at: 1 });
    setClock(midday(mon));
    const events = await trackOpenSetups('intraday');
    expect((await getSetup(id)).status).toBe('TRIGGERED');
    const notif = new NotificationService();
    const send = vi.spyOn(notif, 'send').mockResolvedValue(true);
    expect(await sendFillAlerts(events, notif)).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('resilience', () => {
  it('catches up on sessions missed while the server was down, in order', async () => {
    const id = await insertSetup({ entry: 1e6, stop: 1, current_stop: 1, symbol: 'AXP' });
    const sessions = sessionsAfter(FRIDAY, 3);
    setClock(afterClose(sessions[2])); // nothing ran Mon or Tue
    await trackOpenSetups('postClose');
    expect(await getSetup(id)).toMatchObject({ status: 'EXPIRED', sessions_waited: 3, managed_through: sessions[2] });
  });

  it('applies each change once when two runs race (compare-and-set)', async () => {
    const id = await insertSetup({ entry: 1e6, stop: 1, current_stop: 1, symbol: 'AXP' });
    const [mon] = sessionsAfter(FRIDAY, 1);
    setClock(afterClose(mon));
    await Promise.all([trackOpenSetups('postClose'), trackOpenSetups('postClose'), trackOpenSetups('postClose')]);
    expect(await getSetup(id)).toMatchObject({ sessions_waited: 1, tracking_version: 1 });
  });

  it('reports each fill exactly once when runs race', async () => {
    const bars = await mockBars('AXP');
    const [mon] = sessionsAfter(FRIDAY, 1);
    const entry = barOn(bars, mon).open;
    await insertSetup({ symbol: 'AXP', entry, stop: entry * 0.5, current_stop: entry * 0.5 });
    setClock(midday(mon));
    const results = await Promise.all([trackOpenSetups('intraday'), trackOpenSetups('intraday')]);
    expect(results.flat().filter(e => e.type === 'FILLED')).toHaveLength(1);
  });

  it('backfills the exit plan and ATR for setups created before they were stored', async () => {
    const id = await insertSetup({ entry: 1e6, stop: 1, current_stop: 1, symbol: 'AXP', exit_plan: null, atr_at_signal: null });
    setClock(afterClose(sessionsAfter(FRIDAY, 1)[0]));
    await trackOpenSetups('postClose');
    const s = await getSetup(id);
    expect(s.exit_plan).toEqual(EXIT_PLANS.REVERSAL);
    expect(Number(s.atr_at_signal)).toBeGreaterThan(0);
  });
});

describe('post-close digest content', () => {
  it('collects new setups, unnotified fills, closes and stop raises for held positions only', async () => {
    const [mon] = sessionsAfter(FRIDAY, 1);
    const b = barOn(await mockBars('AXP'), mon);
    const c = barOn(await mockBars('CB'), mon);

    // Fills on Monday's open; never alerted intraday.
    const filled = await insertSetup({ symbol: 'AXP', entry: b.open, stop: b.open * 0.5, current_stop: b.open * 0.5 });
    // Already open; Monday's low takes out its stop.
    const stopped = await insertSetup({
      symbol: 'AXP', strategy: 'BREAKOUT', status: 'TRIGGERED', entry: b.open * 1.5, stop: b.low * 1.001, current_stop: b.low * 1.001,
      paper_fill_price: b.open * 1.5, paper_fill_date: FRIDAY, sessions_held: 1, managed_through: FRIDAY,
    });
    // Open with a tiny ATR, so the trail rises at the close. One held (with a lower broker stop), one not.
    const trail = (bar: OHLC, symbol: string) => ({
      symbol, strategy: 'TREND_PULLBACK', status: 'TRIGGERED', entry: bar.low * 0.5, stop: bar.low * 0.4, current_stop: bar.low * 0.4,
      atr_at_signal: 0.01, paper_fill_price: bar.low * 0.5, paper_fill_date: FRIDAY, sessions_held: 1, managed_through: FRIDAY,
      exit_plan: EXIT_PLANS.REVERSAL,
    });
    const held = await insertSetup(trail(b, 'AXP'));
    await insertSetup(trail(c, 'CB')); // not held: its stop raise is not worth a push
    await db.from('trades').insert({ user_id: 'user_a', setup_id: held, symbol: 'AXP', entry_price: b.low * 0.5, shares: 10, stop_price: b.low * 0.4, opened_at: Date.now() });

    setClock(afterClose(mon));
    const events = await trackOpenSetups('postClose');
    expect((await getSetup(stopped)).status).toBe('CLOSED');

    const { digest, fillIds } = await collectDigest('user_a', mon, [], events);
    expect(fillIds).toEqual([filled]);
    expect(digest.fills).toEqual([{ symbol: 'AXP', fillPrice: expect.any(Number) }]);
    expect(digest.closes).toEqual([{ symbol: 'AXP', r: expect.any(Number), reason: 'STOP' }]);
    expect(digest.stopRaises).toHaveLength(1);
    expect(digest.stopRaises[0].stop).toBeCloseTo(b.high - 3 * 0.01, 6);

    // Another user's digest is empty.
    const other = await collectDigest('user_b', mon, [], events);
    expect(other.digest).toEqual({ newSetups: [], fills: [], closes: [], stopRaises: [] });
  });
});
