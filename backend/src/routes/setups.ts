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
