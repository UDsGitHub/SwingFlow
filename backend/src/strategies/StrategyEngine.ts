import { v4 as uuidv4 } from 'uuid';
import { providerFromName } from '../providers/resolveUserProvider';
import { TradeSetup, OptionsChain, DevelopingSetup, ScanEvaluation, RegimeSnapshot, StrategyResult, OHLC } from '../types';
import { PositionSizingService } from '../services/PositionSizingService';
import { supabaseAdmin } from '../db/supabase';
import { classifyRegime, REGIME_BARS } from '../services/MarketRegimeService';
import { allowsRegime } from './regimeGate';
import { EXIT_PLANS, createStrategies } from './strategyConfig';
import { describeExit } from '../db/tradeSetupMapper';
import { StrategyExplainerService } from '../services/StrategyExplainerService';
import { SetupScoringService } from '../services/SetupScoringService';
import { computeIndicators } from '../indicators/technical';
import { completedBars, marketClock } from '../lib/marketTime';
import { LIQUID_UNIVERSE } from '../config/universe';
import { byExpectedValue, expectedValue } from '../config/edgeBaseline';
import {
  persistDevelopingAfterScan,
  fetchActiveDevelopingForUser,
  markDevelopingConverted,
} from '../services/DevelopingPersistenceService';

const strategies = createStrategies();
const explainerService = new StrategyExplainerService();
const scoringService = new SetupScoringService();
const sizing = new PositionSizingService();

/** Bars handed to strategies — must match the backtest window. */
const STRATEGY_BARS = 120;
const UNIQUE_VIOLATION = '23505';

export interface StrategyEngineRunResult {
  setups: TradeSetup[];
  evaluations: ScanEvaluation[];
  regime: RegimeSnapshot;
  scanId: string;
  noSetupReasons: string[];
}

interface SymbolEvaluation {
  symbol: string;
  /** ET date of the last completed bar the strategies judged. */
  signalDate: string | null;
  results: StrategyResult[];
  /** ATR14 of the signal window — the trailing-stop distance unit. */
  atr: number | null;
  optionsChain: OptionsChain | null;
  error?: string;
}

