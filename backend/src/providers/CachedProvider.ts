import { MarketDataProvider, TickerSearchResult } from './MarketDataProvider';
import { OHLC, Indicators, OptionsChain } from '../types';
import { computeIndicators } from '../indicators/technical';

const DEFAULT_TTL_MS = 60 * 1000;
const INDICATOR_BARS = 120;

interface HistoryEntry {
  days: number;
  fetchedAt: number;
  bars: Promise<OHLC[]>;
}

/**
 * Short-lived memo around a provider so one scan (engine, regime check, entry-zone and
 * lifecycle jobs) fetches each symbol's daily history once. Smaller requests are served
 * by slicing a larger cached fetch; concurrent requests share the in-flight promise.
 */
export class CachedProvider implements MarketDataProvider {
  private history = new Map<string, HistoryEntry>();

  constructor(private inner: MarketDataProvider, private ttlMs = DEFAULT_TTL_MS) {}

  get name(): string {
    return this.inner.name;
  }

  async getHistoricalPrices(symbol: string, days = INDICATOR_BARS): Promise<OHLC[]> {
    const key = symbol.toUpperCase();
    const cached = this.history.get(key);
    if (cached && cached.days >= days && Date.now() - cached.fetchedAt < this.ttlMs) {
      return (await cached.bars).slice(-days);
    }

    // Always fetch at least the indicator window so follow-up calls hit the cache.
    const fetchDays = Math.max(days, INDICATOR_BARS);
    const entry: HistoryEntry = {
      days: fetchDays,
      fetchedAt: Date.now(),
      bars: this.inner.getHistoricalPrices(symbol, fetchDays),
    };
    this.history.set(key, entry);
    entry.bars.catch(() => {
      if (this.history.get(key) === entry) this.history.delete(key);
    });
    return (await entry.bars).slice(-days);
  }

  async getIndicators(symbol: string): Promise<Indicators> {
    return computeIndicators(await this.getHistoricalPrices(symbol, INDICATOR_BARS));
  }

  getIntradayPrices(symbol: string): Promise<OHLC[]> {
    return this.inner.getIntradayPrices(symbol);
  }

  getOptionsChain(symbol: string): Promise<OptionsChain> {
    return this.inner.getOptionsChain(symbol);
  }

  isAvailable(): Promise<boolean> {
    return this.inner.isAvailable();
  }

  searchTickers(query: string): Promise<TickerSearchResult[]> {
    return this.inner.searchTickers(query);
  }
}
