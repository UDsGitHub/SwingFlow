import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { loadSettings, saveSettings } from '../services/SettingsService';
import { Settings, mergeSettings } from '../services/settingsRules';

const router = Router();
router.use(requireAuth);

/** The settings form edits text fields, so numbers go out as strings. */
function toResponse(s: Settings) {
  return {
    accountSize:    String(s.accountSize),
    goalAmount:     String(s.goalAmount),
    goalPeriod:     s.goalPeriod,
    riskPercent:    String(s.riskPercent),
    maxRiskPercent: String(s.maxRiskPercent),
  };
}

// GET /api/config
router.get('/', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  try {
    res.json(toResponse(await loadSettings(userId)));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /api/config — validated as a whole; 400 with per-field errors otherwise
router.patch('/', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  try {
    const merged = mergeSettings(await loadSettings(userId), (req.body ?? {}) as Record<string, unknown>);
    if (!merged.ok) return res.status(400).json({ error: 'Invalid settings', fields: merged.errors });
    await saveSettings(userId, merged.changed);
    res.json({ success: true, config: toResponse(merged.settings) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
