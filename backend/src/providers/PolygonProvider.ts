import { MarketDataProvider, TickerSearchResult } from './MarketDataProvider';
import { OHLC, Indicators, OptionsChain, OptionsContract } from '../types';
import { computeIndicators } from '../indicators/technical';

const BASE_URL = 'https://api.polygon.io/v2';
const REF_URL = 'https://api.polygon.io/v3/reference';

export class PolygonProvider implements MarketDataProvider {
  readonly name = 'polygon';

  constructor(private apiKey: string) {}

  private async fetch<T>(path: string): Promise<T> {
    const url = `${BASE_URL}${path}?apiKey=${this.apiKey}`;
    const res = await globalThis.fetch(url);
    if (!res.ok) throw new Error(`Polygon ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.fetch('/aggs/ticker/AAPL/range/1/day/2023-01-01/2023-01-05');
      return true;
    } catch {
      return false;
    }
  }

  async getHistoricalPrices(symbol: string, days = 120): Promise<OHLC[]> {
    // `days` is a bar count; pad the calendar window for weekends and holidays.
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (Math.ceil(days * 1.5) + 10));

    const toStr = to.toISOString().split('T')[0];
    const fromStr = from.toISOString().split('T')[0];

    const data = await this.fetch<{
      results: Array<{ o: number; h: number; l: number; c: number; v: number; t: number }>;
    }>(`/aggs/ticker/${symbol}/range/1/day/${fromStr}/${toStr}`);

    return (data.results || []).map(r => ({
      timestamp: r.t,
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      volume: r.v,
    })).slice(-days);
  }

  async getIntradayPrices(symbol: string): Promise<OHLC[]> {
    const today = new Date().toISOString().split('T')[0];
    const data = await this.fetch<{
      results: Array<{ o: number; h: number; l: number; c: number; v: number; t: number }>;
    }>(`/aggs/ticker/${symbol}/range/5/minute/${today}/${today}`);

    return (data.results || []).map(r => ({
      timestamp: r.t,
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      volume: r.v,
    }));
  }

  async getIndicators(symbol: string): Promise<Indicators> {
    return computeIndicators(await this.getHistoricalPrices(symbol));
  }

  async searchTickers(query: string): Promise<TickerSearchResult[]> {
    const q = query.trim();
    if (q.length < 1) return [];
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      search: q,
      active: 'true',
      limit: '15',
      market: 'stocks',
    });
    const res = await globalThis.fetch(`${REF_URL}/tickers?${params.toString()}`);
    if (!res.ok) throw new Error(`Polygon ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as {
      results?: Array<{ ticker: string; name?: string }>;
    };
    return (data.results ?? []).map(r => ({
      symbol: r.ticker,
      name: r.name?.trim() || r.ticker,
    }));
  }

  async getOptionsChain(symbol: string): Promise<OptionsChain> {
    // Polygon v3 options endpoint
    const url = `https://api.polygon.io/v3/snapshot/options/${symbol}?apiKey=${this.apiKey}&limit=50`;
    const res = await globalThis.fetch(url);
    if (!res.ok) throw new Error(`Polygon options ${res.status}`);

    const data = await res.json() as {
      results: Array<{
        details: { contract_type: string; strike_price: number; expiration_date: string };
        greeks: { delta: number };
        implied_volatility: number;
        day: { last_price: number; volume: number; open_interest: number };
      }>;
    };

    const historical = await this.getHistoricalPrices(symbol, 5);
    const underlying = historical[historical.length - 1].close;

    const calls: OptionsContract[] = [];
    const puts: OptionsContract[] = [];

    for (const r of (data.results || [])) {
      const contract: OptionsContract = {
        strike: r.details.strike_price,
        expiration: r.details.expiration_date,
        type: r.details.contract_type === 'call' ? 'CALL' : 'PUT',
        premium: r.day?.last_price ?? 0,
        delta: r.greeks?.delta ?? 0,
        impliedVolatility: r.implied_volatility ?? 0,
        openInterest: r.day?.open_interest ?? 0,
        volume: r.day?.volume ?? 0,
      };
      if (contract.type === 'CALL') calls.push(contract);
      else puts.push(contract);
    }

    return { symbol, underlying, calls, puts };
  }
}
