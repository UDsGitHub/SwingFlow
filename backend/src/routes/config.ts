import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

const ALLOWED_KEYS = ['accountSize', 'dailyGoal', 'riskPercent', 'dataProvider'];

// GET /api/config
router.get('/', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const config: Record<string, string> = {};
  for (const row of rows) config[row.key] = row.value;
  res.json(config);
});

// PATCH /api/config
router.patch('/', (req, res) => {
  const db = getDb();
  const updates = req.body as Record<string, string>;

  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const upsert = db.transaction((data: Record<string, string>) => {
    for (const [key, value] of Object.entries(data)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      stmt.run(key, String(value));
    }
  });

  upsert(updates);
  res.json({ success: true });
});

export default router;
