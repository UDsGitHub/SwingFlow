export interface TickerSearchResult {
  symbol: string;
  name: string;
}

export type StrategyType = 'TREND_PULLBACK' | 'BREAKOUT' | 'REVERSAL';
export type Direction = 'LONG' | 'SHORT';
/** Paper lifecycle: waiting for entry → paper trade open → closed; or never entered (expired / skipped). */
export type SetupStatus = 'ACTIVE' | 'TRIGGERED' | 'CLOSED' | 'EXPIRED' | 'SKIPPED';
export type PaperExitReason = 'TARGET' | 'STOP' | 'TRAIL_STOP' | 'TIME' | 'SMA' | 'GAP_SKIP' | 'NO_FILL';

export interface ExitPlan {
  maxHoldDays: number;
  /** null = no fixed target (exit by trailing stop or time). */
  targetR?: number | null;
  trailAtrMult?: number;
  breakevenAtR?: number;
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
  status: SetupStatus;
  notes: string;
  stockSuggestion: StockSuggestion;
  optionsSuggestion: OptionsSuggestion | null;
  signalDate?: string | null;
  exitPlan: ExitPlan | null;
  atrAtSignal: number | null;
  /** Current paper stop (rises with the trailing stop). */
  currentStop: number;
  entryHitAt: number | null;
  paperFillPrice: number | null;
  paperFillDate: string | null;
  paperExitPrice: number | null;
  paperExitDate: string | null;
  paperExitReason: PaperExitReason | null;
  paperR: number | null;
  sessionsHeld: number;
  managedThrough: string | null;
  dismissedAt: number | null;
  score: number;
  rank: number | null;
  entryInstruction: string;
  invalidationInstruction: string;
  targetInstruction: string;
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

export interface ScanResponse {
  message: string;
  symbols: string[];
  activeSetups?: number;
  developingSetups?: DevelopingSetup[];
  scanId: string;
  regime: {
    symbol: string;
    regime: MarketRegime;
    confidence: number;
    ema50: number;
    ema200: number;
    atrPercent: number;
    lastPrice: number;
  };
  newSetups: number;
  noSetupReasons: string[];
  evaluations: Array<{
    symbol: string;
    strategy: StrategyType;
    result: string;
    explanation: string;
    score: number;
  }>;
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

export interface AccountConfig {
  accountSize: string;
  dailyGoal: string;
  riskPercent: string;
}

export interface AppNotification {
  id?: number;
  setup_id: string;
  type: string;
  message: string;
  sent_at: number;
  delivered: boolean;
}

export interface ScanEvaluation {
  id?: number;
  scan_id: string;
  symbol: string;
  strategy: StrategyType;
  checks: Record<string, boolean>;
  result: 'SETUP' | 'NO_SETUP' | 'BLOCKED_BY_REGIME' | 'SKIPPED_DUPLICATE' | 'ERROR';
  explanation: string;
  score: number;
  regime: MarketRegime;
  regime_confidence: number;
  created_at: number;
}

/** A position the user actually took. */
export interface Trade {
  id: string;
  setupId: string | null;
  symbol: string;
  direction: Direction;
  entryPrice: number;
  shares: number;
  stopPrice: number | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: number;
  exitPrice: number | null;
  closedAt: number | null;
  realizedPnl: number | null;
  notes: string | null;
  /** The setup's current paper stop — where the trailing stop says the stop should be now. */
  suggestedStop: number | null;
  strategy: StrategyType | null;
}

export interface PaperRecord {
  closed: number;
  wins: number;
  winRate: number | null;
  expectancyR: number | null;
  avgHoldDays: number | null;
  open: number;
  waiting: number;
  expired: number;
  skipped: number;
}

export interface RealRecord {
  closed: number;
  open: number;
  wins: number;
  winRate: number | null;
  totalPnl: number;
}

export interface SetupAnalytics {
  weekWindowMs: number;
  setupsGeneratedThisWeek: number;
  paper: PaperRecord;
  real: RealRecord;
  notificationDeliveryRate: number | null;
}
