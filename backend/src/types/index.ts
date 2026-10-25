export interface OHLC {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  ema20: number[];
  ema50: number[];
  rsi14: number[];
  atr14: number[];
  volumeSma20: number;
}

export interface OptionsContract {
  strike: number;
  expiration: string;
  type: 'CALL' | 'PUT';
  premium: number;
  delta: number;
  impliedVolatility: number;
  openInterest: number;
  volume: number;
}

export interface OptionsChain {
  symbol: string;
  underlying: number;
  calls: OptionsContract[];
  puts: OptionsContract[];
}

export type StrategyType = 'TREND_PULLBACK' | 'BREAKOUT' | 'REVERSAL';
export type Direction = 'LONG' | 'SHORT';
/**
 * Paper lifecycle of a setup: waiting for entry → paper trade open → closed; or it never
 * entered (EXPIRED: no fill within the entry window, SKIPPED: price gapped past the entry).
 */
export type SetupStatus = 'ACTIVE' | 'TRIGGERED' | 'CLOSED' | 'EXPIRED' | 'SKIPPED';
export type PaperExitReason = 'TARGET' | 'STOP' | 'TRAIL_STOP' | 'TIME' | 'SMA' | 'GAP_SKIP' | 'NO_FILL';
export type TradeStatus = 'OPEN' | 'CLOSED';

/** How a filled trade is managed. Shared by the backtest and the live paper tracker. */
export interface ExitPlan {
  /** Trading days held before a time exit at the close. */
  maxHoldDays: number;
  /** Override the strategy's target as entry + targetR × risk; null = no fixed target. */
  targetR?: number | null;
  /** Chandelier trail: after each close, stop = max(stop, highest high since fill − mult × ATR at signal). */
  trailAtrMult?: number;
  /** Once the high reaches fill + breakevenAtR × risk, raise the stop to the fill price. */
  breakevenAtR?: number;
  /** Exit at the close once it is above the N-day simple moving average of closes. */
  exitAboveSma?: number;
}
export type MarketRegime = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING';

export interface StockSuggestion {
  shares: number;
  capitalRequired: number;
  riskDollars: number;
  potentialGainDollars: number;
}

export interface OptionsSuggestion {
  type: 'CALL' | 'PUT';
  strike: number;
  expiration: string;
  estimatedPremium: number;
  contracts: number;
  totalCost: number;
  maxGain: number;
  delta: number;
}

export interface TradeSetup {
  id: string;
  symbol: string;
  strategy: StrategyType;
  direction: Direction;
  entry: number;
  stop: number;
  target: number;
  confidence: number;
  riskReward: number;
  detectedAt: number;
  /** ET date (YYYY-MM-DD) of the completed daily bar that produced the setup. */
  signalDate?: string | null;
  status: SetupStatus;
  notes: string;
  stockSuggestion: StockSuggestion;
  optionsSuggestion: OptionsSuggestion | null;
  /** Exit rules captured when the setup was created. */
  exitPlan: ExitPlan | null;
  atrAtSignal: number | null;
  /** Current paper stop (rises with the trail; never falls). */
  currentStop: number;
  /** When the paper trade filled (ms). */
  entryHitAt: number | null;
  paperFillPrice: number | null;
  paperFillDate: string | null;
  paperExitPrice: number | null;
  paperExitDate: string | null;
  paperExitReason: PaperExitReason | null;
  /** Paper result in R (multiples of the risk at the fill). */
  paperR: number | null;
  sessionsHeld: number;
  /** Last completed session applied by the tracker (ET date). */
  managedThrough: string | null;
  /** Hidden by the user; the paper record keeps tracking. */
  dismissedAt: number | null;
  score: number;
  rank: number | null;
  entryInstruction: string;
  invalidationInstruction: string;
  targetInstruction: string;
}

/** A position the user actually took, optionally linked to the setup it came from. */
export interface Trade {
  id: string;
  setupId: string | null;
  symbol: string;
  direction: Direction;
  entryPrice: number;
  shares: number;
  /** The stop the user has at their broker. */
  stopPrice: number | null;
  status: TradeStatus;
  openedAt: number;
  exitPrice: number | null;
  closedAt: number | null;
  realizedPnl: number | null;
  notes: string | null;
  /** The setup's current paper stop — the suggested stop for an open position. */
  suggestedStop: number | null;
  strategy: StrategyType | null;
}

export interface WatchlistItem {
  symbol: string;
  addedAt: number;
  isActive: boolean;
}

export interface AccountConfig {
  accountSize: number;
  dailyGoal: number;
  riskPercent: number;
}

export interface MarketSummary {
  symbol: string;
  lastPrice: number;
  change: number;
  changePercent: number;
  trend: 'UP' | 'DOWN' | 'NEUTRAL';
  rsi: number;
  aboveEma20: boolean;
  aboveEma50: boolean;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
}

export interface NotificationLog {
  id?: number;
  setupId: string;
  type: string;
  message: string;
  sentAt: number;
  delivered: boolean;
}

export interface StrategyResult {
  triggered: boolean;
  developing?: boolean;
  strategy: StrategyType;
  direction: Direction;
  entry: number;
  stop: number;
  target: number;
  confidence: number;
  notes: string;
  checks: Record<string, boolean>;
  explanation: string;
  score?: number;
  estimatedEntryZone?: [number, number] | null;
}

export interface DevelopingSetup {
  id?: string;
  symbol: string;
  strategy: StrategyType;
  direction: Direction;
  confidence: number;
  explanation: string;
  estimatedEntryZone: [number, number] | null;
  detectedAt: number;
  sessionsSeen?: number;
  status?: 'ACTIVE' | 'EXPIRED' | 'CONVERTED';
}

export interface RegimeSnapshot {
  symbol: string;
  regime: MarketRegime;
  confidence: number;
  ema50: number;
  ema200: number;
  atrPercent: number;
  lastPrice: number;
}

export interface ScanEvaluation {
  scanId: string;
  userId: string;
  symbol: string;
  strategy: StrategyType;
  checks: Record<string, boolean>;
  result: 'SETUP' | 'NO_SETUP' | 'BLOCKED_BY_REGIME' | 'SKIPPED_DUPLICATE' | 'ERROR';
  explanation: string;
  score: number;
  regime: MarketRegime;
  regimeConfidence: number;
  createdAt: number;
}
