import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { supabaseAdmin } from '../db/supabase';
import { EDGE_BASELINE } from '../config/edgeBaseline';
import { marketClock, periodStart } from '../lib/marketTime';
import { loadSettings } from '../services/SettingsService';
import { mergeSettings } from '../services/settingsRules';
import { periodRealizedPnl } from '../services/TradeService';
import { summarizePaper } from '../services/recordStats';
import { assessGoal } from '../trading/goalFeasibility';
import { GoalStatus } from '../types';

const router = Router();
router.use(requireAuth);

// GET /api/goal — progress this period and whether the goal is reachable. Query parameters
// (accountSize, goalAmount, goalPeriod, riskPercent, maxRiskPercent) preview unsaved settings.
router.get('/', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  try {
    const overrides = req.query as Record<string, unknown>;
    const merged = mergeSettings(await loadSettings(userId), overrides);
    if (!merged.ok) return res.status(400).json({ error: 'Invalid settings', fields: merged.errors });
    const s = merged.settings;

    const { data: setups, error } = await supabaseAdmin
      .from('trade_setups')
      .select('status, paper_r, paper_exit_reason, sessions_held')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    const paper = summarizePaper(setups ?? []);

    const today = marketClock().date;
    const body: GoalStatus = {
      ...s,
      draft: Object.keys(merged.changed).length > 0,
      progress: {
        periodStart: periodStart(today, s.goalPeriod),
        realizedPnl: await periodRealizedPnl(userId, s.goalPeriod, today),
      },
      feasibility: assessGoal(s, EDGE_BASELINE, { closed: paper.closed, expectancyR: paper.expectancyR }),
    };
    res.json(body);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
