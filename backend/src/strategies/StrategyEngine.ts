import { v4 as uuidv4 } from 'uuid';
import { getProviderForUser } from '../providers/resolveUserProvider';
import { TrendPullbackStrategy } from './TrendPullbackStrategy';
import { BreakoutStrategy } from './BreakoutStrategy';
import { ReversalStrategy } from './ReversalStrategy';
import { TradeSetup, OptionsChain, DevelopingSetup, ScanEvaluation, RegimeSnapshot, StrategyType } from '../types';
import { PositionSizingService } from '../services/PositionSizingService';
import { supabaseAdmin } from '../db/supabase';
import { MarketRegimeService } from '../services/MarketRegimeService';
import { allowsRegime } from './regimeGate';
import { StrategyExplainerService } from '../services/StrategyExplainerService';
import { SetupScoringService } from '../services/SetupScoringService';
import {
  persistDevelopingAfterScan,
  fetchActiveDevelopingForUser,
  markDevelopingConverted,
} from '../services/DevelopingPersistenceService';

const strategies = [
  new TrendPullbackStrategy(),
  new BreakoutStrategy(),
  new ReversalStrategy(),
];

const regimeService = new MarketRegimeService();
const explainerService = new StrategyExplainerService();
const scoringService = new SetupScoringService();

export interface StrategyEngineRunResult {
  setups: TradeSetup[];
  evaluations: ScanEvaluation[];
  regime: RegimeSnapshot;
  scanId: string;
  noSetupReasons: string[];
}

function buildExecutionInstructions(setup: Pick<TradeSetup, 'direction' | 'entry' | 'stop' | 'target'>): Pick<TradeSetup, 'entryInstruction' | 'invalidationInstruction' | 'targetInstruction'> {
  if (setup.direction === 'LONG') {
    return {
      entryInstruction: `WAIT for break above ${setup.entry.toFixed(2)}`,
      invalidationInstruction: `INVALID if price drops below ${setup.stop.toFixed(2)}`,
      targetInstruction: `TAKE profit near ${setup.target.toFixed(2)} or trail into strength`,
    };
  }

  return {
    entryInstruction: `WAIT for break below ${setup.entry.toFixed(2)}`,
    invalidationInstruction: `INVALID if price rises above ${setup.stop.toFixed(2)}`,
    targetInstruction: `TAKE profit near ${setup.target.toFixed(2)} or trail into weakness`,
  };
}

