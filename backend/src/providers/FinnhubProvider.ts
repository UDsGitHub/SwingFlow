import { MarketDataProvider } from './MarketDataProvider';
import { OHLC, Indicators, OptionsChain } from '../types';
import { calculateEMA, calculateRSI, calculateATR, calculateVolumeSMA } from '../indicators/technical';

const BASE_URL = 'https://finnhub.io/api/v1';
const RATE_LIMIT_MS = 1100; // free tier: 60 req/min

export class FinnhubProvider implements MarketDataProvider {
  readonly name = 'finnhub';
  private lastCallTime = 0;

  constructor(private apiKey: string) {}

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastCallTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed));
    }
    this.lastCallTime = Date.now();
  }

  private async fetch<T>(path: string): Promise<T> {
    await this.rateLimit();
    const url = `${BASE_URL}${path}&token=${this.apiKey}`;
    const res = await globalThis.fetch(url);
    if (!res.ok) {
      const body = await res.text();
      const hint =
        res.status === 403
          ? ' (403 usually means this endpoint is not enabled for your Finnhub plan, or the API key is wrong/expired — verify key in dashboard, try regenerating, and confirm email. Free tier is US symbols only.)'
          : '';
      throw new Error(`Finnhub ${res.status}: ${body}${hint}`);
    }
    return res.json() as Promise<T>;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.fetch('/quote?symbol=AAPL');
      return true;
    } catch {
      return false;
    }
  }

  async getHistoricalPrices(symbol: string, days = 120): Promise<OHLC[]> {
    const to = Math.floor(Date.now() / 1000);
    const from = to - days * 86400;
    const data = await this.fetch<{
      c: number[]; h: number[]; l: number[]; o: number[]; t: number[]; v: number[];
    }>(`/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}`);

    if (!data.c || data.c.length === 0) throw new Error('No candle data from Finnhub');

    return data.t.map((ts, i) => ({
      timestamp: ts * 1000,
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    }));
  }

  async getIntradayPrices(symbol: string): Promise<OHLC[]> {
    const to = Math.floor(Date.now() / 1000);
    const from = to - 86400;
    const data = await this.fetch<{
      c: number[]; h: number[]; l: number[]; o: number[]; t: number[]; v: number[];
    }>(`/stock/candle?symbol=${symbol}&resolution=5&from=${from}&to=${to}`);

    if (!data.c || data.c.length === 0) return [];

    return data.t.map((ts, i) => ({
      timestamp: ts * 1000,
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    }));
  }

  async getIndicators(symbol: string): Promise<Indicators> {
    const data = await this.getHistoricalPrices(symbol);
    const closes = data.map(d => d.close);
    return {
      ema20: calculateEMA(closes, 20),
      ema50: calculateEMA(closes, 50),
      rsi14: calculateRSI(closes, 14),
      atr14: calculateATR(data, 14),
      volumeSma20: calculateVolumeSMA(data, 20),
    };
  }

  async getOptionsChain(_symbol: string): Promise<OptionsChain> {
    // Finnhub free tier does not include options data
    throw new Error('Options chain not available on Finnhub free tier');
  }
}
