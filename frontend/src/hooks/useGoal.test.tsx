import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useGoal, useGoalPreview } from './useGoal';
import { goalApi } from '../services/api';
import { makeGoal } from '../test/fixtures';
import { AccountConfig } from '../types';

vi.mock('../services/api', () => ({ goalApi: { get: vi.fn() } }));

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useGoal', () => {
  it('loads the saved goal without draft parameters', async () => {
    vi.mocked(goalApi.get).mockResolvedValue(makeGoal());
    const { result } = renderHook(() => useGoal(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.goal?.goalAmount).toBe(100));
    expect(goalApi.get).toHaveBeenCalledWith();
  });

  it('previews draft settings, and asks nothing while there is no valid draft', async () => {
    vi.mocked(goalApi.get).mockReset();
    vi.mocked(goalApi.get).mockResolvedValue(makeGoal({ draft: true }));
    const draft: AccountConfig = { accountSize: '5000', goalAmount: '10', goalPeriod: 'MONTHLY', riskPercent: '1', maxRiskPercent: '2' };
    const { result, rerender } = renderHook(({ d }: { d: AccountConfig | null }) => useGoalPreview(d), { wrapper: wrapper(), initialProps: { d: null as AccountConfig | null } });
    expect(goalApi.get).not.toHaveBeenCalled();
    rerender({ d: draft });
    await waitFor(() => expect(result.current.preview?.draft).toBe(true));
    expect(goalApi.get).toHaveBeenCalledWith(draft);
  });
});
