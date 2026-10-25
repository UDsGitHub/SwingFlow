import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createUser, db, resetDb } from './helpers';

// Stand-in for Clerk: the signed-in user comes from a test header.
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: { headers: Record<string, string | undefined> }) => ({ userId: req.headers['x-test-user'] ?? null }),
}));

let app: Express;
const as = (user: string) => ({
  get: (url: string) => request(app).get(url).set('x-test-user', user),
  post: (url: string) => request(app).post(url).set('x-test-user', user),
  patch: (url: string) => request(app).patch(url).set('x-test-user', user),
  delete: (url: string) => request(app).delete(url).set('x-test-user', user),
});
const alice = () => as('user_a');
const bob = () => as('user_b');

async function insertSetup(fields: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await db.from('trade_setups').insert({
    user_id: 'user_a', symbol: 'AXP', strategy: 'REVERSAL', direction: 'LONG', entry: 98.35, stop: 93.94, current_stop: 95.1,
    target: 109.37, confidence: 75, risk_reward: 2.5, detected_at: Date.now(), signal_date: '2026-10-23', status: 'ACTIVE',
    stock_suggestion: { shares: 17, capitalRequired: 1671.95, riskDollars: 75, potentialGainDollars: 187.34 },
    exit_plan: { maxHoldDays: 40, targetR: null, trailAtrMult: 3 }, ...fields,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  app = (await import('../../src/app')).createApp();
});
afterAll(() => vi.useRealTimers());

beforeEach(async () => {
  vi.useRealTimers();
  await resetDb();
  await createUser('user_a');
  await createUser('user_b');
});

describe('auth', () => {
  it('rejects unauthenticated requests', async () => {
    expect((await request(app).get('/api/trades')).status).toBe(401);
  });
});

describe('taking a setup', () => {
  it('opens a real trade, defaulting the stop to the current paper stop', async () => {
    const id = await insertSetup();
    const res = await alice().post(`/api/setups/${id}/take`).send({ fillPrice: 98.4, shares: 17 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ setupId: id, symbol: 'AXP', entryPrice: 98.4, shares: 17, stopPrice: 95.1, status: 'OPEN', suggestedStop: 95.1, strategy: 'REVERSAL' });
  });

  it('accepts an explicit broker stop', async () => {
    const id = await insertSetup();
    expect((await alice().post(`/api/setups/${id}/take`).send({ fillPrice: 98.4, shares: 17, stopPrice: 94 })).body.stopPrice).toBe(94);
  });

  it.each([
    [{ fillPrice: 0, shares: 17 }, /fillPrice/],
    [{ fillPrice: '98', shares: 17 }, /fillPrice/],
    [{ fillPrice: 98, shares: 1.5 }, /shares/],
    [{ fillPrice: 98, shares: 0 }, /shares/],
    [{ fillPrice: 98, shares: 5, stopPrice: -1 }, /stopPrice/],
  ])('validates %j', async (body, message) => {
    const id = await insertSetup();
    const res = await alice().post(`/api/setups/${id}/take`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });

  it('allows one open trade per setup', async () => {
    const id = await insertSetup();
    await alice().post(`/api/setups/${id}/take`).send({ fillPrice: 98.4, shares: 17 });
    expect((await alice().post(`/api/setups/${id}/take`).send({ fillPrice: 98.4, shares: 17 })).status).toBe(409);
  });

  it('cannot take another user\'s setup', async () => {
    const id = await insertSetup();
    expect((await bob().post(`/api/setups/${id}/take`).send({ fillPrice: 98.4, shares: 17 })).status).toBe(404);
  });

  it('can take a setup whose paper trade was skipped (the user bought anyway)', async () => {
    const id = await insertSetup({ status: 'SKIPPED', paper_exit_reason: 'GAP_SKIP' });
    expect((await alice().post(`/api/setups/${id}/take`).send({ fillPrice: 101, shares: 10 })).status).toBe(201);
  });
});

describe('managing and closing a trade', () => {
  async function openTrade() {
    const id = await insertSetup();
    return (await alice().post(`/api/setups/${id}/take`).send({ fillPrice: 98.35, shares: 17 })).body.id as string;
  }

  it('closes with realized P&L and lists open and closed trades', async () => {
    const tradeId = await openTrade();
    expect((await alice().get('/api/trades?status=OPEN')).body).toHaveLength(1);
    const res = await alice().patch(`/api/trades/${tradeId}/close`).send({ exitPrice: 109.37 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'CLOSED', exitPrice: 109.37, realizedPnl: 187.34 });
    expect((await alice().get('/api/trades?status=OPEN')).body).toHaveLength(0);
    expect((await alice().get('/api/trades?status=CLOSED')).body).toHaveLength(1);
  });

  it('refuses to close twice, including two closes racing', async () => {
    const tradeId = await openTrade();
    const [a, b] = await Promise.all([
      alice().patch(`/api/trades/${tradeId}/close`).send({ exitPrice: 100 }),
      alice().patch(`/api/trades/${tradeId}/close`).send({ exitPrice: 101 }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await alice().patch(`/api/trades/${tradeId}/close`).send({ exitPrice: 102 })).status).toBe(409);
  });

  it('validates the exit price and hides other users\' trades', async () => {
    const tradeId = await openTrade();
    expect((await alice().patch(`/api/trades/${tradeId}/close`).send({ exitPrice: -5 })).status).toBe(400);
    expect((await bob().patch(`/api/trades/${tradeId}/close`).send({ exitPrice: 100 })).status).toBe(404);
    expect((await bob().get('/api/trades')).body).toEqual([]);
    expect((await alice().get('/api/trades?status=BOGUS')).status).toBe(400);
  });

  it('updates the broker stop after a "raise your stop" alert', async () => {
    const tradeId = await openTrade();
    expect((await alice().patch(`/api/trades/${tradeId}`).send({ stopPrice: 97.5 })).body.stopPrice).toBe(97.5);
    expect((await alice().patch(`/api/trades/${tradeId}`).send({ stopPrice: 0 })).status).toBe(400);
    expect((await alice().patch(`/api/trades/${tradeId}`).send({})).status).toBe(400);
    expect((await bob().patch(`/api/trades/${tradeId}`).send({ stopPrice: 97 })).status).toBe(404);
  });
});

describe('daily P&L (US Eastern day)', () => {
  it('counts real trades closed between ET midnight and midnight', async () => {
    const base = { user_id: 'user_a', symbol: 'AXP', entry_price: 100, shares: 1, status: 'CLOSED', opened_at: 0, exit_price: 101 };
    await db.from('trades').insert([
      { ...base, realized_pnl: 40, closed_at: Date.parse('2026-10-23T03:30:00Z') }, // Thu 23:30 ET — yesterday
      { ...base, realized_pnl: 25, closed_at: Date.parse('2026-10-23T04:30:00Z') }, // Fri 00:30 ET
      { ...base, realized_pnl: -10, closed_at: Date.parse('2026-10-24T03:30:00Z') }, // Fri 23:30 ET
      { ...base, realized_pnl: 99, closed_at: Date.parse('2026-10-24T04:30:00Z') }, // Sat 00:30 ET — tomorrow
    ]);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T20:00:00Z'));
    expect((await alice().get('/api/setups/daily-pnl')).body).toEqual({ pnl: 15 });
    expect((await bob().get('/api/setups/daily-pnl')).body).toEqual({ pnl: 0 });
  });
});

describe('setup list, dismissing and history', () => {
  it('lists waiting and open setups by default and hides dismissed ones', async () => {
    const waiting = await insertSetup();
    const open = await insertSetup({ symbol: 'CB', status: 'TRIGGERED' });
    await insertSetup({ symbol: 'T', status: 'EXPIRED' });
    expect((await alice().get('/api/setups')).body.map((s: { id: string }) => s.id).sort()).toEqual([waiting, open].sort());

    expect((await alice().delete(`/api/setups/${waiting}`)).status).toBe(200);
    expect((await alice().get('/api/setups')).body.map((s: { id: string }) => s.id)).toEqual([open]);
    expect((await alice().get('/api/setups?includeDismissed=true')).body).toHaveLength(2);
    const { data } = await db.from('trade_setups').select('status, dismissed_at').eq('id', waiting).single();
    expect(data).toMatchObject({ status: 'ACTIVE', dismissed_at: expect.any(Number) });
    expect((await alice().get('/api/setups/all')).body).toHaveLength(3);
  });

  it('rejects unknown statuses and 404s on other users\' setups', async () => {
    const id = await insertSetup();
    expect((await alice().get('/api/setups?status=TARGET_HIT')).status).toBe(400);
    expect((await bob().delete(`/api/setups/${id}`)).status).toBe(404);
    expect((await bob().get(`/api/setups/${id}`)).status).toBe(404);
  });

  it('no longer lets clients set arbitrary statuses', async () => {
    const id = await insertSetup();
    expect((await alice().patch(`/api/setups/${id}/status`).send({ status: 'CLOSED' })).status).toBe(404);
  });

  it('serializes the paper fields and the trailing-exit instruction', async () => {
    const id = await insertSetup({ status: 'CLOSED', paper_fill_price: 98.4, paper_fill_date: '2026-10-26', paper_exit_price: 104.1, paper_exit_date: '2026-11-04', paper_exit_reason: 'TRAIL_STOP', paper_r: 1.28, sessions_held: 8 });
    expect((await alice().get(`/api/setups/${id}`)).body).toMatchObject({
      status: 'CLOSED', paperFillPrice: 98.4, paperExitReason: 'TRAIL_STOP', paperR: 1.28, sessionsHeld: 8, currentStop: 95.1,
      exitPlan: { maxHoldDays: 40, targetR: null, trailAtrMult: 3 },
      targetInstruction: expect.stringMatching(/^NO fixed target/),
    });
  });
});

describe('legacy close endpoint (one release)', () => {
  it('records a closed trade at the planned entry and size', async () => {
    const id = await insertSetup();
    const res = await alice().patch(`/api/setups/${id}/close`).send({ exitPrice: 109.37 });
    expect(res.body).toEqual({ success: true, realizedPnl: 187.34 });
    expect((await alice().get('/api/trades?status=CLOSED')).body[0]).toMatchObject({ setupId: id, entryPrice: 98.35, shares: 17 });
  });

  it('closes an existing open trade instead of creating another', async () => {
    const id = await insertSetup();
    await alice().post(`/api/setups/${id}/take`).send({ fillPrice: 99, shares: 10 });
    expect((await alice().patch(`/api/setups/${id}/close`).send({ exitPrice: 100 })).body.realizedPnl).toBe(10);
    expect((await alice().get('/api/trades')).body).toHaveLength(1);
  });
});

describe('analytics', () => {
  it('reports the paper record and the real record separately', async () => {
    await insertSetup({ status: 'CLOSED', paper_r: 2, sessions_held: 10 });
    await insertSetup({ symbol: 'CB', status: 'CLOSED', paper_r: -1, sessions_held: 4 });
    await insertSetup({ symbol: 'T', status: 'EXPIRED' });
    await db.from('trades').insert({ user_id: 'user_a', symbol: 'AXP', entry_price: 100, shares: 1, status: 'CLOSED', opened_at: 0, exit_price: 120, closed_at: 1, realized_pnl: 20 });
    const res = await alice().get('/api/setups/analytics');
    expect(res.body.paper).toMatchObject({ closed: 2, wins: 1, winRate: 50, expectancyR: 0.5, expired: 1 });
    expect(res.body.real).toMatchObject({ closed: 1, wins: 1, totalPnl: 20 });
  });
});
