import { Router } from 'express';
import { getDb } from '../db/database';
import { TradeSetup } from '../types';

const router = Router();

function parseSetup(row: Record<string, unknown>): TradeSetup {
  return {
    id: row.id as string,
    symbol: row.symbol as string,
    strategy: row.strategy as TradeSetup['strategy'],
    direction: row.direction as TradeSetup['direction'],
    entry: row.entry as number,
    stop: row.stop as number,
    target: row.target as number,
    confidence: row.confidence as number,
    riskReward: row.risk_reward as number,
    detectedAt: row.detected_at as number,
    status: row.status as TradeSetup['status'],
    notes: row.notes as string ?? '',
    stockSuggestion: JSON.parse((row.stock_suggestion as string) ?? '{}'),
    optionsSuggestion: row.options_suggestion ? JSON.parse(row.options_suggestion as string) : null,
  };
}

// GET /api/setups — list all active setups
router.get('/', (req, res) => {
  const db = getDb();
  const status = req.query.status as string ?? 'ACTIVE';
  const rows = db.prepare(
    `SELECT * FROM trade_setups WHERE status = ? ORDER BY confidence DESC, detected_at DESC`
  ).all(status) as Record<string, unknown>[];
  res.json(rows.map(parseSetup));
});

// GET /api/setups/all — list setups regardless of status
router.get('/all', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM trade_setups ORDER BY detected_at DESC LIMIT 100`
  ).all() as Record<string, unknown>[];
  res.json(rows.map(parseSetup));
});

// GET /api/setups/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM trade_setups WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ error: 'Setup not found' });
  res.json(parseSetup(row));
});

// PATCH /api/setups/:id/status
router.patch('/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body as { status: string };
  const valid = ['ACTIVE', 'TRIGGERED', 'COMPLETED', 'EXPIRED'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE trade_setups SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// DELETE /api/setups/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE trade_setups SET status = 'EXPIRED' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

export default router;
