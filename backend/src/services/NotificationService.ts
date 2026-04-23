import webpush from 'web-push';
import { supabaseAdmin } from '../db/supabase';
import { TradeSetup, PushSubscriptionData } from '../types';

let vapidConfigured = false;

function ensureVapid(): void {
  if (vapidConfigured) return;
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const mail = process.env.VAPID_EMAIL ?? 'mailto:admin@swingflow.local';
  if (!pub || !priv || priv === 'placeholder_generate_with_web_push_cli') {
    console.warn('[Notifications] VAPID keys not configured — push disabled');
    return;
  }
  webpush.setVapidDetails(mail, pub, priv);
  vapidConfigured = true;
}

export class NotificationService {
  constructor() { ensureVapid(); }

  async subscribe(userId: string, sub: PushSubscriptionData): Promise<void> {
    await supabaseAdmin.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: sub.endpoint,
      auth: sub.keys.auth,
      p256dh: sub.keys.p256dh,
      created_at: Date.now(),
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);
  }

  async notifyNewSetup(userId: string, setup: TradeSetup): Promise<void> {
    const title = `🎯 ${setup.symbol} — ${setup.strategy.replace('_', ' ')}`;
    const body  = `Entry $${setup.entry} · Stop $${setup.stop} · Target $${setup.target} · RR ${setup.riskReward}:1 · ${setup.confidence}% confidence`;
    await this.sendToUser(userId, { title, body, data: { setupId: setup.id, type: 'NEW_SETUP' } });
    await this.log(userId, setup.id, 'NEW_SETUP', body);
  }

  async notifyEntryZone(userId: string, setup: TradeSetup, currentPrice: number): Promise<void> {
    const title = `⚡ ${setup.symbol} entering entry zone`;
    const body  = `Current $${currentPrice} · Entry $${setup.entry} · Target $${setup.target}`;
    await this.sendToUser(userId, { title, body, data: { setupId: setup.id, type: 'ENTRY_ZONE' } });
    await this.log(userId, setup.id, 'ENTRY_ZONE', body);
  }

  /** Dev-only: push without a setup row (OS notification only; not logged to notifications table). */
  async notifyPushTest(userId: string): Promise<void> {
    await this.sendToUser(userId, {
      title: 'SwingFlow push test',
      body: 'If you see this outside the browser window, web push is working.',
      data: { type: 'TEST_PUSH' },
    });
    console.log('[Notifications] Test push sent');
  }

  private async sendToUser(
    userId: string,
    payload: { title: string; body: string; data: Record<string, unknown> },
  ): Promise<void> {
    if (!vapidConfigured) return;

    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, auth, p256dh')
      .eq('user_id', userId);

    if (!subs?.length) return;

    const pushPayload = JSON.stringify(payload);

    await Promise.allSettled(
      subs.map(async (s: { endpoint: string; auth: string; p256dh: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { auth: s.auth, p256dh: s.p256dh } },
            pushPayload,
          );
        } catch (err: unknown) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 410 || code === 404) {
            await supabaseAdmin
              .from('push_subscriptions')
              .delete()
              .eq('user_id', userId)
              .eq('endpoint', s.endpoint);
          }
        }
      }),
    );
  }

  private async log(userId: string, setupId: string, type: string, message: string): Promise<void> {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      setup_id: setupId,
      type,
      message,
      sent_at: Date.now(),
      delivered: true,
    });
  }
}
