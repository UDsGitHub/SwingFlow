export type StrategyType = 'TREND_PULLBACK' | 'BREAKOUT' | 'REVERSAL';
export type Direction = 'LONG' | 'SHORT';
export type SetupStatus = 'ACTIVE' | 'TRIGGERED' | 'COMPLETED' | 'EXPIRED';

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
  dataProvider: string;
}

export interface AppNotification {
  setup_id: string;
  type: string;
  message: string;
  sent_at: number;
  delivered: boolean;
}
