import { useState, useEffect, useCallback } from 'react';
import { MarketSummary } from '../types';
import { marketApi, watchlistApi } from '../services/api';

export function useMarketSummary(pollInterval = 60000) {
  const [summaries, setSummaries] = useState<MarketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await marketApi.summary();
      setSummaries(data);
      setError(null);
    } catch (e) {
      setError('Failed to load market data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, pollInterval);
    return () => clearInterval(id);
  }, [fetch, pollInterval]);

  return { summaries, loading, error, refresh: fetch };
}

export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSymbols = useCallback(async () => {
    try {
      const data = await watchlistApi.list();
      setSymbols(data.map(d => d.symbol));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSymbols(); }, [fetchSymbols]);

  const addSymbol = useCallback(async (symbol: string) => {
    await watchlistApi.add(symbol);
    await fetchSymbols();
  }, [fetchSymbols]);

  const removeSymbol = useCallback(async (symbol: string) => {
    await watchlistApi.remove(symbol);
    setSymbols(prev => prev.filter(s => s !== symbol));
  }, []);

  return { symbols, loading, addSymbol, removeSymbol };
}

export function useChartData(symbol: string, days = 60) {
  const [prices, setPrices] = useState<{ timestamp: number; close: number; volume: number; ema20?: number; ema50?: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    Promise.all([marketApi.prices(symbol, days), marketApi.indicators(symbol)])
      .then(([ohlc, ind]) => {
        const combined = ohlc.map((d, i) => ({
          timestamp: d.timestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
          ema20: ind.ema20[i],
          ema50: ind.ema50[i],
          rsi14: ind.rsi14[i],
        }));
        setPrices(combined);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [symbol, days]);

  return { prices, loading };
}
