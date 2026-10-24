import { MarketDataProvider, TickerSearchResult } from './MarketDataProvider';
import { OHLC, Indicators, OptionsChain, OptionsContract } from '../types';
import { computeIndicators } from '../indicators/technical';
import { marketClock, sessionProgress, SESSION_OPEN_MIN } from '../lib/marketTime';

/*
 * Deterministic, time-aware mock market.
 *
 * Every trading day since EPOCH_DATE is simulated from a seed of (symbol, day index), so
 * history is stable across calls and request lengths, and a new bar appears each trading
 * day. Each day is built from 78 five-minute steps; during market hours today's bar only
 * includes the steps elapsed so far, so prices move intraday and setups can play out.
 *
 * Prices follow 15-day phases (uptrend, downtrend, range, tight squeeze). A squeeze followed
 * by an uptrend opens with a high-volume breakout day; a downtrend followed by anything else
 * opens with a rebound day. This makes all three strategies fire occasionally.
 */

interface SymbolProfile {
  basePrice: number;
  volatility: number;
  avgVolume: number;
}

const SYMBOL_PROFILES: Record<string, SymbolProfile> = {
  AAPL: { basePrice: 175, volatility: 0.015, avgVolume: 55_000_000 },
  NVDA: { basePrice: 480, volatility: 0.025, avgVolume: 40_000_000 },
  TSLA: { basePrice: 210, volatility: 0.030, avgVolume: 80_000_000 },
  MSFT: { basePrice: 390, volatility: 0.012, avgVolume: 25_000_000 },
  AMD:  { basePrice: 155, volatility: 0.028, avgVolume: 45_000_000 },
  META: { basePrice: 495, volatility: 0.020, avgVolume: 18_000_000 },
  AMZN: { basePrice: 185, volatility: 0.018, avgVolume: 35_000_000 },
  SPY:  { basePrice: 525, volatility: 0.008, avgVolume: 80_000_000 },
  QQQ:  { basePrice: 445, volatility: 0.010, avgVolume: 45_000_000 },
};

const MOCK_COMPANY_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
  NVDA: 'NVIDIA Corporation',
  TSLA: 'Tesla Inc.',
  MSFT: 'Microsoft Corporation',
  AMD:  'Advanced Micro Devices',
  META: 'Meta Platforms Inc.',
  AMZN: 'Amazon.com Inc.',
  SPY:  'SPDR S&P 500 ETF',
  QQQ:  'Invesco QQQ Trust',
  GOOGL: 'Alphabet Inc.',
  NFLX: 'Netflix Inc.',
  AVGO: 'Broadcom Inc.',
  SMCI: 'Super Micro Computer Inc.',
  PLTR: 'Palantir Technologies Inc.',
  JPM:  'JPMorgan Chase & Co.',
  XOM:  'Exxon Mobil Corporation',
  UNH:  'UnitedHealth Group Inc.',
  CAT:  'Caterpillar Inc.',
  CRM:  'Salesforce Inc.',
};

const EPOCH_DATE = '2024-01-02';
const PHASE_LEN = 15;
const STEPS_PER_DAY = 78;
const STEP_MS = 5 * 60 * 1000;

type Phase = 'UP' | 'DOWN' | 'RANGE' | 'SQUEEZE';

// Seeded LCG for deterministic output
function createRNG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 4294967295;
  };
}

function symbolSeed(symbol: string): number {
  return symbol.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 17) >>> 0;
}

function normalRandom(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-10);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function profileFor(symbol: string): SymbolProfile {
  const known = SYMBOL_PROFILES[symbol];
  if (known) return known;
  const seed = symbolSeed(symbol);
  return {
    basePrice: 20 + (seed % 480),
    volatility: 0.012 + (seed % 18) / 1000,
    avgVolume: 5_000_000 + (seed % 45) * 1_000_000,
  };
}

function phaseFor(symbol: string, phaseIdx: number): Phase {
  const r = createRNG(symbolSeed(`${symbol}:phase:${phaseIdx}`))();
  if (r < 0.35) return 'UP';
  if (r < 0.55) return 'DOWN';
  if (r < 0.80) return 'RANGE';
  return 'SQUEEZE';
}

