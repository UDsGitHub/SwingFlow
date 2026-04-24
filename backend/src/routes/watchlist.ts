import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { supabaseAdmin } from '../db/supabase';

const router = Router();
router.use(requireAuth);

// GET /api/watchlist
router.get('/', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;

  const { data, error } = await supabaseAdmin
    .from('watchlist')
    .select('symbol, added_at, is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('symbol');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// POST /api/watchlist
router.post('/', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const { symbol } = req.body as { symbol: string };
  if (!symbol || typeof symbol !== 'string') return res.status(400).json({ error: 'symbol required' });

  const clean = symbol.trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(clean)) {
    return res.status(400).json({ error: 'Invalid symbol format' });
  }

  // Conflict target must be (user_id, symbol): PK is `id`, so a bare upsert tries INSERT and
  // violates UNIQUE(user_id, symbol) when re-adding a soft-deleted symbol (is_active false).
  const { error } = await supabaseAdmin
    .from('watchlist')
    .upsert(
      { user_id: userId, symbol: clean, added_at: Date.now(), is_active: true },
      { onConflict: 'user_id,symbol' },
    );

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, symbol: clean });
});

// DELETE /api/watchlist/:symbol
router.delete('/:symbol', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;

  const { error } = await supabaseAdmin
    .from('watchlist')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('symbol', decodeURIComponent(req.params.symbol).toUpperCase());

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
