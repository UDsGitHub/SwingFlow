import axios from 'axios';
import { getAuthToken } from '../lib/tokenStore';
import { TradeSetup, MarketSummary, OHLC, Indicators, AccountConfig, AppNotification } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15000,
});

// Attach the Clerk JWT to every request automatically.
// getAuthToken() pulls from the tokenStore, which is registered
// in App.tsx using Clerk's useAuth hook.
api.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const setupsApi = {
  list: (status = 'ACTIVE') =>
    api.get<TradeSetup[]>('/setups', { params: { status } }).then(r => r.data),
  all: () =>
    api.get<TradeSetup[]>('/setups/all').then(r => r.data),
  get: (id: string) =>
    api.get<TradeSetup>(`/setups/${id}`).then(r => r.data),
  dailyPnl: () =>
    api.get<{ pnl: number }>('/setups/daily-pnl').then(r => r.data),
  close: (id: string, exitPrice: number) =>
    api.patch<{ success: boolean; realizedPnl: number }>(`/setups/${id}/close`, { exitPrice }).then(r => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/setups/${id}/status`, { status }).then(r => r.data),
  dismiss: (id: string) =>
    api.delete(`/setups/${id}`).then(r => r.data),
};

export const watchlistApi = {
  list: () =>
    api.get<{ symbol: string; added_at: number; is_active: boolean }[]>('/watchlist').then(r => r.data),
  add: (symbol: string) =>
    api.post('/watchlist', { symbol }).then(r => r.data),
  remove: (symbol: string) =>
    api.delete(`/watchlist/${symbol}`).then(r => r.data),
};

export const marketApi = {
  summary: () =>
    api.get<MarketSummary[]>('/market/summary').then(r => r.data),
  prices: (symbol: string, days = 60) =>
    api.get<OHLC[]>(`/market/${symbol}/prices`, { params: { days } }).then(r => r.data),
  indicators: (symbol: string) =>
    api.get<Indicators>(`/market/${symbol}/indicators`).then(r => r.data),
};

export const configApi = {
  get: () =>
    api.get<AccountConfig>('/config').then(r => r.data),
  update: (config: Partial<AccountConfig>) =>
    api.patch('/config', config).then(r => r.data),
};

export const scanApi = {
  trigger: () =>
    api.post('/scan').then(r => r.data),
  triggerSymbol: (symbol: string) =>
    api.post('/scan', { symbols: [symbol] }).then(r => r.data),
};

export const healthApi = {
  get: () =>
    api.get<{ status: string; provider: string; timestamp: string; keys: { finnhub: boolean; polygon: boolean } }>('/health').then(r => r.data),
};

export const notificationsApi = {
  getDevFeatures: () =>
    api.get<{ testPush: boolean }>('/notifications/dev-features').then(r => r.data),
  getVapidKey: () =>
    api.get<{ key: string | null }>('/notifications/vapid-public-key').then(r => r.data),
  subscribe: (sub: PushSubscriptionJSON) =>
    api.post('/notifications/subscribe', sub).then(r => r.data),
  unsubscribe: (endpoint: string) =>
    api.post('/notifications/unsubscribe', { endpoint }).then(r => r.data),
  history: () =>
    api.get<AppNotification[]>('/notifications/history').then(r => r.data),
  /** Dev backend only: schedules OS push after ~10s (tab away to test). */
  scheduleTestPush: () =>
    api.post<{ ok: boolean; scheduledInMs: number }>('/notifications/test-push').then(r => r.data),
};
