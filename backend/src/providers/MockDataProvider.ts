import { MarketDataProvider, TickerSearchResult } from './MarketDataProvider';
import { OHLC, Indicators, OptionsChain, OptionsContract } from '../types';
import { calculateEMA, calculateRSI, calculateATR, calculateVolumeSMA } from '../indicators/technical';

interface SymbolProfile {
  basePrice: number;
  volatility: number;
  scenario: 'TREND_PULLBACK' | 'BREAKOUT' | 'REVERSAL' | 'TRENDING' | 'MIXED';
  avgVolume: number;
}

const SYMBOL_PROFILES: Record<string, SymbolProfile> = {
  AAPL: { basePrice: 175, volatility: 0.015, scenario: 'TREND_PULLBACK', avgVolume: 55_000_000 },
  NVDA: { basePrice: 480, volatility: 0.025, scenario: 'BREAKOUT',       avgVolume: 40_000_000 },
  TSLA: { basePrice: 210, volatility: 0.030, scenario: 'REVERSAL',        avgVolume: 80_000_000 },
  MSFT: { basePrice: 390, volatility: 0.012, scenario: 'TREND_PULLBACK',  avgVolume: 25_000_000 },
  AMD:  { basePrice: 155, volatility: 0.028, scenario: 'BREAKOUT',        avgVolume: 45_000_000 },
  META: { basePrice: 495, volatility: 0.020, scenario: 'TRENDING',        avgVolume: 18_000_000 },
  AMZN: { basePrice: 185, volatility: 0.018, scenario: 'MIXED',           avgVolume: 35_000_000 },
  SPY:  { basePrice: 525, volatility: 0.008, scenario: 'TREND_PULLBACK',  avgVolume: 80_000_000 },
  QQQ:  { basePrice: 445, volatility: 0.010, scenario: 'TRENDING',        avgVolume: 45_000_000 },
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
};

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

