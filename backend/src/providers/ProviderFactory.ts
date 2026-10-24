import { MarketDataProvider } from './MarketDataProvider';
import { MockDataProvider } from './MockDataProvider';
import { PolygonProvider } from './PolygonProvider';
import { AlpacaProvider } from './AlpacaProvider';

export type ProviderName = 'mock' | 'alpaca' | 'polygon';

export function createProvider(name?: ProviderName): MarketDataProvider {
  const providerName = (name ?? process.env.DATA_PROVIDER ?? 'mock') as ProviderName;

  switch (providerName) {
    case 'alpaca': {
      const keyId = process.env.ALPACA_API_KEY?.trim();
      const secret = process.env.ALPACA_SECRET_KEY?.trim();
      if (!keyId || !secret) {
        throw new Error('ALPACA_API_KEY and ALPACA_SECRET_KEY must be set — set DATA_PROVIDER=mock to use mock data');
      }
      return new AlpacaProvider(keyId, secret);
    }
    case 'polygon': {
      const key = process.env.POLYGON_API_KEY?.trim();
      if (!key) throw new Error('POLYGON_API_KEY not set — set DATA_PROVIDER=mock to use mock data');
      return new PolygonProvider(key);
    }
    case 'mock':
    default:
      return new MockDataProvider();
  }
}
