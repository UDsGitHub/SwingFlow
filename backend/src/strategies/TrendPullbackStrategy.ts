import { BaseStrategy } from './BaseStrategy';
import { OHLC, Indicators, StrategyResult } from '../types';
import { findSwingLow } from '../indicators/technical';

export class TrendPullbackStrategy extends BaseStrategy {
  readonly name = 'TREND_PULLBACK';

  evaluate(symbol: string, ohlc: OHLC[], indicators: Indicators): StrategyResult {
    const notTriggered: StrategyResult = {
      triggered: false, strategy: 'TREND_PULLBACK', direction: 'LONG',
      entry: 0, stop: 0, target: 0, confidence: 0, notes: '',
      developing: false,
      checks: {},
      explanation: 'Not enough evidence yet for trend pullback setup.',
      estimatedEntryZone: null,
    };

    const len = ohlc.length;
    if (len < 55) return { ...notTriggered, explanation: 'Need at least 55 candles for trend context.' };

    const last = ohlc[len - 1];
    const prev = ohlc[len - 2];
    const ema20 = this.last(indicators.ema20);
    const ema50 = this.last(indicators.ema50);
    const rsi   = this.last(indicators.rsi14);
    const atr   = this.last(indicators.atr14);

    if (isNaN(ema20) || isNaN(ema50) || isNaN(rsi) || isNaN(atr)) {
      return { ...notTriggered, explanation: 'Missing EMA/RSI/ATR indicators.' };
    }

    // 1. Uptrend: price > EMA20 > EMA50
    const checks: Record<string, boolean> = {};
    checks.trend = ema20 > ema50 * 1.001;
    if (!checks.trend) return { ...notTriggered, checks, explanation: 'Trend check failed: EMA20 is not above EMA50.' };

    // 2. Pullback zone: close is within 0.5%–4% below EMA20
    const distFromEma20 = (ema20 - last.close) / ema20;
    if (distFromEma20 < 0.002 || distFromEma20 > 0.05) {
      const approachingPullback = distFromEma20 >= -0.02 && distFromEma20 < 0.002;
      if (approachingPullback) {
        return {
          ...notTriggered,
          developing: true,
          checks,
          confidence: 52,
          explanation: 'Price is above EMA20 but approaching pullback zone.',
          estimatedEntryZone: [this.round2(ema20 * 0.996), this.round2(ema20 * 1.001)],
          notes: `${symbol} trend remains intact; watch for a controlled pullback toward 20 EMA.`,
        };
      }
      return notTriggered;
    }
    checks.pullback = distFromEma20 >= 0.002 && distFromEma20 <= 0.05;

    // 3. Price above EMA50 (not too deep a pullback)
    checks.aboveEma50 = last.close >= ema50 * 0.99;
    if (!checks.aboveEma50) return { ...notTriggered, checks, explanation: 'Pullback is too deep below EMA50.' };

    // 4. RSI in healthy zone (not overbought)
    checks.rsiRange = rsi >= 30 && rsi <= 65;
    if (!checks.rsiRange) return { ...notTriggered, checks, explanation: `RSI ${rsi.toFixed(0)} is outside 30-65.` };

    // 5. Bullish candle confirmation: close > open and bouncing
    checks.bullishCandle = last.close > last.open;
    checks.closeVsPrev = last.close > prev.close * 0.999;
    if (!checks.bullishCandle || !checks.closeVsPrev) {
      return { ...notTriggered, checks, explanation: 'No bullish bounce confirmation candle.' };
    }

    // 6. Check close is in upper half of today's range (buying pressure)
    const rangePos = (last.close - last.low) / (last.high - last.low);
    checks.rangePosition = rangePos >= 0.45;
    if (!checks.rangePosition) return { ...notTriggered, checks, explanation: 'Close is too weak inside today candle range.' };

    const swingLow = findSwingLow(ohlc.slice(-15).map(d => d.low));

    const entry  = this.round2(last.close * 1.002);
    const stop   = this.round2(Math.min(swingLow * 0.998, ema50 * 0.995));
    const risk   = entry - stop;
    checks.positiveRisk = risk > 0;
    if (!checks.positiveRisk) return { ...notTriggered, checks, explanation: 'Invalid setup geometry: non-positive risk.' };
    const target = this.round2(entry + risk * 2.5);

    // Confidence: weighted score
    let score = 60;
    if (rsi > 40 && rsi < 58) score += 10;
    if (rangePos > 0.65) score += 10;
    if (ema20 > ema50 * 1.005) score += 10;
    if (last.volume > indicators.volumeSma20 * 1.1) score += 10;

    return {
      triggered: true,
      strategy: 'TREND_PULLBACK',
      direction: 'LONG',
      entry,
      stop,
      target,
      confidence: Math.min(score, 100),
      notes: `${symbol} pulled back ${(distFromEma20 * 100).toFixed(1)}% to 20 EMA in uptrend. RSI ${rsi.toFixed(0)}. R/R 2.5:1.`,
      developing: false,
      explanation: 'Trend pullback criteria satisfied.',
      estimatedEntryZone: [this.round2(entry * 0.998), this.round2(entry * 1.002)],
      checks,
    };
  }
}
