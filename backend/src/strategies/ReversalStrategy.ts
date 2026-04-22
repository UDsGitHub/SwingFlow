import { BaseStrategy } from './BaseStrategy';
import { OHLC, Indicators, StrategyResult } from '../types';

export class ReversalStrategy extends BaseStrategy {
  readonly name = 'REVERSAL';

  evaluate(symbol: string, ohlc: OHLC[], indicators: Indicators): StrategyResult {
    const notTriggered: StrategyResult = {
      triggered: false, strategy: 'REVERSAL', direction: 'LONG',
      entry: 0, stop: 0, target: 0, confidence: 0, notes: '',
    };

    const len = ohlc.length;
    if (len < 20) return notTriggered;

    const last = ohlc[len - 1];
    const prev = ohlc[len - 2];
    const rsi  = this.last(indicators.rsi14);
    const atr  = this.last(indicators.atr14);
    const ema50 = this.last(indicators.ema50);

    if (isNaN(rsi) || isNaN(atr)) return notTriggered;

    // 1. Oversold: RSI < 35
    if (rsi >= 35) return notTriggered;

    // 2. Not a death-spiral: price not more than 30% below 50 EMA
    if (!isNaN(ema50) && last.close < ema50 * 0.70) return notTriggered;

    // 3. Bullish reversal candle: close > open (green candle)
    if (last.close <= last.open) return notTriggered;

    // 4. Buying pressure: close in upper 50% of candle range
    const rangePos = (last.close - last.low) / Math.max(last.high - last.low, 0.01);
    if (rangePos < 0.50) return notTriggered;

    // 5. Hammer pattern bonus check (long lower wick)
    const bodySize  = Math.abs(last.close - last.open);
    const lowerWick = last.open - last.low;
    const isHammer  = lowerWick > bodySize * 1.5;

    // 6. Price recovering vs previous: today's close > yesterday's close
    if (last.close <= prev.close * 0.998) return notTriggered;

    // Stop: 1.5x ATR below the candle's low (keeps stop tight and proportional)
    const stopDistance = Math.max(atr * 1.5, last.close * 0.02);

    const entry  = this.round2(last.close * 1.003);
    const stop   = this.round2(Math.max(last.low - atr * 0.5, entry - stopDistance));
    const risk   = entry - stop;
    if (risk <= 0) return notTriggered;
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
    };
  }
}
