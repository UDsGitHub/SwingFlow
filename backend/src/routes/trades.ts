import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { TradeResult, closeTrade, listTrades, updateTrade } from '../services/TradeService';

const router = Router();
router.use(requireAuth);

function send(res: Response, result: TradeResult) {
  if (result.ok) return res.json(result.trade);
  return res.status(result.status).json({ error: result.error });
}

// GET /api/trades?status=OPEN|CLOSED — the user's real positions
router.get('/', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const status = req.query.status as string | undefined;
  if (status && status !== 'OPEN' && status !== 'CLOSED') return res.status(400).json({ error: 'status must be OPEN or CLOSED' });
  try {
    res.json(await listTrades(userId, status as 'OPEN' | 'CLOSED' | undefined));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /api/trades/:id/close  { exitPrice }
router.patch('/:id/close', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  send(res, await closeTrade(userId, req.params.id, req.body?.exitPrice));
});

// PATCH /api/trades/:id  { stopPrice?, notes? }
router.patch('/:id', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  send(res, await updateTrade(userId, req.params.id, { stopPrice: req.body?.stopPrice, notes: req.body?.notes }));
});

export default router;
