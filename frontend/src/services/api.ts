import axios from 'axios';
import { getAuthToken } from '../lib/tokenStore';
import { TradeSetup, MarketSummary, OHLC, Indicators, AccountConfig, AppNotification, TickerSearchResult, ScanEvaluation, ScanResponse, SetupAnalytics, DevelopingSetup, Trade } from '../types';

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
  /** Waiting for entry and open paper trades by default; dismissed setups are excluded. */
  list: (status = 'ACTIVE,TRIGGERED') =>
    api.get<TradeSetup[]>('/setups', { params: { status } }).then(r => r.data),
  all: () =>
    api.get<TradeSetup[]>('/setups/all').then(r => r.data),
  get: (id: string) =>
    api.get<TradeSetup>(`/setups/${id}`).then(r => r.data),
  dailyPnl: () =>
    api.get<{ pnl: number }>('/setups/daily-pnl').then(r => r.data),
  analytics: () =>
    api.get<SetupAnalytics>('/setups/analytics').then(r => r.data),
  scanDiagnostics: () =>
    api.get<ScanEvaluation[]>('/setups/scan-diagnostics').then(r => r.data),
  developingList: (limit = 20) =>
    api.get<DevelopingSetup[]>('/setups/developing', { params: { limit } }).then(r => r.data),
  developingStats: () =>
    api.get<{ converted: number; active: number; everTracked: number }>('/setups/developing-stats').then(r => r.data),
  /** Record that you took this setup at your actual fill. */
  take: (id: string, body: { fillPrice: number; shares: number; stopPrice?: number }) =>
    api.post<Trade>(`/setups/${id}/take`, body).then(r => r.data),
  dismiss: (id: string) =>
    api.delete(`/setups/${id}`).then(r => r.data),
};

export const tradesApi = {
  list: (status?: 'OPEN' | 'CLOSED') =>
    api.get<Trade[]>('/trades', { params: status ? { status } : {} }).then(r => r.data),
  close: (id: string, exitPrice: number) =>
    api.patch<Trade>(`/trades/${id}/close`, { exitPrice }).then(r => r.data),
  update: (id: string, body: { stopPrice?: number; notes?: string | null }) =>
    api.patch<Trade>(`/trades/${id}`, body).then(r => r.data),
};

export const watchlistApi = {
  list: () =>
    api.get<{ symbol: string; added_at: number; is_active: boolean }[]>('/watchlist').then(r => r.data),
  add: (symbol: string) =>
    api.post('/watchlist', { symbol }).then(r => r.data),
  remove: (symbol: string) =>
    api.delete(`/watchlist/${encodeURIComponent(symbol)}`).then(r => r.data),
};

export const marketApi = {
  summary: () =>
    api.get<MarketSummary[]>('/market/summary').then(r => r.data),
  search: (q: string) =>
    api.get<TickerSearchResult[]>('/market/search', { params: { q } }).then(r => r.data),
  prices: (symbol: string, days = 60) =>
    api.get<OHLC[]>(`/market/${encodeURIComponent(symbol)}/prices`, { params: { days } }).then(r => r.data),
  indicators: (symbol: string) =>
    api.get<Indicators>(`/market/${encodeURIComponent(symbol)}/indicators`).then(r => r.data),
};

export const configApi = {
  get: () =>
    api.get<AccountConfig>('/config').then(r => r.data),
  update: (config: Partial<AccountConfig>) =>
    api.patch('/config', config).then(r => r.data),
};

export const scanApi = {
  trigger: () =>
    api.post<ScanResponse>('/scan').then(r => r.data),
  triggerSymbol: (symbol: string) =>
    api.post<ScanResponse>('/scan', { symbols: [symbol] }).then(r => r.data),
};

export const healthApi = {
  get: () =>
    api.get<{ status: string; provider: string; timestamp: string; keys: { polygon: boolean } }>('/health').then(r => r.data),
};

export const notificationsApi = {
  getVapidKey: () =>
    api.get<{ key: string | null }>('/notifications/vapid-public-key').then(r => r.data),
  subscribe: (sub: PushSubscriptionJSON) =>
    api.post('/notifications/subscribe', sub).then(r => r.data),
  unsubscribe: (endpoint: string) =>
    api.post('/notifications/unsubscribe', { endpoint }).then(r => r.data),
  history: () =>
    api.get<AppNotification[]>('/notifications/history').then(r => r.data),
  health: () =>
    api.get<{ configured: boolean; subscriptions: number; lastNotificationAt: number | null; lastNotificationDelivered: boolean | null }>('/notifications/health').then(r => r.data),
  test: () =>
    api.post<{ success: boolean }>('/notifications/test').then(r => r.data),
};

export default api;