function buildTradingDays(count: number): Date[] {
  const days: Date[] = [];
  const now = new Date();
  now.setHours(16, 0, 0, 0);
  let d = new Date(now);
  while (days.length < count) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days.unshift(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  return days;
}

function generateBaseSeries(profile: SymbolProfile, days: Date[], rng: () => number): OHLC[] {
  const { basePrice, volatility, avgVolume } = profile;
  const data: OHLC[] = [];
  let price = basePrice * 0.80; // start lower so we have upward movement

  for (let i = 0; i < days.length; i++) {
    const t = i / days.length;
    // gentle upward drift for most scenarios
    const drift = 0.0005 + normalRandom(rng) * 0.0001;
    const dailyReturn = drift + volatility * normalRandom(rng);

    const open = price;
    const close = round2(price * (1 + dailyReturn));
    const range = Math.abs(close - open);
    const extra = range * (0.2 + rng() * 0.5);
    const high = round2(Math.max(open, close) + extra);
    const low = round2(Math.min(open, close) - extra * 0.6);
    const volMultiplier = 0.6 + rng() * 0.8;
    const volume = Math.round(avgVolume * volMultiplier);

    data.push({ timestamp: days[i].getTime(), open, high, low, close, volume });
    price = close;
  }
  return data;
}

function applyTrendPullbackScenario(data: OHLC[], rng: () => number): OHLC[] {
  const n = data.length;
  // Strong uptrend for first 70%, then clean 5-day pullback, then one bounce day
  const series = data.map((d, i) => ({ ...d }));
  let price = series[0].close;

  // Amplify uptrend in first segment
  for (let i = 1; i < Math.floor(n * 0.75); i++) {
    const r = 0.001 + 0.012 * normalRandom(rng);
    price = price * (1 + r);
    series[i] = buildCandle(series[i].timestamp, price * (1 - 0.003 * rng()), price, series[i].volume, rng);
    price = series[i].close;
  }

  // 5-day pullback
  for (let i = Math.floor(n * 0.75); i < n - 2; i++) {
    const r = -0.005 + 0.008 * normalRandom(rng);
    price = price * (1 + r);
    series[i] = buildCandle(series[i].timestamp, price * (1 + 0.002), price, series[i].volume, rng);
    price = series[i].close;
  }

  // Bounce candle at the end
  price = price * 1.008;
  series[n - 2] = buildCandle(series[n - 2].timestamp, series[n - 2].close, price, series[n - 2].volume * 1.3, rng);
  series[n - 1] = buildCandle(series[n - 1].timestamp, series[n - 1].close, price * 1.003, series[n - 1].volume * 1.2, rng);

  return series;
}

function applyBreakoutScenario(data: OHLC[], rng: () => number): OHLC[] {
  const n = data.length;
  const series = data.map(d => ({ ...d }));
  let price = series[0].close;

  // Uptrend for first 65%
  for (let i = 1; i < Math.floor(n * 0.65); i++) {
    const r = 0.0008 + 0.015 * normalRandom(rng);
    price = price * (1 + r);
    series[i] = buildCandle(series[i].timestamp, price * 0.997, price, series[i].volume, rng);
    price = series[i].close;
  }

  // Consolidation (flat range): narrow candles
  const consolidationHigh = price;
  for (let i = Math.floor(n * 0.65); i < n - 1; i++) {
    const r = 0.001 * normalRandom(rng);
    price = Math.min(consolidationHigh, Math.max(consolidationHigh * 0.97, price * (1 + r)));
    const o = price * (1 + 0.001 * normalRandom(rng));
    const c = price * (1 + 0.001 * normalRandom(rng));
    series[i] = {
      ...series[i],
      open: round2(o),
      close: round2(c),
      high: round2(Math.max(o, c) * 1.002),
      low: round2(Math.min(o, c) * 0.998),
      volume: Math.round(series[i].volume * (0.5 + rng() * 0.3)),
    };
  }

  // Breakout candle: gap up, big volume
  const breakoutPrice = consolidationHigh * 1.025;
  series[n - 1] = {
    ...series[n - 1],
    open: round2(consolidationHigh * 1.005),
    close: round2(breakoutPrice),
    high: round2(breakoutPrice * 1.008),
    low: round2(consolidationHigh * 1.002),
    volume: Math.round(series[n - 1].volume * 2.5),
  };

  return series;
}

function applyReversalScenario(data: OHLC[], rng: () => number): OHLC[] {
  const n = data.length;
  const series = data.map(d => ({ ...d }));
  let price = series[0].close;

  // Downtrend for first 85%
  for (let i = 1; i < Math.floor(n * 0.85); i++) {
    const r = -0.006 + 0.018 * normalRandom(rng);
    price = price * (1 + r);
    series[i] = buildCandle(series[i].timestamp, price * 1.003, price, series[i].volume, rng);
    price = series[i].close;
  }

  // Oversold doji/hammer candles
  for (let i = Math.floor(n * 0.85); i < n - 1; i++) {
    const r = -0.002 + 0.012 * normalRandom(rng);
    price = price * (1 + r);
    const low = price * 0.990;
    const close = price * 1.005;
    series[i] = {
      ...series[i],
      open: round2(price),
      close: round2(close),
      high: round2(close * 1.005),
      low: round2(low),
      volume: Math.round(series[i].volume * 1.2),
    };
    price = close;
  }

  // Bullish reversal candle
  const rv = series[n - 1];
  series[n - 1] = {
    ...rv,
    open: round2(price),
    close: round2(price * 1.018),
    high: round2(price * 1.025),
    low: round2(price * 0.992),
    volume: Math.round(rv.volume * 2.0),
  };

  return series;
}

function buildCandle(timestamp: number, openBase: number, closeBase: number, volume: number, rng: () => number): OHLC {
  const open = round2(Math.abs(openBase));
  const close = round2(Math.abs(closeBase));
  const high = round2(Math.max(open, close) * (1 + rng() * 0.008));
  const low = round2(Math.min(open, close) * (1 - rng() * 0.008));
  return { timestamp, open, close, high, low, volume: Math.round(Math.abs(volume)) };
}

export class MockDataProvider implements MarketDataProvider {
  readonly name = 'mock';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getHistoricalPrices(symbol: string, days = 120): Promise<OHLC[]> {
    const profile = SYMBOL_PROFILES[symbol.toUpperCase()];
    if (!profile) throw new Error(`Unknown symbol: ${symbol}`);

    const rng = createRNG(symbolSeed(symbol));
    const tradingDays = buildTradingDays(days);
    let data = generateBaseSeries(profile, tradingDays, rng);

    switch (profile.scenario) {
      case 'TREND_PULLBACK': data = applyTrendPullbackScenario(data, createRNG(symbolSeed(symbol + 'tp'))); break;
      case 'BREAKOUT':       data = applyBreakoutScenario(data, createRNG(symbolSeed(symbol + 'bo'))); break;
      case 'REVERSAL':       data = applyReversalScenario(data, createRNG(symbolSeed(symbol + 'rv'))); break;
    }

    return data;
  }

  async getIntradayPrices(symbol: string): Promise<OHLC[]> {
    const historical = await this.getHistoricalPrices(symbol, 5);
    const last = historical[historical.length - 1];
    const rng = createRNG(symbolSeed(symbol + 'intra' + Date.now()));
    const data: OHLC[] = [];
    let price = last.open;
    const profile = SYMBOL_PROFILES[symbol.toUpperCase()];
    if (!profile) throw new Error(`Unknown symbol: ${symbol}`);

    const open = new Date();
    open.setHours(9, 30, 0, 0);
    const marketOpen = open.getTime();

    for (let i = 0; i < 78; i++) {
      const r = 0.0002 * normalRandom(rng);
      const c = round2(price * (1 + r));
      const o = round2(price);
      data.push({
        timestamp: marketOpen + i * 5 * 60 * 1000,
        open: o,
        close: c,
        high: round2(Math.max(o, c) * (1 + rng() * 0.002)),
        low: round2(Math.min(o, c) * (1 - rng() * 0.002)),
        volume: Math.round(profile.avgVolume / 78 * (0.5 + rng() * 1.0)),
      });
      price = c;
    }
    return data;
  }

  async getIndicators(symbol: string): Promise<{
    ema20: number[]; ema50: number[]; rsi14: number[]; atr14: number[]; volumeSma20: number;
  }> {
    const data = await this.getHistoricalPrices(symbol);
    const closes = data.map(d => d.close);
    return {
      ema20: calculateEMA(closes, 20),
      ema50: calculateEMA(closes, 50),
      rsi14: calculateRSI(closes, 14),
      atr14: calculateATR(data, 14),
      volumeSma20: calculateVolumeSMA(data, 20),
    };
  }

  async searchTickers(query: string): Promise<TickerSearchResult[]> {
    const q = query.trim().toLowerCase();
    const entries = Object.keys(SYMBOL_PROFILES).map(sym => ({
      symbol: sym,
      name: MOCK_COMPANY_NAMES[sym] ?? sym,
    }));
    if (!q) return entries.slice(0, 8);
    return entries
      .filter(
        e => e.symbol.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
      )
      .slice(0, 15);
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
