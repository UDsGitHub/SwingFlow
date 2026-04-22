import { Router } from 'express';
import { getDb } from '../db/database';
import { NotificationService } from '../services/NotificationService';
import { PushSubscriptionData } from '../types';

const router = Router();
const notifService = new NotificationService();

// POST /api/notifications/subscribe
router.post('/subscribe', async (req, res) => {
  const sub = req.body as PushSubscriptionData;
  if (!sub?.endpoint || !sub?.keys?.auth || !sub?.keys?.p256dh) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }
  await notifService.subscribe(sub);
  res.json({ success: true });
});

// POST /api/notifications/unsubscribe
router.post('/unsubscribe', async (req, res) => {
  const { endpoint } = req.body as { endpoint: string };
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  await notifService.unsubscribe(endpoint);
  res.json({ success: true });
});

// GET /api/notifications/vapid-public-key
router.get('/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  res.json({ key: key ?? null });
});

// GET /api/notifications/history
router.get('/history', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM notifications ORDER BY sent_at DESC LIMIT 50').all();
  res.json(rows);
});

export default router;
