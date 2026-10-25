import { createApp } from './app';
import { startScheduler } from './scheduler/MarketScheduler';

const PORT = Number(process.env.PORT ?? 3001);

createApp().listen(PORT, () => {
  console.log(`\n🚀 SwingFlow backend running on http://localhost:${PORT}`);
  console.log(`   Data provider : ${process.env.DATA_PROVIDER ?? 'alpaca'}`);
  console.log(`   Supabase URL  : ${process.env.SUPABASE_URL ?? '(not set)'}\n`);
  // Tests and local e2e runs disable cron jobs so scans only happen when triggered.
  if (process.env.DISABLE_SCHEDULER !== 'true') startScheduler();
});