export async function runStrategyEngine(
  watchlist: string[],
  userId: string,
): Promise<StrategyEngineRunResult> {
  const scanId = uuidv4();
  const sizing = new PositionSizingService();
  const setups: TradeSetup[] = [];
  const evaluations: ScanEvaluation[] = [];

  const { data: cfg } = await supabaseAdmin
    .from('settings')
    .select('account_size, risk_percent')
    .eq('user_id', userId)
    .single();

  const provider = await getProviderForUser(userId);
  const regime = await regimeService.detectForUser(userId);
  const accountSize = Number(cfg?.account_size ?? 5000);
  const riskPercent = Number(cfg?.risk_percent ?? 1.5);

  for (const symbol of watchlist) {
    try {
      const [ohlc, indicators] = await Promise.all([
        provider.getHistoricalPrices(symbol, 120),
        provider.getIndicators(symbol),
      ]);

      let optionsChain: OptionsChain | null = null;
      try { optionsChain = await provider.getOptionsChain(symbol); } catch { /* optional */ }

      for (const strategy of strategies) {
        const result = strategy.evaluate(symbol, ohlc, indicators);
        const allowedByRegime = allowsRegime(result.strategy, regime.regime);
        const score = scoringService.score(result);
        const baseEvaluation: ScanEvaluation = {
          scanId,
          userId,
          symbol,
          strategy: result.strategy,
          checks: explainerService.toChecks(result),
          result: 'NO_SETUP',
          explanation: result.explanation,
          score,
          regime: regime.regime,
          regimeConfidence: regime.confidence,
          createdAt: Date.now(),
        };

        if (!allowedByRegime) {
          evaluations.push({
            ...baseEvaluation,
            result: 'BLOCKED_BY_REGIME',
            explanation: `${result.strategy} blocked in ${regime.regime} market regime.`,
          });
          continue;
        }

        if (!result.triggered) {
          evaluations.push(baseEvaluation);
          continue;
        }

        // Skip if an active setup already exists for this user+symbol+strategy
        const { data: existing } = await supabaseAdmin
          .from('trade_setups')
          .select('id')
          .eq('user_id', userId)
          .eq('symbol', symbol)
          .eq('strategy', result.strategy)
          .eq('status', 'ACTIVE')
          .maybeSingle();

        if (existing) {
          evaluations.push({
            ...baseEvaluation,
            result: 'SKIPPED_DUPLICATE',
            explanation: 'Active setup already exists for this symbol and strategy.',
          });
          continue;
        }

        const stockSuggestion = sizing.calculate({
          entry: result.entry, stop: result.stop, target: result.target,
          accountSize, riskPercent,
        });

        const optionsSuggestion = optionsChain
          ? sizing.calculateOptions(optionsChain, result.direction, result.entry, accountSize, riskPercent)
          : null;

        const riskReward = (result.target - result.entry) / (result.entry - result.stop);

        const setup: TradeSetup = {
          id: uuidv4(),
          symbol,
          strategy: result.strategy,
          direction: result.direction,
          entry: result.entry,
          stop: result.stop,
          target: result.target,
          confidence: result.confidence,
          riskReward: Math.round(riskReward * 10) / 10,
          detectedAt: Date.now(),
          status: 'ACTIVE',
          notes: result.notes,
          stockSuggestion,
          optionsSuggestion,
          exitPrice:    null,
          realizedPnl:  null,
          closedAt:     null,
          entryHitAt:   null,
          stopHitAt:    null,
          targetHitAt:  null,
          pnlEstimate:  null,
          score,
          rank: null,
          ...buildExecutionInstructions({
            direction: result.direction,
            entry: result.entry,
            stop: result.stop,
            target: result.target,
          }),
        };

        const { error } = await supabaseAdmin.from('trade_setups').insert({
          id:                setup.id,
          user_id:           userId,
          symbol:            setup.symbol,
          strategy:          setup.strategy,
          direction:         setup.direction,
          entry:             setup.entry,
          stop:              setup.stop,
          target:            setup.target,
          confidence:        setup.confidence,
          risk_reward:       setup.riskReward,
          detected_at:       setup.detectedAt,
          status:            setup.status,
          notes:             setup.notes,
          stock_suggestion:  setup.stockSuggestion,
          options_suggestion: setup.optionsSuggestion,
          entry_hit_at:      setup.entryHitAt,
          stop_hit_at:       setup.stopHitAt,
          target_hit_at:     setup.targetHitAt,
          pnl_estimate:      setup.pnlEstimate,
          score:             setup.score,
        });

        if (!error) {
          setups.push(setup);
          evaluations.push({
            ...baseEvaluation,
            result: 'SETUP',
            explanation: result.explanation,
          });
          await markDevelopingConverted(userId, symbol, result.strategy);
          console.log(`[StrategyEngine] ${userId.slice(0, 8)}… — New setup: ${symbol} ${result.strategy} @ ${result.entry}`);
        }
      }
    } catch (err) {
      console.error(`[StrategyEngine] Error processing ${symbol}:`, err);
      evaluations.push({
        scanId,
        userId,
        symbol,
        strategy: 'TREND_PULLBACK',
        checks: {},
        result: 'ERROR',
        explanation: 'Failed to process symbol due to provider or indicator error.',
        score: 0,
        regime: regime.regime,
        regimeConfidence: regime.confidence,
        createdAt: Date.now(),
      });
    }
  }

  setups.sort((a, b) => b.score - a.score);
  setups.forEach((s, idx) => { s.rank = idx + 1; });
  await explainerService.persistEvaluations(evaluations);

  return {
    setups,
    evaluations,
    regime,
    scanId,
    noSetupReasons: explainerService.buildNoSetupSummary(evaluations),
  };
}

export async function runStrategyEngineWithDeveloping(
  watchlist: string[],
  userId: string,
): Promise<StrategyEngineRunResult & { developing: DevelopingSetup[] }> {
  const run = await runStrategyEngine(watchlist, userId);
  const setups = run.setups;
  const developing: DevelopingSetup[] = [];
  const provider = await getProviderForUser(userId);

  for (const symbol of watchlist) {
    try {
      const [ohlc, indicators] = await Promise.all([
        provider.getHistoricalPrices(symbol, 120),
        provider.getIndicators(symbol),
      ]);
      for (const strategy of strategies) {
        const result = strategy.evaluate(symbol, ohlc, indicators);
        if (result.triggered || !result.developing) continue;
        developing.push({
          symbol,
          strategy: result.strategy,
          direction: result.direction,
          confidence: result.confidence,
          explanation: result.explanation ?? 'Developing setup conditions detected.',
          estimatedEntryZone: result.estimatedEntryZone ?? null,
          detectedAt: Date.now(),
        });
      }
    } catch {
      // ignore symbol-level failures for developing candidates
    }
  }

  const developingTop = developing
    .sort((a, b) => b.confidence - a.confidence || b.detectedAt - a.detectedAt)
    .slice(0, 20);

  await persistDevelopingAfterScan(userId, run.scanId, developingTop);
  const developingFromDb = await fetchActiveDevelopingForUser(userId, 20);

  return {
    setups,
    evaluations: run.evaluations,
    regime: run.regime,
    scanId: run.scanId,
    noSetupReasons: run.noSetupReasons,
    developing: developingFromDb,
  };
}
