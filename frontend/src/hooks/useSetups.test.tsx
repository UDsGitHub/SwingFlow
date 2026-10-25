import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useSetups } from './useSetups';
import { setupsApi } from '../services/api';
import { makeSetup } from '../test/fixtures';

vi.mock('../services/api', () => ({ setupsApi: { list: vi.fn(), dismiss: vi.fn() } }));

describe('useSetups', () => {
  it('loads open setups with the API default (waiting for entry and paper trades open), not only ACTIVE', async () => {
    vi.mocked(setupsApi.list).mockResolvedValue([makeSetup(), makeSetup({ id: 'b', status: 'TRIGGERED' })]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSetups(), { wrapper });
    await waitFor(() => expect(result.current.setups).toHaveLength(2));
    expect(setupsApi.list).toHaveBeenCalledWith();
  });
});
