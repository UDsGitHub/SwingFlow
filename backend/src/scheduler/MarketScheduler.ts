import cron from 'node-cron';
import { evaluateMarket, runScanForUser } from '../strategies/StrategyEngine';
import { NotificationService } from '../services/NotificationService';
import { supabaseAdmin } from '../db/supabase';
import { checkEntryZones } from './entryZoneCheck';
import { expireStaleSetups } from './expireSetups';
import { TradeLifecycleTracker } from '../services/TradeLifecycleTracker';
import { LIQUID_UNIVERSE } from '../config/universe';
import { DAILY_BAR_FINAL_MIN, marketClock } from '../lib/marketTime';

const notifService = new NotificationService();
const lifecycleTracker = new TradeLifecycleTracker();
const UNIQUE_VIOLATION = '23505';

interface ScanUser {
  userId: string;
  symbols: string[];
}

/** Every user gets the liquid universe plus their own watchlist favorites. */
async function getScanUsers(): Promise<ScanUser[]> {
  const [{ data: profiles, error }, { data: watchlist }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id'),
    supabaseAdmin.from('watchlist').select('user_id, symbol').eq('is_active', true),
  ]);
  if (error || !profiles) return [];

  const favorites = new Map<string, string[]>();
  for (const row of (watchlist ?? []) as { user_id: string; symbol: string }[]) {
    favorites.set(row.user_id, [...(favorites.get(row.user_id) ?? []), row.symbol]);
  }
  return (profiles as { id: string }[]).map(p => ({
    userId: p.id,
    symbols: [...new Set([...LIQUID_UNIVERSE, ...(favorites.get(p.id) ?? [])])],
  }));
}

/**
 * Claim the post-close scan for an ET session date. Returns false if another run already
 * owns it (the unique key on scan_runs acts as a cross-instance lock); FAILED runs are retried.
 */
async function claimRun(sessionDate: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from('scan_runs').insert({
    kind: 'POST_CLOSE',
    session_date: sessionDate,
    status: 'RUNNING',
    started_at: Date.now(),
  });
  if (!error) return true;
  if (error.code !== UNIQUE_VIOLATION) {
    console.error('[Scheduler] Could not record scan run:', error.message);
    return false;
  }
  const { data } = await supabaseAdmin
    .from('scan_runs')
    .update({ status: 'RUNNING', started_at: Date.now(), error: null })
    .eq('kind', 'POST_CLOSE')
    .eq('session_date', sessionDate)
    .eq('status', 'FAILED')
    .select('id');
  return (data?.length ?? 0) > 0;
}

async function finishRun(sessionDate: string, fields: Record<string, unknown>): Promise<void> {
  await supabaseAdmin
    .from('scan_runs')
    .update({ ...fields, finished_at: Date.now() })
    .eq('kind', 'POST_CLOSE')
    .eq('session_date', sessionDate);
}

/**
 * Once per trading day after the close: judge the finished daily candles, expire unfilled
 * setups, create new setups for every user, and send one notification per user.
 */
async function postCloseScan(): Promise<void> {
  const today = marketClock().date;
  if (!(await claimRun(today))) {
    console.log(`[Scheduler] Post-close scan for ${today} already ran or is running — skipping`);
    return;
  }

  try {
    const users = await getScanUsers();
    const snapshot = await evaluateMarket([...new Set(users.flatMap(u => u.symbols).concat(LIQUID_UNIVERSE))]);

    if (snapshot.asOfDate !== today) {
      console.log(`[Scheduler] No completed session for ${today} (latest ${snapshot.asOfDate}) — market closed`);
      await finishRun(today, { status: 'MARKET_CLOSED', users: users.length, setups: 0, expired: 0 });
      return;
    }

    const expired = await expireStaleSetups(snapshot.sessionDates);
    let totalSetups = 0;
    for (const { userId, symbols } of users) {
      try {
        const run = await runScanForUser(userId, snapshot, symbols);
        totalSetups += run.setups.length;
        await notifService.notifyNewSetups(userId, run.setups);
      } catch (err) {
        console.error(`[Scheduler] Error scanning for user ${userId.slice(0, 8)}…:`, err);
      }
    }

    console.log(`[Scheduler] Post-close scan ${today}: ${users.length} user(s), ${totalSetups} new setup(s), ${expired} expired`);
    await finishRun(today, { status: 'DONE', users: users.length, setups: totalSetups, expired });
  } catch (err) {
    console.error('[Scheduler] Post-close scan failed:', err);
    await finishRun(today, { status: 'FAILED', error: (err as Error).message });
  }
}

/** During market hours: entry-zone alerts and trade lifecycle tracking only (no new setups). */
async function monitor(): Promise<void> {
  await checkEntryZones(notifService);
  await lifecycleTracker.run();
}

/** After a restart past the scan time, run today's post-close scan if it was missed. */
async function catchUpIfMissed(): Promise<void> {
  const { weekday, minutes } = marketClock();
  if (weekday === 0 || weekday === 6 || minutes < DAILY_BAR_FINAL_MIN) return;
  await postCloseScan();
}

export function startScheduler(): void {
  const postClose = process.env.POST_CLOSE_SCAN_SCHEDULE ?? '30 16 * * 1-5';
  const monitorSchedule = process.env.MONITOR_SCHEDULE ?? process.env.LIFECYCLE_POLL_SCHEDULE ?? '*/10 9-16 * * 1-5';
  if (process.env.SCAN_SCHEDULE) {
    console.warn('[Scheduler] SCAN_SCHEDULE is no longer used — setups come from one post-close scan (POST_CLOSE_SCAN_SCHEDULE)');
  }
  console.log(`[Scheduler] Post-close scan: "${postClose}", monitor: "${monitorSchedule}" (America/New_York)`);
  cron.schedule(postClose, postCloseScan, { timezone: 'America/New_York' });
  cron.schedule(monitorSchedule, monitor, { timezone: 'America/New_York' });
  setTimeout(() => { void catchUpIfMissed(); }, 5000);
}

export { postCloseScan, monitor };
