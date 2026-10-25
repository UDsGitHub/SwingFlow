import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trade } from '../types';
import { tradesApi } from '../services/api';

export const tradeQueryKeys = {
  open: ['trades', 'OPEN'] as const,
  closed: ['trades', 'CLOSED'] as const,
};

/** The user's open positions — polls so suggested (trailing) stops stay current. */
export function useOpenTrades() {
  const { data = [], isLoading } = useQuery<Trade[]>({
    queryKey: tradeQueryKeys.open,
    queryFn: () => tradesApi.list('OPEN'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return { openTrades: data, loading: isLoading };
}

export function useClosedTrades() {
  const { data = [], isLoading } = useQuery<Trade[]>({
    queryKey: tradeQueryKeys.closed,
    queryFn: () => tradesApi.list('CLOSED'),
    staleTime: 60_000,
  });
  return { closedTrades: data, loading: isLoading };
}

/** Refetch everything a trade change affects (positions, history, setups, goal progress). */
export function useRefreshTrades() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['trades'] }),
      queryClient.invalidateQueries({ queryKey: ['setups'] }),
      queryClient.invalidateQueries({ queryKey: ['setup'] }),
      queryClient.invalidateQueries({ queryKey: ['goal'] }),
    ]);
  }, [queryClient]);
}
