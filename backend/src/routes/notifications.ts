import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { supabaseAdmin } from '../db/supabase';
import { NotificationService } from '../services/NotificationService';
import { PushSubscriptionData } from '../types';

const router = Router();
const notifService = new NotificationService();

/** Non-production only: lets you tab away before the push fires. */
const TEST_PUSH_DELAY_MS = 10_000;

router.use(requireAuth);

// GET /api/notifications/dev-features — whether dev-only UI (e.g. test push) should show
router.get('/dev-features', (_req, res: Response) => {
  res.json({
    testPush: process.env.NODE_ENV !== 'production',
  });
});

// POST /api/notifications/subscribe
router.post('/subscribe', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const sub = req.body as PushSubscriptionData;
  if (!sub?.endpoint || !sub?.keys?.auth || !sub?.keys?.p256dh) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }
  await notifService.subscribe(userId, sub);
  res.json({ success: true });
});

// POST /api/notifications/unsubscribe
router.post('/unsubscribe', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const { endpoint } = req.body as { endpoint: string };
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  await notifService.unsubscribe(userId, endpoint);
  res.json({ success: true });
});

// POST /api/notifications/test-push — schedule a test push (development only)
router.post('/test-push', (req, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const userId = (req as unknown as AuthRequest).userId;
  setTimeout(() => {
    notifService.notifyPushTest(userId).catch(err => console.error('[Notifications] test push failed:', err));
  }, TEST_PUSH_DELAY_MS);
  res.json({ ok: true, scheduledInMs: TEST_PUSH_DELAY_MS });
});

// GET /api/notifications/vapid-public-key
router.get('/vapid-public-key', (_req, res: Response) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY ?? null });
});

// GET /api/notifications/history
router.get('/history', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

export default router;
