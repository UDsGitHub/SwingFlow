import { StockSuggestion, OptionsSuggestion, OptionsChain, Direction } from '../types';

interface SizingInput {
  entry: number;
  stop: number;
  target: number;
  accountSize: number;
  riskPercent: number;
}

export class PositionSizingService {
  calculate(input: SizingInput): StockSuggestion {
    const { entry, stop, target, accountSize, riskPercent } = input;
    const riskDollars = accountSize * (riskPercent / 100);
    const riskPerShare = Math.max(entry - stop, 0.01);
    const shares = Math.floor(riskDollars / riskPerShare);
    const capitalRequired = Math.round(shares * entry * 100) / 100;
    const potentialGainDollars = Math.round(shares * (target - entry) * 100) / 100;

    return {
      shares,
      capitalRequired,
      riskDollars: Math.round(riskDollars * 100) / 100,
      potentialGainDollars,
    };
  }

  calculateOptions(
    chain: OptionsChain,
    direction: Direction,
    entry: number,
    accountSize: number,
    riskPercent: number,
  ): OptionsSuggestion | null {
    const riskBudget = accountSize * (riskPercent / 100);
    const contracts = chain[direction === 'LONG' ? 'calls' : 'puts'];

    // Filter to 2-3 week expiration window
    const now = Date.now();
    const minExp = now + 10 * 86400000;
    const maxExp = now + 25 * 86400000;

    const candidates = contracts.filter(c => {
      const exp = new Date(c.expiration).getTime();
      return exp >= minExp && exp <= maxExp && c.premium > 0;
    });

    if (candidates.length === 0) return null;

    // Prefer ATM or slightly ITM: delta between 0.45 and 0.65 for calls
    const sorted = [...candidates].sort((a, b) => {
      const da = Math.abs(Math.abs(a.delta) - 0.55);
      const db = Math.abs(Math.abs(b.delta) - 0.55);
      return da - db;
    });

    const chosen = sorted[0];
    const costPerContract = chosen.premium * 100;
    if (costPerContract <= 0) return null;

    const numContracts = Math.max(1, Math.floor(riskBudget / costPerContract));
    const totalCost = Math.round(numContracts * costPerContract * 100) / 100;
    const maxGain = Math.round(numContracts * (entry - chosen.strike) * 100 * 2.5 * 100) / 100;

    return {
      type: direction === 'LONG' ? 'CALL' : 'PUT',
      strike: chosen.strike,
      expiration: chosen.expiration,
      estimatedPremium: chosen.premium,
      contracts: numContracts,
      totalCost,
      maxGain: Math.max(maxGain, 0),
      delta: chosen.delta,
    };
  }
}
