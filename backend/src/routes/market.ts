import { Router } from 'express';
import { getProvider } from '../providers/ProviderFactory';
import { getDb } from '../db/database';
import { MarketSummary, OHLC } from '../types';
import { calculateEMA, calculateRSI, lastValid } from '../indicators/technical';

const router = Router();

// GET /api/market/summary — market summary for all watchlist symbols
router.get('/summary', async (_req, res) => {
  const db = getDb();
  const provider = getProvider();

  const symbols = (db.prepare('SELECT symbol FROM watchlist WHERE is_active = 1').all() as { symbol: string }[])
    .map(r => r.symbol);

  const summaries = await Promise.allSettled(
    symbols.map(async (symbol): Promise<MarketSummary> => {
      const data = await provider.getHistoricalPrices(symbol, 60);
      const closes = data.map(d => d.close);
      const ema20 = calculateEMA(closes, 20);
      const ema50 = calculateEMA(closes, 50);
      const rsi14 = calculateRSI(closes, 14);

      const last = data[data.length - 1];
      const prev = data[data.length - 2];
      const change = last.close - prev.close;
      const changePercent = (change / prev.close) * 100;

      const lastEma20 = lastValid(ema20);
      const lastEma50 = lastValid(ema50);
      const lastRsi   = lastValid(rsi14);

      const trend: 'UP' | 'DOWN' | 'NEUTRAL' =
        !isNaN(lastEma20) && !isNaN(lastEma50)
          ? lastEma20 > lastEma50 ? 'UP' : 'DOWN'
          : 'NEUTRAL';

      return {
        symbol,
        lastPrice: Math.round(last.close * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        trend,
        rsi: Math.round(lastRsi),
        aboveEma20: last.close > lastEma20,
        aboveEma50: last.close > lastEma50,
      };
    }),
  );

  const results: MarketSummary[] = summaries
    .filter((r): r is PromiseFulfilledResult<MarketSummary> => r.status === 'fulfilled')
    .map(r => r.value);

  res.json(results);
});

// GET /api/market/:symbol/prices?days=60
router.get('/:symbol/prices', async (req, res) => {
  const { symbol } = req.params;
  const days = Number(req.query.days ?? 60);
  try {
    const provider = getProvider();
    const data: OHLC[] = await provider.getHistoricalPrices(symbol.toUpperCase(), Math.min(days, 200));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/market/:symbol/indicators
router.get('/:symbol/indicators', async (req, res) => {
  const { symbol } = req.params;
  try {
    const provider = getProvider();
    const indicators = await provider.getIndicators(symbol.toUpperCase());
    res.json(indicators);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/market/:symbol/options
router.get('/:symbol/options', async (req, res) => {
  const { symbol } = req.params;
  try {
    const provider = getProvider();
    const chain = await provider.getOptionsChain(symbol.toUpperCase());
    res.json(chain);
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

export default router;
