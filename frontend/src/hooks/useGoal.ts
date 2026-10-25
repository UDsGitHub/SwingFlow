import { useCallback } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountConfig, GoalStatus } from '../types';
import { goalApi } from '../services/api';

export const goalQueryKey = ['goal'] as const;

/** Progress toward the saved goal this period, and whether it is reachable. */
export function useGoal() {
  const { data, isLoading } = useQuery<GoalStatus>({
    queryKey: goalQueryKey,
    queryFn: () => goalApi.get(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return { goal: data ?? null, loading: isLoading };
}

/** Feasibility of unsaved settings; keeps the last answer on screen while the next one loads. */
export function useGoalPreview(draft: AccountConfig | null) {
  const { data, isFetching, isError } = useQuery<GoalStatus>({
    queryKey: [...goalQueryKey, 'preview', draft],
    queryFn: () => goalApi.get(draft ?? undefined),
    enabled: draft !== null,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  return { preview: data ?? null, fetching: isFetching, error: isError };
}

export function useRefreshGoal() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: goalQueryKey }), [queryClient]);
}
