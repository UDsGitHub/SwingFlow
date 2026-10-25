import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { supabaseAdmin } from '../db/supabase';
import { mapTradeSetupRow } from '../db/tradeSetupMapper';
import {
  fetchActiveDevelopingForUser,
  fetchDevelopingStats,
} from '../services/DevelopingPersistenceService';
import { closeTrade, dailyRealizedPnl, openTrade } from '../services/TradeService';
import { summarizePaper, summarizeReal } from '../services/recordStats';
import { SetupStatus } from '../types';
import { byExpectedValue } from '../config/edgeBaseline';

const router = Router();
router.use(requireAuth);

const row = mapTradeSetupRow;
const STATUSES: SetupStatus[] = ['ACTIVE', 'TRIGGERED', 'CLOSED', 'EXPIRED', 'SKIPPED'];

// GET /api/setups?status=ACTIVE,TRIGGERED — dismissed setups are hidden unless includeDismissed=true
router.get('/', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const statuses = String(req.query.status ?? 'ACTIVE,TRIGGERED').split(',').map(s => s.trim().toUpperCase());
  if (!statuses.every(s => (STATUSES as string[]).includes(s))) {
    return res.status(400).json({ error: `status must be one or more of ${STATUSES.join(', ')}` });
  }

  let q = supabaseAdmin
    .from('trade_setups')
    .select('*')
    .eq('user_id', userId)
    .in('status', statuses)
    .order('detected_at', { ascending: false });
  if (req.query.includeDismissed !== 'true') q = q.is('dismissed_at', null);

  const { data, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  // Highest expected value first (the backtest's portfolio takes same-day fills in this order).
  res.json((data ?? []).map(row).sort(byExpectedValue));
});

// GET /api/setups/all — every setup, including dismissed ones (history / strategy record)
router.get('/all', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;

  const { data, error } = await supabaseAdmin
    .from('trade_setups')
    .select('*')
    .eq('user_id', userId)
    .order('detected_at', { ascending: false })
    .limit(500);

  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map(row));
});

// GET /api/setups/daily-pnl — realized P&L of real trades closed today (US Eastern day)
router.get('/daily-pnl', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  try {
    res.json({ pnl: await dailyRealizedPnl(userId) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/setups/analytics — the strategy's paper record and the user's real record, kept apart
router.get('/analytics', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const since = Date.now() - weekMs;

  const [{ data: setups, error: e1 }, { data: trades, error: e2 }, { data: attempts }] = await Promise.all([
    supabaseAdmin.from('trade_setups').select('status, paper_r, paper_exit_reason, sessions_held, detected_at').eq('user_id', userId),
    supabaseAdmin.from('trades').select('status, realized_pnl').eq('user_id', userId),
    supabaseAdmin.from('notification_attempts').select('success').eq('user_id', userId).gte('attempted_at', since),
  ]);
  if (e1 || e2) return res.status(500).json({ error: (e1 ?? e2)!.message });

  const delivered = (attempts ?? []).filter(a => a.success).length;
  res.json({
    weekWindowMs: weekMs,
    setupsGeneratedThisWeek: (setups ?? []).filter(s => Number(s.detected_at) >= since).length,
    paper: summarizePaper(setups ?? []),
    real: summarizeReal(trades ?? []),
    notificationDeliveryRate: attempts?.length ? (delivered / attempts.length) * 100 : null,
  });
});

// GET /api/setups/developing — active developing candidates (must be before /:id)
router.get('/developing', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const list = await fetchActiveDevelopingForUser(userId, limit);
  res.json(list);
});

// GET /api/setups/developing-stats — counts for dashboard (must be before /:id)
router.get('/developing-stats', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const stats = await fetchDevelopingStats(userId);
  res.json(stats);
});

// GET /api/setups/scan-diagnostics
router.get('/scan-diagnostics', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const { data, error } = await supabaseAdmin
    .from('scan_evaluations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(150);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// GET /api/setups/:id
router.get('/:id', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;

  const { data, error } = await supabaseAdmin
    .from('trade_setups')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: 'Setup not found' });
  res.json(row(data));
});

// POST /api/setups/:id/take — the user took this setup: { fillPrice, shares, stopPrice? }
router.post('/:id/take', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const result = await openTrade(userId, req.params.id, {
    fillPrice: req.body?.fillPrice, shares: req.body?.shares, stopPrice: req.body?.stopPrice,
  });
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.status(201).json(result.trade);
});

// PATCH /api/setups/:id/close — DEPRECATED (kept one release for clients deployed before trades).
// Closes the user's open trade on the setup, opening one at the planned entry and size if needed.
router.patch('/:id/close', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const { data: open } = await supabaseAdmin
    .from('trades').select('id').eq('user_id', userId).eq('setup_id', req.params.id).eq('status', 'OPEN').maybeSingle();

  let tradeId = open?.id as string | undefined;
  if (!tradeId) {
    const { data: setup } = await supabaseAdmin
      .from('trade_setups').select('entry, stock_suggestion').eq('id', req.params.id).eq('user_id', userId).maybeSingle();
    if (!setup) return res.status(404).json({ error: 'Setup not found' });
    const shares = Math.max(1, Number((setup.stock_suggestion as { shares?: number } | null)?.shares ?? 1));
    const opened = await openTrade(userId, req.params.id, { fillPrice: Number(setup.entry), shares });
    if (!opened.ok) return res.status(opened.status).json({ error: opened.error });
    tradeId = opened.trade.id;
  }
  const closed = await closeTrade(userId, tradeId, req.body?.exitPrice);
  if (!closed.ok) return res.status(closed.status).json({ error: closed.error });
  res.json({ success: true, realizedPnl: closed.trade.realizedPnl });
});

// DELETE /api/setups/:id — hide from the dashboard. The paper record keeps tracking it.
router.delete('/:id', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;

  const { data, error } = await supabaseAdmin
    .from('trade_setups')
    .update({ dismissed_at: Date.now() })
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .select('id');

  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) return res.status(404).json({ error: 'Setup not found' });
  res.json({ success: true });
});

export default router;
