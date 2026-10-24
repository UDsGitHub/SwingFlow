import { createProvider, ProviderName } from './ProviderFactory';
import { MarketDataProvider } from './MarketDataProvider';
import { CachedProvider } from './CachedProvider';

// One cached instance per provider so scans, regime checks and monitoring jobs share fetches.
const instances = new Map<string, MarketDataProvider>();

/** Resolve a named provider; falls back to mock if keys are missing or the name is invalid. */
export function providerFromName(dataProvider: string | null | undefined): MarketDataProvider {
  const resolved = (dataProvider ?? process.env.DATA_PROVIDER ?? 'mock') as ProviderName;
  const existing = instances.get(resolved);
  if (existing) return existing;

  let provider: MarketDataProvider;
  try {
    provider = new CachedProvider(createProvider(resolved));
  } catch (err) {
    console.warn(`[Provider] "${resolved}" unavailable, using mock:`, err);
    provider = providerFromName('mock');
  }
  instances.set(resolved, provider);
  return provider;
}

/**
 * Market data source for all users. Production uses Alpaca; set `DATA_PROVIDER`
 * in backend `.env` (e.g. `mock`) for local development without API keys.
 */
export async function getProviderForUser(_userId: string): Promise<MarketDataProvider> {
  void _userId;
  const fromEnv = process.env.DATA_PROVIDER as ProviderName | undefined;
  return providerFromName(fromEnv ?? 'alpaca');
}
