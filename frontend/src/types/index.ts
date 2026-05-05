export interface TickerSearchResult {
  symbol: string;
  name: string;
}

export type StrategyType = 'TREND_PULLBACK' | 'BREAKOUT' | 'REVERSAL';
export type Direction = 'LONG' | 'SHORT';
export type SetupStatus = 'ACTIVE' | 'TRIGGERED' | 'COMPLETED' | 'EXPIRED' | 'STOPPED' | 'TARGET_HIT';
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
  exitPrice: number | null;
  realizedPnl: number | null;
  closedAt: number | null;
  entryHitAt: number | null;
  stopHitAt: number | null;
  targetHitAt: number | null;
  pnlEstimate: number | null;
  score: number;
  rank: number | null;
  entryInstruction: string;
  invalidationInstruction: string;
  targetInstruction: string;
}

export interface DevelopingSetup {
  symbol: string;
  strategy: StrategyType;
  direction: Direction;
  confidence: number;
  explanation: string;
  estimatedEntryZone: [number, number] | null;
  detectedAt: number;
  sessionsSeen?: number;
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

export interface SetupAnalytics {
  weekWindowMs: number;
  setupsGenerated: number;
  setupsTriggered: number;
  winRate: number | null;
  avgRiskReward: number;
  notificationDeliveryRate: number | null;
}
