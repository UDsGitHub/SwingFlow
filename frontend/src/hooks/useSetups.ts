import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TradeSetup } from '../types';
import { setupsApi } from '../services/api';

// ── Query keys ────────────────────────────────────────────────────
export const setupQueryKeys = {
  active: ['setups', 'active'] as const,
  all:    ['setups', 'all']    as const,
  detail: (id: string) => ['setup', id] as const,
};

// ── Open setups (waiting for entry + paper trade open) — polls every 30s ──
export function useSetups(_pollInterval = 30_000) {
  const queryClient = useQueryClient();

  const { data: setups = [], isLoading, dataUpdatedAt } = useQuery<TradeSetup[]>({
    queryKey: setupQueryKeys.active,
    queryFn: () => setupsApi.list(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // Returns fresh data so AppContext.triggerScan can use the count
  const refresh = useCallback(async (): Promise<TradeSetup[]> => {
    const data = await setupsApi.list();
    queryClient.setQueryData(setupQueryKeys.active, data);
    return data;
  }, [queryClient]);

  const dismissSetup = useCallback(async (id: string) => {
    await setupsApi.dismiss(id);
    // Optimistic remove
    queryClient.setQueryData<TradeSetup[]>(
      setupQueryKeys.active,
      prev => (prev ?? []).filter(s => s.id !== id),
    );
  }, [queryClient]);

  return {
    setups,
    loading: isLoading,
    error: null as string | null,
    lastUpdated: dataUpdatedAt ? new Date(dataUpdatedAt) : null,
    refresh,
    dismissSetup,
  };
}

// ── All setups (completed + expired) — used by history views ─────
// Stale after 2 min; trade history changes infrequently mid-session.
export function useAllSetups() {
  const { data = [], isLoading } = useQuery<TradeSetup[]>({
    queryKey: setupQueryKeys.all,
    queryFn: () => setupsApi.all(),
    staleTime: 2 * 60_000,
  });

  return { allSetups: data, loading: isLoading };
}

// ── Single setup detail ───────────────────────────────────────────
// Seeds from the active-setups cache so navigation from the dashboard
// shows the card instantly with zero loading state.
export function useSetupDetail(id: string) {
  const queryClient = useQueryClient();

  const { data: setup, isLoading, error, refetch } = useQuery<TradeSetup>({
    queryKey: setupQueryKeys.detail(id),
    queryFn: () => setupsApi.get(id),
    staleTime: 30_000,
    enabled: !!id,

    // Seed from the already-loaded active setups list
    initialData: () =>
      queryClient
        .getQueryData<TradeSetup[]>(setupQueryKeys.active)
        ?.find(s => s.id === id),

    // Tell React Query when that seed data was fetched so it can decide
    // whether to background-refresh immediately or wait out the staleTime
    initialDataUpdatedAt: () =>
      queryClient.getQueryState(setupQueryKeys.active)?.dataUpdatedAt,
  });

  return {
    setup:   setup ?? null,
    loading: isLoading,
    error:   error ? 'Setup not found' : null,
    refetch: async () => { await refetch(); },
  };
}
