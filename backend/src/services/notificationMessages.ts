import { TradeSetup } from '../types';

export interface PushPayload {
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export function newSetupPayload(setup: TradeSetup): PushPayload {
  return {
    title: `🎯 ${setup.symbol} — ${setup.strategy.replace('_', ' ')}`,
    body: `Entry $${setup.entry} · Stop $${setup.stop} · Target $${setup.target} · RR ${setup.riskReward}:1 · ${setup.confidence}% confidence`,
    data: { setupId: setup.id, type: 'NEW_SETUP' },
  };
}

/** Several setups from one scan become a single digest that opens the dashboard. */
export function newSetupsDigestPayload(setups: TradeSetup[]): PushPayload {
  const symbols = setups.map(s => s.symbol);
  return {
    title: `🎯 ${setups.length} new setups`,
    body: `${symbols.slice(0, 5).join(', ')}${symbols.length > 5 ? ` +${symbols.length - 5} more` : ''} · tap to review`,
    data: { type: 'NEW_SETUPS' },
  };
}

export function entryZonePayload(setup: TradeSetup, currentPrice: number): PushPayload {
  return {
    title: `⚡ ${setup.symbol} entering entry zone`,
    body: `Current $${currentPrice} · Entry $${setup.entry} · Target $${setup.target}`,
    data: { setupId: setup.id, type: 'ENTRY_ZONE' },
  };
}
