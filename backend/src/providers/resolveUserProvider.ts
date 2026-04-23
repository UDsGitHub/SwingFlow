import { createProvider, ProviderName } from './ProviderFactory';
import { MarketDataProvider } from './MarketDataProvider';
import { supabaseAdmin } from '../db/supabase';

/** Build a provider from a stored setting name; falls back to env then mock; uses mock if API keys missing. */
export function providerFromName(dataProvider: string | null | undefined): MarketDataProvider {
  const resolved = (dataProvider ?? process.env.DATA_PROVIDER ?? 'mock') as ProviderName;
  try {
    return createProvider(resolved);
  } catch (err) {
    console.warn(`[Provider] "${resolved}" unavailable, using mock:`, err);
    return createProvider('mock');
  }
}

/** Loads `settings.data_provider` and returns the matching provider (never throws). */
export async function getProviderForUser(userId: string): Promise<MarketDataProvider> {
  const { data: cfg } = await supabaseAdmin
    .from('settings')
    .select('data_provider')
    .eq('user_id', userId)
    .single();

  return providerFromName(cfg?.data_provider as string | null | undefined);
}
