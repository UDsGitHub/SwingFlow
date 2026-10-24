import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { postCloseScan } from '../../src/scheduler/MarketScheduler';
import { evaluateMarket, runStrategyEngineWithDeveloping, scanSymbolsForUser } from '../../src/strategies/StrategyEngine';
import { expireStaleSetups } from '../../src/scheduler/expireSetups';
import { LIQUID_UNIVERSE } from '../../src/config/universe';
import { createUser, db, resetDb, setClock } from './helpers';

// Friday 2026-10-23, 16:35 ET. The deterministic mock market produces Reversal setups
// for AXP and CB on this session's close.
const FRIDAY_AFTER_CLOSE = '2026-10-23T20:35:00Z';
const EXPECTED_SYMBOLS = ['AXP', 'CB'];

async function setupsFor(userId?: string) {
  let q = db.from('trade_setups').select('user_id, symbol, strategy, status, signal_date');
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  vi.useRealTimers();
  delete process.env.MOCK_MARKET_TIME;
});

beforeEach(async () => {
  await resetDb();
  await createUser('user_a', ['COIN']);
  await createUser('user_b');
  setClock(FRIDAY_AFTER_CLOSE);
});

describe('scan coverage', () => {
  it('scans the liquid universe plus the user\'s watchlist favorites', async () => {
    const symbols = await scanSymbolsForUser('user_a');
    expect(symbols).toContain('COIN');
    expect(symbols).toEqual(expect.arrayContaining([...LIQUID_UNIVERSE]));
    expect(await scanSymbolsForUser('user_b')).not.toContain('COIN');
  });
});

describe('post-close scan', () => {
  it('creates Reversal setups for every user from the finished session and records the run', async () => {
    await postCloseScan();

    const { data: runs } = await db.from('scan_runs').select('*');
    expect(runs).toHaveLength(1);
    expect(runs![0]).toMatchObject({ kind: 'POST_CLOSE', session_date: '2026-10-23', status: 'DONE', users: 2, setups: 4, expired: 0 });

    const setups = await setupsFor();
    expect(setups).toHaveLength(4);
    for (const user of ['user_a', 'user_b']) {
      expect(setups.filter(s => s.user_id === user).map(s => s.symbol).sort()).toEqual(EXPECTED_SYMBOLS);
    }
    expect(setups.every(s => s.strategy === 'REVERSAL' && s.status === 'ACTIVE' && s.signal_date === '2026-10-23')).toBe(true);

    const { count } = await db.from('scan_evaluations').select('*', { count: 'exact', head: true });
    expect(count).toBeGreaterThanOrEqual(2 * LIQUID_UNIVERSE.length);
  });

  it('runs at most once per session', async () => {
    await postCloseScan();
    await postCloseScan();
    expect(await setupsFor()).toHaveLength(4);
    const { data: runs } = await db.from('scan_runs').select('id');
    expect(runs).toHaveLength(1);
  });

  it('runs once even when several instances start it at the same moment', async () => {
    await Promise.all([postCloseScan(), postCloseScan(), postCloseScan()]);
    expect(await setupsFor()).toHaveLength(4);
    const { data: runs } = await db.from('scan_runs').select('status');
    expect(runs).toEqual([{ status: 'DONE' }]);
  });

  it('records a weekend or holiday as MARKET_CLOSED and creates nothing', async () => {
    setClock('2026-10-24T20:35:00Z'); // Saturday
    await postCloseScan();
    const { data: run } = await db.from('scan_runs').select('status').eq('session_date', '2026-10-24').single();
    expect(run?.status).toBe('MARKET_CLOSED');
    expect(await setupsFor()).toHaveLength(0);
  });

  it('retries a run that previously FAILED', async () => {
    await db.from('scan_runs').insert({ kind: 'POST_CLOSE', session_date: '2026-10-23', status: 'FAILED', started_at: Date.now() });
    await postCloseScan();
    const { data: run } = await db.from('scan_runs').select('status').eq('session_date', '2026-10-23').single();
    expect(run?.status).toBe('DONE');
    expect(await setupsFor()).toHaveLength(4);
  });
});

describe('manual scan', () => {
  it('does not duplicate an ACTIVE setup', async () => {
    const symbols = await scanSymbolsForUser('user_a');
    const first = await runStrategyEngineWithDeveloping(symbols, 'user_a');
    const second = await runStrategyEngineWithDeveloping(symbols, 'user_a');
    expect(first.setups.map(s => s.symbol).sort()).toEqual(EXPECTED_SYMBOLS);
    expect(second.setups).toHaveLength(0);
    expect(second.evaluations.filter(e => e.result === 'SKIPPED_DUPLICATE').map(e => e.symbol).sort()).toEqual(EXPECTED_SYMBOLS);
    expect(await setupsFor('user_a')).toHaveLength(2);
  });

  it('only creates setups for the requesting user', async () => {
    await runStrategyEngineWithDeveloping(await scanSymbolsForUser('user_a'), 'user_a');
    expect(await setupsFor('user_b')).toHaveLength(0);
  });

  it('mid-session, judges the last completed candle instead of today\'s forming one', async () => {
    setClock('2026-10-23T15:00:00Z'); // Friday 11:00 ET
    const snapshot = await evaluateMarket(['AXP']);
    expect(snapshot.asOfDate).toBe('2026-10-22');
    expect(snapshot.bySymbol.get('AXP')?.signalDate).toBe('2026-10-22');
  });

  it('persists developing candidates for the dashboard', async () => {
    const run = await runStrategyEngineWithDeveloping(await scanSymbolsForUser('user_a'), 'user_a');
    expect(run.developing.length).toBeGreaterThan(0);
    expect(run.developing.every(d => d.strategy === 'REVERSAL')).toBe(true);
  });
});

describe('setup expiry and the one-active-setup rule', () => {
  it('expires unfilled setups after the 3rd session, then allows fresh setups', async () => {
    await postCloseScan();
    expect(await expireStaleSetups(['2026-10-23', '2026-10-26', '2026-10-27'])).toBe(0);
    expect(await expireStaleSetups(['2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28'])).toBe(4);
    expect((await setupsFor()).every(s => s.status === 'EXPIRED')).toBe(true);

    const again = await runStrategyEngineWithDeveloping(await scanSymbolsForUser('user_a'), 'user_a');
    expect(again.setups.map(s => s.symbol).sort()).toEqual(EXPECTED_SYMBOLS);
  });

  it('rejects a second ACTIVE row for the same user, symbol and strategy at the database level', async () => {
    const row = { user_id: 'user_a', symbol: 'AXP', strategy: 'REVERSAL', direction: 'LONG', entry: 1, stop: 0.9, target: 1.2, confidence: 70, risk_reward: 2, detected_at: Date.now(), status: 'ACTIVE' };
    expect((await db.from('trade_setups').insert(row)).error).toBeNull();
    expect((await db.from('trade_setups').insert(row)).error?.code).toBe('23505');
    expect((await db.from('trade_setups').insert({ ...row, status: 'EXPIRED' })).error).toBeNull();
  });
});
