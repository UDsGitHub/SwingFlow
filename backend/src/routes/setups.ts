import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { supabaseAdmin } from '../db/supabase';
import { TradeSetup } from '../types';

const router = Router();
router.use(requireAuth);

function row(r: Record<string, unknown>): TradeSetup {
  return {
    id:               r.id as string,
    symbol:           r.symbol as string,
    strategy:         r.strategy as TradeSetup['strategy'],
    direction:        r.direction as TradeSetup['direction'],
    entry:            Number(r.entry),
    stop:             Number(r.stop),
    target:           Number(r.target),
    confidence:       Number(r.confidence),
    riskReward:       Number(r.risk_reward),
    detectedAt:       Number(r.detected_at),
    status:           r.status as TradeSetup['status'],
    notes:            (r.notes as string) ?? '',
    stockSuggestion:  r.stock_suggestion as TradeSetup['stockSuggestion'],
    optionsSuggestion: r.options_suggestion as TradeSetup['optionsSuggestion'] ?? null,
    exitPrice:        r.exit_price != null ? Number(r.exit_price) : null,
    realizedPnl:      r.realized_pnl != null ? Number(r.realized_pnl) : null,
    closedAt:         r.closed_at != null ? Number(r.closed_at) : null,
  };
}

// GET /api/setups?status=ACTIVE
router.get('/', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const status = (req.query.status as string) ?? 'ACTIVE';

  const { data, error } = await supabaseAdmin
    .from('trade_setups')
    .select('*')
    .eq('user_id', userId)
    .eq('status', status)
    .order('confidence', { ascending: false })
    .order('detected_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map(row));
});

// GET /api/setups/all
router.get('/all', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;

  const { data, error } = await supabaseAdmin
    .from('trade_setups')
    .select('*')
    .eq('user_id', userId)
    .order('detected_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map(row));
});

// GET /api/setups/daily-pnl — sum of realized_pnl for setups closed today
router.get('/daily-pnl', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTs = startOfDay.getTime();

  const { data, error } = await supabaseAdmin
    .from('trade_setups')
    .select('realized_pnl')
    .eq('user_id', userId)
    .eq('status', 'COMPLETED')
    .gte('closed_at', startTs)
    .not('realized_pnl', 'is', null);

  if (error) return res.status(500).json({ error: error.message });

  const pnl = (data ?? []).reduce((sum, r) => sum + Number(r.realized_pnl), 0);
  res.json({ pnl });
});

// GET /api/setups/:id
router.get('/:id', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;

  const { data, error } = await supabaseAdmin
    .from('trade_setups')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Setup not found' });
  res.json(row(data));
});

// PATCH /api/setups/:id/close — record exit price and compute realized P&L
router.patch('/:id/close', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const { exitPrice } = req.body as { exitPrice: number };

  if (typeof exitPrice !== 'number' || isNaN(exitPrice) || exitPrice <= 0) {
    return res.status(400).json({ error: 'exitPrice must be a positive number' });
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('trade_setups')
    .select('entry, direction, stock_suggestion, status')
    .eq('id', req.params.id)
    .eq('user_id', userId)
    .single();

  if (fetchErr || !existing) return res.status(404).json({ error: 'Setup not found' });
  if (existing.status === 'COMPLETED') return res.status(409).json({ error: 'Already closed' });

  const stock = existing.stock_suggestion as { shares?: number } | null;
  const shares = stock?.shares ?? 1;
  const entry  = Number(existing.entry);
  const priceDiff = existing.direction === 'LONG'
    ? exitPrice - entry
    : entry - exitPrice;
  const realizedPnl = parseFloat((priceDiff * shares).toFixed(2));

  const { error: updateErr } = await supabaseAdmin
    .from('trade_setups')
    .update({
      status:       'COMPLETED',
      exit_price:   exitPrice,
      realized_pnl: realizedPnl,
      closed_at:    Date.now(),
    })
    .eq('id', req.params.id)
    .eq('user_id', userId);

  if (updateErr) return res.status(500).json({ error: updateErr.message });
  res.json({ success: true, realizedPnl });
});

// PATCH /api/setups/:id/status
router.patch('/:id/status', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const { status } = req.body as { status: string };
  const valid = ['ACTIVE', 'TRIGGERED', 'COMPLETED', 'EXPIRED'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const { error } = await supabaseAdmin
    .from('trade_setups')
    .update({ status })
    .eq('id', req.params.id)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// DELETE /api/setups/:id  (soft delete → EXPIRED)
router.delete('/:id', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;

  const { error } = await supabaseAdmin
    .from('trade_setups')
    .update({ status: 'EXPIRED' })
    .eq('id', req.params.id)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
