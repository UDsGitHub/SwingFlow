import { StrategyResult } from '../types';

export class SetupScoringService {
  score(result: StrategyResult): number {
    const base = result.confidence;
    const checksPassed = Object.values(result.checks ?? {}).filter(Boolean).length;
    const checkBonus = Math.min(20, checksPassed * 3);
    const rr = (result.target - result.entry) / Math.max(result.entry - result.stop, 0.0001);
    const rrBonus = Math.max(0, Math.min(15, Math.round((rr - 1.2) * 10)));
    return Math.max(0, Math.min(100, Math.round(base * 0.65 + checkBonus + rrBonus)));
  }
}

