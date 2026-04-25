import { supabaseAdmin } from '../db/supabase';

interface AttemptInput {
  notificationId: number | null;
  userId: string;
  setupId: string | null;
  type: string;
  endpoint: string;
  success: boolean;
  errorMessage: string | null;
}

export class NotificationLoggingService {
  async createNotificationLog(
    userId: string,
    setupId: string | null,
    type: string,
    message: string,
    delivered: boolean,
  ): Promise<number | null> {
    const { data } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        setup_id: setupId,
        type,
        message,
        sent_at: Date.now(),
        delivered,
      })
      .select('id')
      .single();
    return data?.id ?? null;
  }

  async logAttempt(input: AttemptInput): Promise<void> {
    await supabaseAdmin.from('notification_attempts').insert({
      notification_id: input.notificationId,
      user_id: input.userId,
      setup_id: input.setupId,
      type: input.type,
      endpoint: input.endpoint,
      success: input.success,
      error_message: input.errorMessage,
      attempted_at: Date.now(),
    });
  }
}

