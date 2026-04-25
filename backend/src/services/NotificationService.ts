import webpush from 'web-push';
import { supabaseAdmin } from '../db/supabase';
import { TradeSetup, PushSubscriptionData } from '../types';
import { NotificationLoggingService } from './NotificationLoggingService';

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
  private logger = new NotificationLoggingService();

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
    await this.sendToUser(userId, { title, body, data: { setupId: setup.id, type: 'NEW_SETUP' } }, setup.id, 'NEW_SETUP');
  }

  async notifyEntryZone(userId: string, setup: TradeSetup, currentPrice: number): Promise<void> {
    const title = `⚡ ${setup.symbol} entering entry zone`;
    const body  = `Current $${currentPrice} · Entry $${setup.entry} · Target $${setup.target}`;
    await this.sendToUser(userId, { title, body, data: { setupId: setup.id, type: 'ENTRY_ZONE' } }, setup.id, 'ENTRY_ZONE');
  }

  private async sendToUser(
    userId: string,
    payload: { title: string; body: string; data: Record<string, unknown> },
    setupId: string | null,
    type: string,
  ): Promise<boolean> {
    if (!vapidConfigured) return false;

    const { data: subs } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, auth, p256dh')
      .eq('user_id', userId);

    if (!subs?.length) return false;

    const pushPayload = JSON.stringify(payload);
    let delivered = false;
    const notificationId = await this.logger.createNotificationLog(
      userId,
      setupId,
      type,
      payload.body,
      false,
    );

    await Promise.all(
      subs.map(async (s: { endpoint: string; auth: string; p256dh: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { auth: s.auth, p256dh: s.p256dh } },
            pushPayload,
          );
          delivered = true;
          await this.logger.logAttempt({
            notificationId,
            userId,
            setupId,
            type,
            endpoint: s.endpoint,
            success: true,
            errorMessage: null,
          });
        } catch (err: unknown) {
          const code = (err as { statusCode?: number }).statusCode;
          await this.logger.logAttempt({
            notificationId,
            userId,
            setupId,
            type,
            endpoint: s.endpoint,
            success: false,
            errorMessage: err instanceof Error ? err.message : 'Unknown push error',
          });
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
    if (notificationId != null) {
      await supabaseAdmin
        .from('notifications')
        .update({ delivered })
        .eq('id', notificationId);
    }
    return delivered;
  }

  async sendTestNotification(userId: string): Promise<boolean> {
    return this.sendToUser(
      userId,
      {
        title: 'SwingFlow notification test',
        body: 'Notifications are configured correctly for this device.',
        data: { type: 'TEST' },
      },
      null,
      'TEST',
    );
  }

  async getHealth(userId: string): Promise<{ configured: boolean; subscriptions: number; lastNotificationAt: number | null; lastNotificationDelivered: boolean | null }> {
    const { count } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    const { data: latest } = await supabaseAdmin
      .from('notifications')
      .select('sent_at, delivered')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      configured: vapidConfigured,
      subscriptions: count ?? 0,
      lastNotificationAt: latest?.sent_at ?? null,
      lastNotificationDelivered: latest?.delivered ?? null,
    };
  }
}