/** Weekday ET dates from EPOCH_DATE through `today`, inclusive. */
function tradingDates(today: string): string[] {
  const dates: string[] = [];
  const d = new Date(`${EPOCH_DATE}T12:00:00Z`);
  const end = new Date(`${today}T12:00:00Z`).getTime();
  while (d.getTime() <= end) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

/** UTC timestamp of 09:30 ET on an ET date (handles EST/EDT). */
function sessionOpenTs(date: string): number {
  const est = Date.parse(`${date}T14:30:00Z`);
  return marketClock(est).minutes === SESSION_OPEN_MIN ? est : est - 60 * 60 * 1000;
}

interface DayPath {
  steps: OHLC[];
  fullVolume: number;
}

function simulateDay(symbol: string, profile: SymbolProfile, dayIdx: number, date: string, prevClose: number): DayPath {
  const rng = createRNG(symbolSeed(`${symbol}:${dayIdx}`));
  const phaseIdx = Math.floor(dayIdx / PHASE_LEN);
  const phase = phaseFor(symbol, phaseIdx);
  const prevPhase = phaseIdx > 0 ? phaseFor(symbol, phaseIdx - 1) : phase;
  const phaseStart = dayIdx % PHASE_LEN === 0;

  // Slow pull toward the base price keeps multi-year random walks in a realistic band.
  const anchor = -0.004 * Math.log(prevClose / profile.basePrice);
  let drift = anchor + (phase === 'UP' ? 0.0025 : phase === 'DOWN' ? -0.0025 : 0);
  let volMult = phase === 'SQUEEZE' ? 0.3 : phase === 'RANGE' ? 0.8 : 1;
  let volumeMult = phase === 'SQUEEZE' ? 0.6 : 1;

  if (phaseStart && prevPhase === 'SQUEEZE' && phase === 'UP') {
    drift = 0.025; volMult = 0.8; volumeMult = 2.5;     // breakout day
  } else if (phaseStart && prevPhase === 'DOWN' && phase !== 'DOWN') {
    drift = 0.015; volMult = 0.8; volumeMult = 1.8;     // rebound day
  }

  const sigma = profile.volatility * volMult;
  const stepSigma = sigma / Math.sqrt(STEPS_PER_DAY);
  const openTs = sessionOpenTs(date);

  let price = prevClose * (1 + 0.2 * sigma * normalRandom(rng));
  const dayOpen = price;
  const steps: OHLC[] = [];
  for (let s = 0; s < STEPS_PER_DAY; s++) {
    const open = price;
    price = open * (1 + drift / STEPS_PER_DAY + stepSigma * normalRandom(rng));
    const wick = stepSigma * 0.5;
    steps.push({
      timestamp: openTs + s * STEP_MS,
      open: round2(open),
      close: round2(price),
      high: round2(Math.max(open, price) * (1 + Math.abs(normalRandom(rng)) * wick)),
      low: round2(Math.min(open, price) * (1 - Math.abs(normalRandom(rng)) * wick)),
      volume: 0,
    });
  }

  const dayReturn = Math.abs(price / dayOpen - 1);
  const fullVolume = Math.round(
    profile.avgVolume * volumeMult * (0.7 + 0.6 * rng()) * (1 + dayReturn / Math.max(profile.volatility, 1e-4) * 0.3),
  );
  const perStep = Math.round(fullVolume / STEPS_PER_DAY);
  for (const st of steps) st.volume = perStep;

  return { steps, fullVolume };
}

function aggregate(date: string, steps: OHLC[]): OHLC {
  return {
    timestamp: Date.parse(`${date}T05:00:00Z`), // ~ET midnight, like real daily bars
    open: steps[0].open,
    high: Math.max(...steps.map(s => s.high)),
    low: Math.min(...steps.map(s => s.low)),
    close: steps[steps.length - 1].close,
    volume: steps.reduce((sum, s) => sum + s.volume, 0),
  };
}

interface CompletedHistory {
  /** ET date this history was built on; bars cover all trading days before it. */
  asOf: string;
  bars: OHLC[];
  dates: string[];
}

export class MockDataProvider implements MarketDataProvider {
  readonly name = 'mock';

  private completed = new Map<string, CompletedHistory>();

  /** All trading days before today (stable for the whole ET day). */
  private completedHistory(symbol: string, today: string, dates: string[]): CompletedHistory {
    const cached = this.completed.get(symbol);
    if (cached && cached.asOf === today) return cached;

    const profile = profileFor(symbol);
    const pastDates = dates[dates.length - 1] === today ? dates.slice(0, -1) : dates;
    const bars: OHLC[] = [];
    let prevClose = profile.basePrice;
    pastDates.forEach((date, i) => {
      const day = aggregate(date, simulateDay(symbol, profile, i, date, prevClose).steps);
      bars.push(day);
      prevClose = day.close;
    });

    const history = { asOf: today, bars, dates: pastDates };
    this.completed.set(symbol, history);
    return history;
  }

  /** Today's session so far (null before the open or on non-trading days). */
  private todaySteps(symbol: string, now = Date.now()): { date: string; steps: OHLC[] } | null {
    const today = marketClock(now).date;
    const dates = tradingDates(today);
    if (dates[dates.length - 1] !== today) return null;

    const progress = sessionProgress(now);
    const elapsed = Math.floor(progress * STEPS_PER_DAY);
    if (elapsed === 0) return null;

    const history = this.completedHistory(symbol, today, dates);
    const prevClose = history.bars.length ? history.bars[history.bars.length - 1].close : profileFor(symbol).basePrice;
    const { steps } = simulateDay(symbol, profileFor(symbol), dates.length - 1, today, prevClose);
    return { date: today, steps: steps.slice(0, elapsed) };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getHistoricalPrices(symbol: string, days = 120): Promise<OHLC[]> {
    const sym = symbol.toUpperCase();
    const today = marketClock().date;
    const history = this.completedHistory(sym, today, tradingDates(today));
    const live = this.todaySteps(sym);
    const bars = live ? [...history.bars, aggregate(live.date, live.steps)] : history.bars;
    return bars.slice(-days);
  }

  async getIntradayPrices(symbol: string): Promise<OHLC[]> {
    const sym = symbol.toUpperCase();
    const live = this.todaySteps(sym);
    if (live) return live.steps;

    // Market not open yet today: replay the most recent completed session.
    const today = marketClock().date;
    const history = this.completedHistory(sym, today, tradingDates(today));
    const n = history.dates.length;
    if (n === 0) return [];
    const prevClose = n > 1 ? history.bars[n - 2].close : profileFor(sym).basePrice;
    return simulateDay(sym, profileFor(sym), n - 1, history.dates[n - 1], prevClose).steps;
  }

  async getIndicators(symbol: string): Promise<Indicators> {
    return computeIndicators(await this.getHistoricalPrices(symbol));
  }

  async searchTickers(query: string): Promise<TickerSearchResult[]> {
    const q = query.trim().toLowerCase();
    const entries = Object.entries(MOCK_COMPANY_NAMES).map(([symbol, name]) => ({ symbol, name }));
    if (!q) return entries.slice(0, 8);
    const hits = entries.filter(
      e => e.symbol.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
    );
    // Mock data can simulate any ticker, so offer the typed symbol itself.
    const typed = query.trim().toUpperCase();
    if (/^[A-Z.]{1,6}$/.test(typed) && !hits.some(h => h.symbol === typed)) {
      hits.push({ symbol: typed, name: `${typed} (simulated)` });
    }
    return hits.slice(0, 15);
  }

  async getOptionsChain(symbol: string): Promise<OptionsChain> {
    const data = await this.getHistoricalPrices(symbol, 30);
    const last = data[data.length - 1];
    const underlying = last.close;
    const rng = createRNG(symbolSeed(symbol + 'opts'));

    const ivBase = 0.25 + rng() * 0.30;
    const strikes = Array.from({ length: 9 }, (_, i) => round2(underlying * (0.88 + i * 0.03)));

    const expirations = [
      getNextFriday(7),
      getNextFriday(14),
      getNextFriday(21),
    ];

    const calls: OptionsContract[] = [];
    const puts: OptionsContract[] = [];

    for (const expiry of expirations) {
      const dte = Math.max(1, (new Date(expiry).getTime() - Date.now()) / 86400000);
      for (const strike of strikes) {
        const moneyness = underlying / strike;
        const iv = ivBase * (1 + 0.1 * Math.abs(1 - moneyness));
        const callDelta = moneyness > 1 ? 0.55 + (moneyness - 1) * 2 : 0.5 - (1 - moneyness) * 2;
        const callPremium = round2(Math.max(underlying - strike, 0) + underlying * iv * Math.sqrt(dte / 365) * 0.4);
        const putDelta = callDelta - 1;
        const putPremium = round2(Math.max(strike - underlying, 0) + underlying * iv * Math.sqrt(dte / 365) * 0.4);

        calls.push({ strike, expiration: expiry, type: 'CALL', premium: callPremium, delta: Math.min(0.99, Math.max(0.01, callDelta)), impliedVolatility: round2(iv), openInterest: Math.round(rng() * 5000), volume: Math.round(rng() * 500) });
        puts.push({ strike, expiration: expiry, type: 'PUT', premium: putPremium, delta: Math.max(-0.99, Math.min(-0.01, putDelta)), impliedVolatility: round2(iv), openInterest: Math.round(rng() * 3000), volume: Math.round(rng() * 300) });
      }
    }

    return { symbol, underlying, calls, puts };
  }
}

function getNextFriday(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}
