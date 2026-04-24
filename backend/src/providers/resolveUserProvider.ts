import { createProvider, ProviderName } from './ProviderFactory';
import { MarketDataProvider } from './MarketDataProvider';

/** Resolve a named provider; falls back to mock if keys are missing or the name is invalid. */
export function providerFromName(dataProvider: string | null | undefined): MarketDataProvider {
  const resolved = (dataProvider ?? process.env.DATA_PROVIDER ?? 'mock') as ProviderName;
  try {
    return createProvider(resolved);
  } catch (err) {
    console.warn(`[Provider] "${resolved}" unavailable, using mock:`, err);
    return createProvider('mock');
  }
}

/**
 * Market data source for all users. Production uses Polygon (Massive); set `DATA_PROVIDER`
 * in backend `.env` (e.g. `mock`) for local development without API keys.
 */
export async function getProviderForUser(_userId: string): Promise<MarketDataProvider> {
  void _userId;
  const fromEnv = process.env.DATA_PROVIDER as ProviderName | undefined;
  return providerFromName(fromEnv ?? 'polygon');
}
