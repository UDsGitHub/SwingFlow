import { ScanEvaluation, StrategyResult } from '../types';
import { supabaseAdmin } from '../db/supabase';

export class StrategyExplainerService {
  async persistEvaluations(evaluations: ScanEvaluation[]): Promise<void> {
    if (!evaluations.length) return;
    const rows = evaluations.map((e) => ({
      scan_id: e.scanId,
      user_id: e.userId,
      symbol: e.symbol,
      strategy: e.strategy,
      checks: e.checks,
      result: e.result,
      explanation: e.explanation,
      score: e.score,
      regime: e.regime,
      regime_confidence: e.regimeConfidence,
      created_at: e.createdAt,
    }));
    await supabaseAdmin.from('scan_evaluations').insert(rows);
  }

  buildNoSetupSummary(evaluations: ScanEvaluation[]): string[] {
    const top = new Map<string, number>();
    for (const e of evaluations) {
      if (e.result === 'SETUP') continue;
      top.set(e.explanation, (top.get(e.explanation) ?? 0) + 1);
    }
    return Array.from(top.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([reason, count]) => `${reason} (${count})`);
  }

  toChecks(result: StrategyResult): Record<string, boolean> {
    return result.checks ?? {};
  }
}

