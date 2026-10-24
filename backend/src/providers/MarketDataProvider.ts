import { OHLC, Indicators, OptionsChain } from '../types';

export interface TickerSearchResult {
  symbol: string;
  name: string;
}

export interface MarketDataProvider {
  readonly name: string;
  /** The most recent `days` daily bars (a bar count, not calendar days), oldest first. Includes today's partial bar during the session. */
  getHistoricalPrices(symbol: string, days?: number): Promise<OHLC[]>;
  getIntradayPrices(symbol: string): Promise<OHLC[]>;
  getIndicators(symbol: string): Promise<Indicators>;
  getOptionsChain(symbol: string): Promise<OptionsChain>;
  isAvailable(): Promise<boolean>;
  searchTickers(query: string): Promise<TickerSearchResult[]>;
}
