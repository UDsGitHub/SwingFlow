import { MarketDataProvider } from './MarketDataProvider';
import { MockDataProvider } from './MockDataProvider';
import { PolygonProvider } from './PolygonProvider';

export type ProviderName = 'mock' | 'polygon';

let _instance: MarketDataProvider | null = null;

export function createProvider(name?: ProviderName): MarketDataProvider {
  const providerName = (name ?? process.env.DATA_PROVIDER ?? 'mock') as ProviderName;

  switch (providerName) {
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

export function getProvider(): MarketDataProvider {
  if (!_instance) _instance = createProvider();
  return _instance;
}

export function resetProvider(): void {
  _instance = null;
}
