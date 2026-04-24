import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getProviderForUser } from '../providers/resolveUserProvider';
import { MarketSummary, OHLC } from '../types';
import type { TickerSearchResult } from '../providers/MarketDataProvider';
import { calculateEMA, calculateRSI, lastValid } from '../indicators/technical';

const router = Router();
router.use(requireAuth);

// GET /api/market/summary
router.get('/summary', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const { supabaseAdmin } = await import('../db/supabase');

  const { data: wl } = await supabaseAdmin
    .from('watchlist')
    .select('symbol')
    .eq('user_id', userId)
    .eq('is_active', true);

  const symbols = (wl ?? []).map((r: { symbol: string }) => r.symbol);
  if (symbols.length === 0) return res.json([]);

  const provider = await getProviderForUser(userId);

  const results = await Promise.allSettled(
    symbols.map(async (symbol): Promise<MarketSummary> => {
      const data = await provider.getHistoricalPrices(symbol, 60);
      const closes = data.map(d => d.close);
      const ema20 = calculateEMA(closes, 20);
      const ema50 = calculateEMA(closes, 50);
      const rsi14 = calculateRSI(closes, 14);
      const last = data[data.length - 1];
      const prev = data[data.length - 2];
      const change = last.close - prev.close;
      const lastEma20 = lastValid(ema20);
      const lastEma50 = lastValid(ema50);
      return {
        symbol,
        lastPrice:     Math.round(last.close * 100) / 100,
        change:        Math.round(change * 100) / 100,
        changePercent: Math.round((change / prev.close) * 10000) / 100,
        trend: !isNaN(lastEma20) && !isNaN(lastEma50)
          ? lastEma20 > lastEma50 ? 'UP' : 'DOWN'
          : 'NEUTRAL',
        rsi:         Math.round(lastValid(rsi14)),
        aboveEma20:  last.close > lastEma20,
        aboveEma50:  last.close > lastEma50,
      };
    }),
  );

  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (rejected.length > 0) {
    console.warn(
      `[market/summary] ${rejected.length}/${symbols.length} symbol(s) failed:`,
      rejected.map(r => String(r.reason)),
    );
  }

  res.json(
    results
      .filter((r): r is PromiseFulfilledResult<MarketSummary> => r.status === 'fulfilled')
      .map(r => r.value),
  );
});

// GET /api/market/search?q= — ticker lookup (Polygon / mock)
router.get('/search', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  try {
    const provider = await getProviderForUser(userId);
    const results: TickerSearchResult[] = await provider.searchTickers(q);
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});

// GET /api/market/:symbol/prices?days=60
router.get('/:symbol/prices', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  const days = Math.min(Number(req.query.days ?? 60), 200);
  try {
    const provider = await getProviderForUser(userId);
    const data: OHLC[] = await provider.getHistoricalPrices(req.params.symbol.toUpperCase(), days);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/market/:symbol/indicators
router.get('/:symbol/indicators', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  try {
    const provider = await getProviderForUser(userId);
    res.json(await provider.getIndicators(req.params.symbol.toUpperCase()));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/market/:symbol/options
router.get('/:symbol/options', async (req, res: Response) => {
  const userId = (req as unknown as AuthRequest).userId;
  try {
    const provider = await getProviderForUser(userId);
    res.json(await provider.getOptionsChain(req.params.symbol.toUpperCase()));
  } catch (err) {
    res.status(404).json({ error: String(err) });
  }
});

export default router;
