import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import setupsRouter        from './routes/setups';
import watchlistRouter     from './routes/watchlist';
import notificationsRouter from './routes/notifications';
import configRouter        from './routes/config';
import marketRouter        from './routes/market';
import { requireAuth, AuthRequest } from './middleware/auth';
import { runStrategyEngine, runStrategyEngineWithDeveloping } from './strategies/StrategyEngine';
import { supabaseAdmin } from './db/supabase';
import { startScheduler } from './scheduler/MarketScheduler';
import { NotificationService } from './services/NotificationService';

const notifService = new NotificationService();

const app  = express();
const PORT = Number(process.env.PORT ?? 3001);

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(clerkMiddleware());

// ── Routes ───────────────────────────────────────────────────
app.use('/api/setups',        setupsRouter);
app.use('/api/watchlist',     watchlistRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/config',        configRouter);
app.use('/api/market',        marketRouter);

// Manual scan trigger — scoped to the requesting user, optionally to specific symbols
app.post('/api/scan', requireAuth, async (req, res) => {
  const userId = (req as unknown as AuthRequest).userId;
  const requestedSymbols: string[] | undefined = req.body?.symbols;

  const { data: wl } = await supabaseAdmin
    .from('watchlist')
    .select('symbol')
    .eq('user_id', userId)
    .eq('is_active', true);

  let symbols = (wl ?? []).map((r: { symbol: string }) => r.symbol);

  if (requestedSymbols?.length) {
    const watchlistSet = new Set(symbols);
    symbols = requestedSymbols.filter(s => watchlistSet.has(s));
  }

  const run = await runStrategyEngineWithDeveloping(symbols, userId);
  const detailed = await runStrategyEngine(symbols, userId);
  for (const setup of run.setups) {
    await notifService.notifyNewSetup(userId, setup);
  }

  res.json({
    message: 'Scan complete',
    symbols,
    activeSetups: run.setups.length,
    developingSetups: run.developing,
    scanId: detailed.scanId,
    regime: detailed.regime,
    newSetups: detailed.setups.length,
    noSetupReasons: detailed.noSetupReasons,
    evaluations: detailed.evaluations,
  });
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    provider: process.env.DATA_PROVIDER ?? 'mock',
    timestamp: new Date().toISOString(),
    keys: {
      polygon: !!process.env.POLYGON_API_KEY,
    },
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 SwingFlow backend running on http://localhost:${PORT}`);
  console.log(`   Data provider : ${process.env.DATA_PROVIDER ?? 'mock'}`);
  console.log(`   Supabase URL  : ${process.env.SUPABASE_URL ?? '(not set)'}\n`);
  startScheduler();
});

export default app;
