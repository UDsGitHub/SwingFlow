import { MarketDataProvider, TickerSearchResult } from './MarketDataProvider';
import { OHLC, Indicators, OptionsChain } from '../types';
import { computeIndicators } from '../indicators/technical';
import { marketClock, SESSION_OPEN_MIN, SESSION_CLOSE_MIN } from '../lib/marketTime';

const DATA_URL = 'https://data.alpaca.markets/v2';

// The free plan may query SIP (consolidated, full-volume) data only when it is older than
// 15 minutes, so SIP requests end slightly before "now". IEX has no delay but only a
// fraction of market volume, which skews the breakout volume check.
const SIP_FREE_DELAY_MS = 16 * 60 * 1000;
const ASSET_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 3;

interface AlpacaBar { t: string; o: number; h: number; l: number; c: number; v: number }
interface AlpacaAsset { symbol: string; name: string; tradable: boolean }

export class AlpacaProvider implements MarketDataProvider {
  readonly name = 'alpaca';

  private readonly feed: string;
  private readonly tradingUrl: string;
  private assets: { list: AlpacaAsset[]; fetchedAt: number } | null = null;

  constructor(private keyId: string, private secretKey: string) {
    this.feed = process.env.ALPACA_DATA_FEED?.trim() || 'sip';
    this.tradingUrl = process.env.ALPACA_TRADING_URL?.trim() || 'https://paper-api.alpaca.markets/v2';
  }

  private async request<T>(url: string, attempt = 1): Promise<T> {
    const res = await globalThis.fetch(url, {
      headers: { 'APCA-API-KEY-ID': this.keyId, 'APCA-API-SECRET-KEY': this.secretKey },
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('retry-after')) || attempt;
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return this.request<T>(url, attempt + 1);
    }
    if (!res.ok) throw new Error(`Alpaca ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private dataEnd(): string {
    const delay = this.feed === 'sip' ? SIP_FREE_DELAY_MS : 0;
    return new Date(Date.now() - delay).toISOString();
  }

  private async fetchBars(symbol: string, timeframe: string, start: Date): Promise<OHLC[]> {
    const out: OHLC[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({
        timeframe,
        start: start.toISOString(),
        end: this.dataEnd(),
        limit: '10000',
        adjustment: 'split',
        feed: this.feed,
      });
      if (pageToken) params.set('page_token', pageToken);
      const data = await this.request<{ bars: AlpacaBar[] | null; next_page_token: string | null }>(
        `${DATA_URL}/stocks/${encodeURIComponent(symbol)}/bars?${params.toString()}`,
      );
      for (const b of data.bars ?? []) {
        out.push({ timestamp: Date.parse(b.t), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v });
      }
      pageToken = data.next_page_token ?? undefined;
    } while (pageToken);
    return out;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getHistoricalPrices('SPY', 1);
      return true;
    } catch {
      return false;
    }
  }

  async getHistoricalPrices(symbol: string, days = 120): Promise<OHLC[]> {
    // `days` is a bar count; pad the calendar window for weekends and holidays.
    const start = new Date(Date.now() - (Math.ceil(days * 1.5) + 10) * 86400000);
    const bars = await this.fetchBars(symbol, '1Day', start);
    return bars.slice(-days);
  }

  async getIntradayPrices(symbol: string): Promise<OHLC[]> {
    // Look back far enough to cover weekends, then keep only the most recent regular session
    // (Alpaca intraday bars include pre-market and after-hours trading).
    const all = await this.fetchBars(symbol, '5Min', new Date(Date.now() - 4 * 86400000));
    const bars = all.filter(b => {
      const { minutes } = marketClock(b.timestamp);
      return minutes >= SESSION_OPEN_MIN && minutes < SESSION_CLOSE_MIN;
    });
    if (!bars.length) return [];
    const lastSession = marketClock(bars[bars.length - 1].timestamp).date;
    return bars.filter(b => marketClock(b.timestamp).date === lastSession);
  }

  async getIndicators(symbol: string): Promise<Indicators> {
    return computeIndicators(await this.getHistoricalPrices(symbol));
  }

  async searchTickers(query: string): Promise<TickerSearchResult[]> {
    const q = query.trim().toUpperCase();
    if (!q) return [];

    if (!this.assets || Date.now() - this.assets.fetchedAt > ASSET_CACHE_TTL_MS) {
      const list = await this.request<AlpacaAsset[]>(
        `${this.tradingUrl}/assets?status=active&asset_class=us_equity`,
      );
      this.assets = { list: list.filter(a => a.tradable), fetchedAt: Date.now() };
    }

    const symbolHits = this.assets.list.filter(a => a.symbol.startsWith(q))
      .sort((a, b) => a.symbol.length - b.symbol.length || a.symbol.localeCompare(b.symbol));
    const nameHits = this.assets.list.filter(a => !a.symbol.startsWith(q) && a.name.toUpperCase().includes(q));
    return [...symbolHits, ...nameHits].slice(0, 15).map(a => ({ symbol: a.symbol, name: a.name || a.symbol }));
  }

  async getOptionsChain(_symbol: string): Promise<OptionsChain> {
    void _symbol;
    // Options suggestions are deferred until the stock workflow is validated.
    throw new Error('Options data is not enabled for the Alpaca provider');
  }
}
