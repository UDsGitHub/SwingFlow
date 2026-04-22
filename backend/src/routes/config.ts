import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { supabaseAdmin } from '../db/supabase';

const router = Router();
router.use(requireAuth);

// GET /api/config
router.get('/', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;

  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('account_size, daily_goal, risk_percent, data_provider')
    .eq('user_id', userId)
    .single();

  if (error || !data) return res.status(500).json({ error: error?.message ?? 'Settings not found' });

  res.json({
    accountSize:  String(data.account_size),
    dailyGoal:    String(data.daily_goal),
    riskPercent:  String(data.risk_percent),
    dataProvider: data.data_provider,
  });
});

// PATCH /api/config
router.patch('/', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const body = req.body as Record<string, string>;

  const update: Record<string, unknown> = {};
  if (body.accountSize  !== undefined) update.account_size  = Number(body.accountSize);
  if (body.dailyGoal    !== undefined) update.daily_goal    = Number(body.dailyGoal);
  if (body.riskPercent  !== undefined) update.risk_percent  = Number(body.riskPercent);
  if (body.dataProvider !== undefined) update.data_provider = body.dataProvider;

  const { error } = await supabaseAdmin
    .from('settings')
    .update(update)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
