import { BaseStrategy } from './BaseStrategy';
import { OHLC, Indicators, StrategyResult } from '../types';
import { findSwingLow } from '../indicators/technical';

export class TrendPullbackStrategy extends BaseStrategy {
  readonly name = 'TREND_PULLBACK';

  evaluate(symbol: string, ohlc: OHLC[], indicators: Indicators): StrategyResult {
    const notTriggered: StrategyResult = {
      triggered: false, strategy: 'TREND_PULLBACK', direction: 'LONG',
      entry: 0, stop: 0, target: 0, confidence: 0, notes: '',
    };

    const len = ohlc.length;
    if (len < 55) return notTriggered;

    const last = ohlc[len - 1];
    const prev = ohlc[len - 2];
    const ema20 = this.last(indicators.ema20);
    const ema50 = this.last(indicators.ema50);
    const rsi   = this.last(indicators.rsi14);
    const atr   = this.last(indicators.atr14);

    if (isNaN(ema20) || isNaN(ema50) || isNaN(rsi) || isNaN(atr)) return notTriggered;

    // 1. Uptrend: price > EMA20 > EMA50
    if (!(ema20 > ema50 * 1.001)) return notTriggered;

    // 2. Pullback zone: close is within 0.5%–4% below EMA20
    const distFromEma20 = (ema20 - last.close) / ema20;
    if (distFromEma20 < 0.002 || distFromEma20 > 0.05) return notTriggered;

    // 3. Price above EMA50 (not too deep a pullback)
    if (last.close < ema50 * 0.99) return notTriggered;

    // 4. RSI in healthy zone (not overbought)
    if (rsi < 30 || rsi > 65) return notTriggered;

    // 5. Bullish candle confirmation: close > open and bouncing
    if (last.close <= last.open) return notTriggered;
    if (last.close <= prev.close * 0.999) return notTriggered;

    // 6. Check close is in upper half of today's range (buying pressure)
    const rangePos = (last.close - last.low) / (last.high - last.low);
    if (rangePos < 0.45) return notTriggered;

    const swingLow = findSwingLow(ohlc.slice(-15).map(d => d.low));

    const entry  = this.round2(last.close * 1.002);
    const stop   = this.round2(Math.min(swingLow * 0.998, ema50 * 0.995));
    const risk   = entry - stop;
    if (risk <= 0) return notTriggered;
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
    };
  }
}
