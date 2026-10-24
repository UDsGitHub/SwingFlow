import { afterEach, describe, expect, it } from 'vitest';
import { ReversalStrategy } from '../../src/strategies/ReversalStrategy';
import { BreakoutStrategy } from '../../src/strategies/BreakoutStrategy';
import { TrendPullbackStrategy } from '../../src/strategies/TrendPullbackStrategy';
import { allowsRegime } from '../../src/strategies/regimeGate';
import { ALL_STRATEGY_TYPES, EXIT_PLANS, createStrategies, enabledStrategyTypes } from '../../src/strategies/strategyConfig';
import { classifyRegime } from '../../src/services/MarketRegimeService';
import { computeIndicators } from '../../src/indicators/technical';
import { MockDataProvider } from '../../src/providers/MockDataProvider';
import { marketClock } from '../../src/lib/marketTime';
import { OHLC } from '../../src/types';
import { barsFrom, barsFromCloses } from '../helpers/bars';

const evalWith = (s: { evaluate: ReversalStrategy['evaluate'] }, bars: OHLC[]) => s.evaluate('TEST', bars, computeIndicators(bars));

/** 40 steadily falling closes (RSI deep in oversold) followed by `last`. */
function selloffThen(last: [number, number, number, number]): OHLC[] {
  const closes = Array.from({ length: 40 }, (_, i) => 100 * Math.pow(0.99, i));
  const bars = barsFromCloses(closes);
  return [...bars, ...barsFrom([last], '2025-03-03')];
}

describe('ReversalStrategy', () => {
  const prev = 100 * Math.pow(0.99, 39); // ≈ 67.6

  it('triggers on an oversold bullish candle closing in its upper half', () => {
    const r = evalWith(new ReversalStrategy(), selloffThen([prev * 0.995, prev * 1.02, prev * 0.99, prev * 1.015]));
    expect(r.triggered).toBe(true);
    expect(r.entry).toBeCloseTo(prev * 1.015 * 1.003, 1);
    expect(r.stop).toBeLessThan(r.entry);
    expect(r.target - r.entry).toBeCloseTo((r.entry - r.stop) * 2.5, 1);
    expect(r.checks).toMatchObject({ oversold: true, bullishCandle: true, rangePosition: true, closeVsPrev: true, positiveRisk: true });
  });

  it('rejects a red candle', () => {
    const r = evalWith(new ReversalStrategy(), selloffThen([prev * 1.01, prev * 1.02, prev * 0.98, prev * 0.99]));
    expect(r.triggered).toBe(false);
    expect(r.explanation).toMatch(/bullish reversal candle/i);
  });

  it('rejects a weak close in the lower half of the range', () => {
    const r = evalWith(new ReversalStrategy(), selloffThen([prev * 0.99, prev * 1.05, prev * 0.985, prev * 1.0]));
    expect(r.triggered).toBe(false);
  });

  it('flags a developing setup when RSI is approaching oversold', () => {
    // Choppy decline: RSI ends between 35 and 42.
    const closes: number[] = [];
    let p = 100;
    for (let i = 0; i < 60; i++) { p *= i % 3 === 2 ? 1.010 : 0.991; closes.push(p); }
    const r = evalWith(new ReversalStrategy(), barsFromCloses(closes));
    const rsi = computeIndicators(barsFromCloses(closes)).rsi14.at(-1)!;
    expect(rsi).toBeGreaterThanOrEqual(35);
    expect(rsi).toBeLessThan(42);
    expect(r).toMatchObject({ triggered: false, developing: true });
  });

  it('needs at least 20 candles', () => {
    expect(evalWith(new ReversalStrategy(), barsFromCloses([1, 2, 3])).explanation).toMatch(/20 candles/);
  });
});

describe('BreakoutStrategy', () => {
  it('triggers on a high-volume close above a tight 8-bar base', () => {
    const base = barsFromCloses(Array.from({ length: 30 }, (_, i) => 100 + (i % 2 ? 0.5 : -0.5)));
    const [breakout] = barsFrom([[100.6, 103.2, 100.5, 103]], '2025-03-03', 3_000_000);
    const r = evalWith(new BreakoutStrategy(), [...base, breakout]);
    expect(r.triggered).toBe(true);
    expect(r.checks).toMatchObject({ tightBase: true, breakout: true, volume: true });
  });

  it('rejects a breakout without volume', () => {
    const base = barsFromCloses(Array.from({ length: 30 }, (_, i) => 100 + (i % 2 ? 0.5 : -0.5)));
    const [breakout] = barsFrom([[100.6, 103.2, 100.5, 103]], '2025-03-03', 1_000_000);
    expect(evalWith(new BreakoutStrategy(), [...base, breakout]).triggered).toBe(false);
  });
});

