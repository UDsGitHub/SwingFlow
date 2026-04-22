import { OHLC, Indicators, OptionsChain } from '../types';

export interface MarketDataProvider {
  readonly name: string;
  getHistoricalPrices(symbol: string, days?: number): Promise<OHLC[]>;
  getIntradayPrices(symbol: string): Promise<OHLC[]>;
  getIndicators(symbol: string): Promise<Indicators>;
  getOptionsChain(symbol: string): Promise<OptionsChain>;
  isAvailable(): Promise<boolean>;
}
