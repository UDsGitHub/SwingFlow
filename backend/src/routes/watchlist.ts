import { Router } from 'express';
import { getDb } from '../db/database';

const router = Router();

// GET /api/watchlist
router.get('/', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT symbol, added_at, is_active FROM watchlist WHERE is_active = 1 ORDER BY symbol').all();
  res.json(rows);
});

// POST /api/watchlist — add symbol
router.post('/', (req, res) => {
  const { symbol } = req.body as { symbol: string };
  if (!symbol || typeof symbol !== 'string') return res.status(400).json({ error: 'symbol required' });
  const clean = symbol.trim().toUpperCase();
  if (!/^[A-Z]{1,5}$/.test(clean)) return res.status(400).json({ error: 'Invalid symbol format' });

  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO watchlist (symbol, added_at, is_active) VALUES (?, ?, 1)'
  ).run(clean, Date.now());
  res.json({ success: true, symbol: clean });
});

// DELETE /api/watchlist/:symbol — remove symbol
router.delete('/:symbol', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE watchlist SET is_active = 0 WHERE symbol = ?').run(req.params.symbol.toUpperCase());
  res.json({ success: true });
});

export default router;
