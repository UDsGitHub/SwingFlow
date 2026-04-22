import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDb } from './db/database';
import setupsRouter from './routes/setups';
import watchlistRouter from './routes/watchlist';
import notificationsRouter from './routes/notifications';
import configRouter from './routes/config';
import marketRouter from './routes/market';
import { startScheduler, scan } from './scheduler/MarketScheduler';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

// Initialize DB
getDb();

// Routes
app.use('/api/setups',        setupsRouter);
app.use('/api/watchlist',     watchlistRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/config',        configRouter);
app.use('/api/market',        marketRouter);

// Trigger manual scan
app.post('/api/scan', async (_req, res) => {
  res.json({ message: 'Scan started' });
  await scan();
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    provider: process.env.DATA_PROVIDER ?? 'mock',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 SwingFlow backend running on http://localhost:${PORT}`);
  console.log(`   Data provider: ${process.env.DATA_PROVIDER ?? 'mock'}`);
  startScheduler();
});

export default app;
