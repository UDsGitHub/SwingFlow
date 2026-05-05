import { BaseStrategy } from './BaseStrategy';
import { OHLC, Indicators, StrategyResult } from '../types';

export class ReversalStrategy extends BaseStrategy {
  readonly name = 'REVERSAL';

  evaluate(symbol: string, ohlc: OHLC[], indicators: Indicators): StrategyResult {
    const notTriggered: StrategyResult = {
      triggered: false, strategy: 'REVERSAL', direction: 'LONG',
      entry: 0, stop: 0, target: 0, confidence: 0, notes: '',
      developing: false,
      checks: {},
      explanation: 'Not enough evidence yet for reversal setup.',
      estimatedEntryZone: null,
    };

    const len = ohlc.length;
    if (len < 20) return { ...notTriggered, explanation: 'Need at least 20 candles for reversal context.' };

    const last = ohlc[len - 1];
    const prev = ohlc[len - 2];
    const rsi  = this.last(indicators.rsi14);
    const atr  = this.last(indicators.atr14);
    const ema50 = this.last(indicators.ema50);

    if (isNaN(rsi) || isNaN(atr)) return { ...notTriggered, explanation: 'Missing RSI/ATR indicators.' };
    const checks: Record<string, boolean> = {};

    // 1. Oversold: RSI < 35 (slightly wider than textbook 30 — catches exhaustion earlier)
    if (rsi >= 35) {
      const developingReversal = rsi < 42;
      if (developingReversal) {
        return {
          ...notTriggered,
          developing: true,
          checks,
          confidence: 48,
          explanation: `RSI ${rsi.toFixed(0)} is approaching oversold reversal range.`,
          estimatedEntryZone: [this.round2(last.close * 0.995), this.round2(last.close * 1.005)],
          notes: `${symbol} may be forming reversal conditions; wait for RSI and candle confirmation.`,
        };
      }
      return notTriggered;
    }
    checks.oversold = true;

    // 2. Not a death-spiral: price not more than 30% below 50 EMA
    checks.notDeathSpiral = isNaN(ema50) || last.close >= ema50 * 0.70;
    if (!checks.notDeathSpiral) return { ...notTriggered, checks, explanation: 'Price is too far below EMA50 for reversal quality.' };

    // 3. Bullish reversal candle: close > open (green candle)
    checks.bullishCandle = last.close > last.open;
    if (!checks.bullishCandle) return { ...notTriggered, checks, explanation: 'No bullish reversal candle.' };

    // 4. Buying pressure: close in upper 50% of candle range
    const rangePos = (last.close - last.low) / Math.max(last.high - last.low, 0.01);
    checks.rangePosition = rangePos >= 0.50;
    if (!checks.rangePosition) return { ...notTriggered, checks, explanation: 'Buying pressure is too weak in candle close.' };

    // 5. Hammer pattern bonus check (long lower wick)
    const bodySize  = Math.abs(last.close - last.open);
    const lowerWick = last.open - last.low;
    const isHammer  = lowerWick > bodySize * 1.5;

    // 6. Price recovering vs previous: today's close > yesterday's close
    checks.closeVsPrev = last.close > prev.close * 0.998;
    if (!checks.closeVsPrev) return { ...notTriggered, checks, explanation: 'No price recovery versus previous close.' };

    // Stop: 1.5x ATR below the candle's low (keeps stop tight and proportional)
    const stopDistance = Math.max(atr * 1.5, last.close * 0.02);

    const entry  = this.round2(last.close * 1.003);
    const stop   = this.round2(Math.max(last.low - atr * 0.5, entry - stopDistance));
    const risk   = entry - stop;
    checks.positiveRisk = risk > 0;
    if (!checks.positiveRisk) return { ...notTriggered, checks, explanation: 'Invalid setup geometry: non-positive risk.' };
    const target = this.round2(entry + risk * 2.5);

    let score = 60;
    if (rsi < 25) score += 15;
    else if (rsi < 30) score += 10;
    if (isHammer) score += 10;
    if (rangePos > 0.70) score += 10;
    if (last.volume > indicators.volumeSma20 * 1.2) score += 5;

    return {
      triggered: true,
      strategy: 'REVERSAL',
      direction: 'LONG',
      entry,
      stop,
      target,
      confidence: Math.min(score, 100),
      notes: `${symbol} oversold (RSI ${rsi.toFixed(0)}) with ${isHammer ? 'hammer reversal' : 'bullish candle'} at support. R/R 2.5:1.`,
      developing: false,
      checks,
      explanation: 'Reversal criteria satisfied.',
      estimatedEntryZone: [this.round2(entry * 0.998), this.round2(entry * 1.002)],
    };
  }
}
