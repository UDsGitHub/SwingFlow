import cron from 'node-cron';
import { runStrategyEngine } from '../strategies/StrategyEngine';
import { NotificationService } from '../services/NotificationService';
import { supabaseAdmin } from '../db/supabase';
import { checkEntryZones } from './entryZoneCheck';

const notifService = new NotificationService();

interface UserWatchlist {
  userId: string;
  symbols: string[];
}

async function getAllUserWatchlists(): Promise<UserWatchlist[]> {
  // Fetch all active watchlist entries grouped by user
  const { data, error } = await supabaseAdmin
    .from('watchlist')
    .select('user_id, symbol')
    .eq('is_active', true);

  if (error || !data) return [];

  const byUser = new Map<string, string[]>();
  for (const row of data as { user_id: string; symbol: string }[]) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row.symbol);
    byUser.set(row.user_id, list);
  }

  return Array.from(byUser.entries()).map(([userId, symbols]) => ({ userId, symbols }));
}

async function scan(): Promise<void> {
  console.log(`[Scheduler] Market scan started at ${new Date().toISOString()}`);

  const users = await getAllUserWatchlists();
  if (users.length === 0) {
    console.log('[Scheduler] No users with active watchlists');
    return;
  }

  let totalSetups = 0;

  for (const { userId, symbols } of users) {
    try {
      const newSetups = await runStrategyEngine(symbols, userId);
      totalSetups += newSetups.length;

      for (const setup of newSetups) {
        await notifService.notifyNewSetup(userId, setup);
      }
    } catch (err) {
      console.error(`[Scheduler] Error scanning for user ${userId.slice(0, 8)}…:`, err);
    }
  }

  console.log(`[Scheduler] Scan complete — ${users.length} user(s), ${totalSetups} new setup(s)`);

  await checkEntryZones(notifService);
}

export function startScheduler(): void {
  const schedule = process.env.SCAN_SCHEDULE ?? '*/10 9-16 * * 1-5';
  console.log(`[Scheduler] Starting with schedule: ${schedule}`);
  cron.schedule(schedule, scan, { timezone: 'America/New_York' });
  setTimeout(scan, 3000);
}

export { scan };