/** One evaluation of the market, shared by every user's scan. */
export interface MarketSnapshot {
  regime: RegimeSnapshot;
  /** ET date of the regime symbol's last completed bar (the session being judged). */
  asOfDate: string;
  /** ET dates of recent completed sessions, ascending (a trading calendar for expiry). */
  sessionDates: string[];
  bySymbol: Map<string, SymbolEvaluation>;
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

/** Symbols a user's scan covers: the liquid universe plus their watchlist favorites. */
export async function scanSymbolsForUser(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('watchlist')
    .select('symbol')
    .eq('user_id', userId)
    .eq('is_active', true);
  return [...new Set([...LIQUID_UNIVERSE, ...(data ?? []).map((r: { symbol: string }) => r.symbol)])];
}

/**
 * Evaluate every symbol once on completed daily candles. Today's bar is ignored until the
 * session is final, so a mid-day scan judges yesterday's close, exactly like the backtest.
 */
export async function evaluateMarket(symbols: string[]): Promise<MarketSnapshot> {
  const provider = providerFromName(process.env.DATA_PROVIDER ?? 'alpaca');
  const regimeSymbol = process.env.REGIME_SYMBOL ?? 'SPY';
  const regimeBars = completedBars(await provider.getHistoricalPrices(regimeSymbol, REGIME_BARS + 1)).slice(-REGIME_BARS);
  const regime = classifyRegime(regimeSymbol, regimeBars);
  const sessionDates = regimeBars.map(b => marketClock(b.timestamp).date);
  const asOfDate = sessionDates[sessionDates.length - 1];

  const bySymbol = new Map<string, SymbolEvaluation>();
  for (const symbol of new Set(symbols)) {
    try {
      const ohlc: OHLC[] = completedBars(await provider.getHistoricalPrices(symbol, STRATEGY_BARS + 1)).slice(-STRATEGY_BARS);
      const indicators = computeIndicators(ohlc);
      let optionsChain: OptionsChain | null = null;
      try { optionsChain = await provider.getOptionsChain(symbol); } catch { /* optional */ }
      bySymbol.set(symbol, {
        symbol,
        signalDate: ohlc.length ? marketClock(ohlc[ohlc.length - 1].timestamp).date : null,
        results: strategies.map(s => s.evaluate(symbol, ohlc, indicators)),
        atr: Number.isFinite(indicators.atr14[indicators.atr14.length - 1]) ? indicators.atr14[indicators.atr14.length - 1] : null,
        optionsChain,
      });
    } catch (err) {
      console.error(`[StrategyEngine] Error evaluating ${symbol}:`, err);
      bySymbol.set(symbol, { symbol, signalDate: null, results: [], atr: null, optionsChain: null, error: (err as Error).message });
    }
  }
  return { regime, asOfDate, sessionDates, bySymbol };
}

/** Turn a market snapshot into setups, diagnostics and developing candidates for one user. */
export async function runScanForUser(
  userId: string,
  snapshot: MarketSnapshot,
  symbols: string[],
): Promise<StrategyEngineRunResult & { developing: DevelopingSetup[] }> {
  const scanId = uuidv4();
  const { regime } = snapshot;
  const setups: TradeSetup[] = [];
  const evaluations: ScanEvaluation[] = [];
  const developing: DevelopingSetup[] = [];

  const { data: cfg } = await supabaseAdmin
    .from('settings')
    .select('account_size, risk_percent')
    .eq('user_id', userId)
    .single();
  const accountSize = Number(cfg?.account_size ?? 5000);
  const riskPercent = Number(cfg?.risk_percent ?? 1.5);

  for (const symbol of symbols) {
    const evaluation = snapshot.bySymbol.get(symbol);
    if (!evaluation) continue;

    if (evaluation.error) {
      evaluations.push({
        scanId,
        userId,
        symbol,
        strategy: (strategies[0]?.name ?? 'REVERSAL') as ScanEvaluation['strategy'],
        checks: {},
        result: 'ERROR',
        explanation: 'Failed to process symbol due to provider or indicator error.',
        score: 0,
        regime: regime.regime,
        regimeConfidence: regime.confidence,
        createdAt: Date.now(),
      });
      continue;
    }

    for (const result of evaluation.results) {
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

      if (!allowsRegime(result.strategy, regime.regime)) {
        evaluations.push({
          ...baseEvaluation,
          result: 'BLOCKED_BY_REGIME',
          explanation: `${result.strategy} blocked in ${regime.regime} market regime.`,
        });
        continue;
      }

      if (!result.triggered) {
        evaluations.push(baseEvaluation);
        if (result.developing) {
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
        continue;
      }

      const stockSuggestion = sizing.calculate({
        entry: result.entry, stop: result.stop, target: result.target,
        accountSize, riskPercent,
      });

      const optionsSuggestion = evaluation.optionsChain
        ? sizing.calculateOptions(evaluation.optionsChain, result.direction, result.entry, accountSize, riskPercent)
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
        signalDate: evaluation.signalDate,
        status: 'ACTIVE',
        notes: result.notes,
        stockSuggestion,
        optionsSuggestion,
        exitPlan: EXIT_PLANS[result.strategy],
        atrAtSignal: evaluation.atr,
        currentStop: result.stop,
        entryHitAt: null,
        paperFillPrice: null,
        paperFillDate: null,
        paperExitPrice: null,
        paperExitDate: null,
        paperExitReason: null,
        paperR: null,
        sessionsHeld: 0,
        managedThrough: null,
        dismissedAt: null,
        score,
        expectedValue: expectedValue(result.strategy, stockSuggestion.riskDollars),
        rank: null,
        ...buildExecutionInstructions({
          direction: result.direction,
          entry: result.entry,
          stop: result.stop,
          target: result.target,
        }),
        targetInstruction: describeExit(result.target, EXIT_PLANS[result.strategy]),
      };

      // A partial unique index allows one open (ACTIVE or TRIGGERED) setup per user+symbol+strategy,
      // like the backtest's one-trade-at-a-time rule; a violation means one is already open.
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
        signal_date:       setup.signalDate,
        status:            setup.status,
        notes:             setup.notes,
        stock_suggestion:  setup.stockSuggestion,
        options_suggestion: setup.optionsSuggestion,
        exit_plan:         setup.exitPlan,
        atr_at_signal:     setup.atrAtSignal,
        current_stop:      setup.currentStop,
        score:             setup.score,
      });

      if (error?.code === UNIQUE_VIOLATION) {
        evaluations.push({
          ...baseEvaluation,
          result: 'SKIPPED_DUPLICATE',
          explanation: 'An open setup already exists for this symbol and strategy.',
        });
        continue;
      }
      if (error) {
        console.error(`[StrategyEngine] Insert failed for ${symbol} ${result.strategy}:`, error.message);
        continue;
      }

      setups.push(setup);
      evaluations.push({ ...baseEvaluation, result: 'SETUP', explanation: result.explanation });
      await markDevelopingConverted(userId, symbol, result.strategy);
      console.log(`[StrategyEngine] ${userId.slice(0, 8)}… — New setup: ${symbol} ${result.strategy} @ ${result.entry}`);
    }
  }

  setups.sort(byExpectedValue);
  setups.forEach((s, idx) => { s.rank = idx + 1; });
  await explainerService.persistEvaluations(evaluations);

  const developingTop = developing
    .sort((a, b) => b.confidence - a.confidence || b.detectedAt - a.detectedAt)
    .slice(0, 20);
  await persistDevelopingAfterScan(userId, scanId, developingTop);

  return {
    setups,
    evaluations,
    regime,
    scanId,
    noSetupReasons: explainerService.buildNoSetupSummary(evaluations),
    developing: await fetchActiveDevelopingForUser(userId, 20),
  };
}

/** Evaluate and scan for a single user (manual "Scan Now"). */
export async function runStrategyEngineWithDeveloping(
  symbols: string[],
  userId: string,
): Promise<StrategyEngineRunResult & { developing: DevelopingSetup[] }> {
  const snapshot = await evaluateMarket(symbols);
  return runScanForUser(userId, snapshot, symbols);
}
