import axios from 'axios';
import { TradeSetup, MarketSummary, OHLC, Indicators, AccountConfig } from '../types';

const api = axios.create({ baseURL: '/api', timeout: 15000 });

export const setupsApi = {
  list: (status = 'ACTIVE') =>
    api.get<TradeSetup[]>('/setups', { params: { status } }).then(r => r.data),

  all: () =>
    api.get<TradeSetup[]>('/setups/all').then(r => r.data),

  get: (id: string) =>
    api.get<TradeSetup>(`/setups/${id}`).then(r => r.data),

  updateStatus: (id: string, status: string) =>
    api.patch(`/setups/${id}/status`, { status }).then(r => r.data),

  dismiss: (id: string) =>
    api.delete(`/setups/${id}`).then(r => r.data),
};

export const watchlistApi = {
  list: () =>
    api.get<{ symbol: string; added_at: number; is_active: number }[]>('/watchlist').then(r => r.data),

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
};

export const notificationsApi = {
  getVapidKey: () =>
    api.get<{ key: string | null }>('/notifications/vapid-public-key').then(r => r.data),

  subscribe: (sub: PushSubscriptionJSON) =>
    api.post('/notifications/subscribe', sub).then(r => r.data),
};
