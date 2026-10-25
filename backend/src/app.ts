import 'dotenv/config';
import express, { Express } from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import setupsRouter        from './routes/setups';
import tradesRouter        from './routes/trades';
import watchlistRouter     from './routes/watchlist';
import notificationsRouter from './routes/notifications';
import configRouter        from './routes/config';
import goalRouter          from './routes/goal';
import marketRouter        from './routes/market';
import { requireAuth, AuthRequest } from './middleware/auth';
import { runStrategyEngineWithDeveloping, scanSymbolsForUser } from './strategies/StrategyEngine';

/** Build the HTTP app without listening, so tests can drive it directly. */
export function createApp(): Express {
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());
  app.use(clerkMiddleware());

  // ── Routes ───────────────────────────────────────────────────
  app.use('/api/setups',        setupsRouter);
  app.use('/api/trades',        tradesRouter);
  app.use('/api/watchlist',     watchlistRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/config',        configRouter);
  app.use('/api/goal',          goalRouter);
  app.use('/api/market',        marketRouter);

  // Manual scan trigger — scoped to the requesting user (universe + watchlist), optionally to specific
  // symbols. Judges completed candles only, so a mid-day scan reflects the previous close. No push:
  // the user is looking at the results already.
  app.post('/api/scan', requireAuth, async (req, res) => {
    const userId = (req as unknown as AuthRequest).userId;
    const requestedSymbols: string[] | undefined = req.body?.symbols;

    let symbols = await scanSymbolsForUser(userId);
    if (requestedSymbols?.length) {
      const allowed = new Set(symbols);
      symbols = requestedSymbols.filter(s => allowed.has(s));
    }

    let run: Awaited<ReturnType<typeof runStrategyEngineWithDeveloping>>;
    try {
      run = await runStrategyEngineWithDeveloping(symbols, userId);
    } catch (err) {
      // Express 4 does not catch async errors; without this the request would hang.
      console.error('[Scan] Manual scan failed:', err);
      return res.status(502).json({ error: 'Scan failed — market data unavailable. Try again shortly.' });
    }

    res.json({
      message: 'Scan complete',
      symbols,
      activeSetups: run.setups.length,
      developingSetups: run.developing,
      scanId: run.scanId,
      regime: run.regime,
      newSetups: run.setups.length,
      noSetupReasons: run.noSetupReasons,
      evaluations: run.evaluations,
    });
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      provider: process.env.DATA_PROVIDER ?? 'alpaca',
      timestamp: new Date().toISOString(),
      keys: {
        alpaca: !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY),
        polygon: !!process.env.POLYGON_API_KEY,
      },
    });
  });

  return app;
}
