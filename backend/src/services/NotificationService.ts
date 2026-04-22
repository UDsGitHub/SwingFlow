import webpush from 'web-push';
import { getDb } from '../db/database';
import { TradeSetup, PushSubscriptionData } from '../types';

let vapidConfigured = false;

function ensureVapid(): void {
  if (vapidConfigured) return;
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const mail = process.env.VAPID_EMAIL ?? 'mailto:admin@swingflow.local';

  if (!pub || !priv || priv === 'placeholder_generate_with_web_push_cli') {
    console.warn('[NotificationService] VAPID keys not configured — push notifications disabled');
    return;
  }
  webpush.setVapidDetails(mail, pub, priv);
  vapidConfigured = true;
}

export class NotificationService {
  constructor() {
    ensureVapid();
  }

  async subscribe(sub: PushSubscriptionData): Promise<void> {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO push_subscriptions (endpoint, auth, p256dh, created_at)
      VALUES (?, ?, ?, ?)
    `).run(sub.endpoint, sub.keys.auth, sub.keys.p256dh, Date.now());
  }

  async unsubscribe(endpoint: string): Promise<void> {
    const db = getDb();
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }

  async notifyNewSetup(setup: TradeSetup): Promise<void> {
    const title   = `🎯 ${setup.symbol} — ${setup.strategy.replace('_', ' ')}`;
    const body    = `Entry $${setup.entry} | Stop $${setup.stop} | Target $${setup.target} | RR ${setup.riskReward}:1 | Confidence ${setup.confidence}%`;
    await this.sendToAll({ title, body, data: { setupId: setup.id, type: 'NEW_SETUP' } });
    this.logNotification(setup.id, 'NEW_SETUP', body);
  }

  async notifyEntryZone(setup: TradeSetup, currentPrice: number): Promise<void> {
    const title = `⚡ ${setup.symbol} Entering Entry Zone`;
    const body  = `Current: $${currentPrice} | Entry: $${setup.entry} | Target: $${setup.target}`;
    await this.sendToAll({ title, body, data: { setupId: setup.id, type: 'ENTRY_ZONE' } });
    this.logNotification(setup.id, 'ENTRY_ZONE', body);
  }

  private async sendToAll(payload: { title: string; body: string; data: Record<string, unknown> }): Promise<void> {
    if (!vapidConfigured) return;

    const db = getDb();
    const subs = db.prepare('SELECT endpoint, auth, p256dh FROM push_subscriptions').all() as Array<{
      endpoint: string; auth: string; p256dh: string;
    }>;

    const pushPayload = JSON.stringify(payload);

    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { auth: s.auth, p256dh: s.p256dh } },
            pushPayload,
          );
        } catch (err: unknown) {
          // Remove stale subscriptions (HTTP 410 Gone)
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 410 || code === 404) {
            db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(s.endpoint);
          }
        }
      }),
    );
  }

  private logNotification(setupId: string, type: string, message: string): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO notifications (setup_id, type, message, sent_at, delivered)
      VALUES (?, ?, ?, ?, 1)
    `).run(setupId, type, message, Date.now());
  }
}
