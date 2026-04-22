import cron from 'node-cron';
import { runStrategyEngine } from '../strategies/StrategyEngine';
import { NotificationService } from '../services/NotificationService';
import { getDb } from '../db/database';

const notifService = new NotificationService();

function getActiveSymbols(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT symbol FROM watchlist WHERE is_active = 1').all() as { symbol: string }[];
  return rows.map(r => r.symbol);
}

async function scan(): Promise<void> {
  console.log(`[Scheduler] Starting market scan at ${new Date().toISOString()}`);
  const symbols = getActiveSymbols();
  if (symbols.length === 0) {
    console.log('[Scheduler] No symbols in watchlist');
    return;
  }

  try {
    const newSetups = await runStrategyEngine(symbols);
    console.log(`[Scheduler] Scan complete — ${newSetups.length} new setup(s) found`);

    for (const setup of newSetups) {
      await notifService.notifyNewSetup(setup);
    }
  } catch (err) {
    console.error('[Scheduler] Error during scan:', err);
  }
}

export function startScheduler(): void {
  const schedule = process.env.SCAN_SCHEDULE ?? '*/10 9-16 * * 1-5';
  console.log(`[Scheduler] Starting with schedule: ${schedule}`);

  cron.schedule(schedule, scan, { timezone: 'America/New_York' });

  // Run once on startup (after brief delay for DB init)
  setTimeout(scan, 3000);
}

export { scan };
