import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MarketSummary } from '../types';
import { marketApi, watchlistApi } from '../services/api';

// ── Query keys ────────────────────────────────────────────────────
export const queryKeys = {
  marketSummary: ['market', 'summary'] as const,
  chart: (symbol: string, days: number) => ['chart', symbol, days] as const,
  watchlist: ['watchlist'] as const,
};

// ── Market summary — polls every 60s, stale after 60s ────────────
export function useMarketSummary(_pollInterval = 60_000) {
  const { data = [], isLoading, dataUpdatedAt } = useQuery<MarketSummary[]>({
    queryKey: queryKeys.marketSummary,
    queryFn: () => marketApi.summary(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return {
    summaries: data,
    loading: isLoading,
    error: null as string | null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    refresh: async () => { /* data auto-refreshes via refetchInterval */ },
  };
}

// ── Watchlist symbols — stale after 2 min ────────────────────────
export function useWatchlist() {
  const queryClient = useQueryClient();

  const { data: symbols = [], isLoading, isPending } = useQuery<string[]>({
    queryKey: queryKeys.watchlist,
    queryFn: async () => {
      const rows = await watchlistApi.list();
      return rows.map(r => r.symbol);
    },
    staleTime: 2 * 60_000,
  });

  const addSymbol = useCallback(async (symbol: string) => {
    await watchlistApi.add(symbol);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist }),
      // Summary is computed from watchlist server-side; refresh so new rows get price / RSI.
      queryClient.invalidateQueries({ queryKey: queryKeys.marketSummary }),
    ]);
  }, [queryClient]);

  const removeSymbol = useCallback(async (symbol: string) => {
    await watchlistApi.remove(symbol);
    // Optimistic remove — avoid a full refetch just to drop one item
    queryClient.setQueryData<string[]>(
      queryKeys.watchlist,
      prev => (prev ?? []).filter(s => s !== symbol),
    );
    await queryClient.invalidateQueries({ queryKey: queryKeys.marketSummary });
  }, [queryClient]);

  return { symbols, loading: isLoading, isPending, addSymbol, removeSymbol };
}

// ── Chart data — cached 5 min per (symbol, days) pair ────────────
export function useChartData(symbol: string, days = 60) {
  const { data = [], isLoading } = useQuery({
    queryKey: queryKeys.chart(symbol, days),
    queryFn: async () => {
      const [ohlc, ind] = await Promise.all([
        marketApi.prices(symbol, days),
        marketApi.indicators(symbol),
      ]);
      return ohlc.map((d, i) => ({
        timestamp: d.timestamp,
        open:      d.open,
        high:      d.high,
        low:       d.low,
        close:     d.close,
        volume:    d.volume,
        ema20:     ind.ema20[i],
        ema50:     ind.ema50[i],
        rsi14:     ind.rsi14[i],
      }));
    },
    staleTime: 5 * 60_000,
    enabled: !!symbol,
  });

  return { prices: data, loading: isLoading };
}