describe('TrendPullbackStrategy', () => {
  it('rejects a series without an uptrend', () => {
    const r = evalWith(new TrendPullbackStrategy(), barsFromCloses(Array.from({ length: 80 }, (_, i) => 100 - i * 0.2)));
    expect(r.triggered).toBe(false);
    expect(r.explanation).toMatch(/Trend check failed/);
  });
});

describe('strategy configuration', () => {
  afterEach(() => { delete process.env.ENABLED_STRATEGIES; delete process.env.ENABLE_REGIME_GATING; });

  it('enables only Reversal by default', () => {
    expect(enabledStrategyTypes()).toEqual(['REVERSAL']);
    expect(createStrategies().map(s => s.name)).toEqual(['REVERSAL']);
  });

  it('honors ENABLED_STRATEGIES and ignores unknown names', () => {
    process.env.ENABLED_STRATEGIES = 'breakout, REVERSAL,bogus';
    expect(enabledStrategyTypes()).toEqual(['BREAKOUT', 'REVERSAL']);
  });

  it('defines an exit plan for every strategy; Reversal trails 3×ATR for up to 40 days', () => {
    expect(Object.keys(EXIT_PLANS).sort()).toEqual([...ALL_STRATEGY_TYPES].sort());
    expect(EXIT_PLANS.REVERSAL).toEqual({ maxHoldDays: 40, targetR: null, trailAtrMult: 3 });
  });

  it('gates strategies by regime; Reversal is allowed everywhere', () => {
    for (const regime of ['TRENDING_UP', 'TRENDING_DOWN', 'RANGING'] as const) expect(allowsRegime('REVERSAL', regime)).toBe(true);
    expect(allowsRegime('TREND_PULLBACK', 'TRENDING_UP')).toBe(true);
    expect(allowsRegime('TREND_PULLBACK', 'RANGING')).toBe(false);
    expect(allowsRegime('BREAKOUT', 'RANGING')).toBe(false);
    process.env.ENABLE_REGIME_GATING = 'false';
    expect(allowsRegime('TREND_PULLBACK', 'RANGING')).toBe(true);
  });
});

describe('classifyRegime', () => {
  const series = (step: number) => barsFromCloses(Array.from({ length: 260 }, (_, i) => 100 * Math.pow(1 + step, i)));

  it('detects uptrends, downtrends and ranges', () => {
    expect(classifyRegime('SPY', series(0.002)).regime).toBe('TRENDING_UP');
    expect(classifyRegime('SPY', series(-0.002)).regime).toBe('TRENDING_DOWN');
    // Long uptrend, then a drop below the 50-day while the 50-day is still above the 200-day.
    const mixed = barsFromCloses(Array.from({ length: 260 }, (_, i) => (i < 240 ? 100 * Math.pow(1.002, i) : 100 * Math.pow(1.002, 240) * Math.pow(0.99, i - 240))));
    expect(classifyRegime('SPY', mixed).regime).toBe('RANGING');
  });

  it('keeps confidence within 35–95', () => {
    const c = classifyRegime('SPY', series(0.002)).confidence;
    expect(c).toBeGreaterThanOrEqual(35);
    expect(c).toBeLessThanOrEqual(95);
  });
});

describe('signal regression on deterministic mock data', () => {
  afterEach(() => { delete process.env.MOCK_MARKET_TIME; });

  // Any change to strategy rules, indicators or the mock generator changes these dates.
  // If the change is intended, review the diff and update with `npx vitest -u`.
  it('produces the same signals as before', async () => {
    process.env.MOCK_MARKET_TIME = '2026-10-23T20:30:00Z';
    const provider = new MockDataProvider();
    const strategies = [new ReversalStrategy(), new BreakoutStrategy(), new TrendPullbackStrategy()];
    const signals: Record<string, string[]> = {};
    for (const symbol of ['AAPL', 'NVDA', 'TSLA', 'SPY', 'JPM']) {
      const bars = await provider.getHistoricalPrices(symbol, 400);
      for (let i = 120; i <= bars.length; i++) {
        const w = bars.slice(i - 120, i);
        for (const s of strategies) {
          if (s.evaluate(symbol, w, computeIndicators(w)).triggered) {
            (signals[`${symbol} ${s.name}`] ??= []).push(marketClock(w[w.length - 1].timestamp).date);
          }
        }
      }
    }
    expect(Object.keys(signals).length).toBeGreaterThan(3);
    expect(signals).toMatchSnapshot();
  });
});
