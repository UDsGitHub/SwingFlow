import { BaseStrategy } from './BaseStrategy';
import { OHLC, Indicators, StrategyResult } from '../types';

export class BreakoutStrategy extends BaseStrategy {
  readonly name = 'BREAKOUT';

  evaluate(symbol: string, ohlc: OHLC[], indicators: Indicators): StrategyResult {
    const notTriggered: StrategyResult = {
      triggered: false, strategy: 'BREAKOUT', direction: 'LONG',
      entry: 0, stop: 0, target: 0, confidence: 0, notes: '',
    };

    const len = ohlc.length;
    if (len < 20) return notTriggered;

    const last = ohlc[len - 1];
    const atr   = this.last(indicators.atr14);
    if (isNaN(atr)) return notTriggered;

    // Look at consolidation window (7 candles before the last)
    const consolidation = ohlc.slice(-9, -1);
    if (consolidation.length < 7) return notTriggered;

    const conHighs = consolidation.map(d => d.high);
    const conLows  = consolidation.map(d => d.low);
    const consolidationHigh = Math.max(...conHighs);
    const consolidationLow  = Math.min(...conLows);

    const conRange = (consolidationHigh - consolidationLow) / consolidationHigh;

    // 1. Consolidation: range must be < 5% of price (tight base)
    if (conRange > 0.05) return notTriggered;

    // 2. Breakout: last close > consolidation high
    if (last.close <= consolidationHigh * 1.001) return notTriggered;

    // 3. Breakout candle is strong: close > open, close near high
    if (last.close <= last.open * 1.001) return notTriggered;
    const rangePos = (last.close - last.low) / (last.high - last.low);
    if (rangePos < 0.55) return notTriggered;

    // 4. Volume confirmation: breakout candle volume > 1.3x average
    const volumeRatio = last.volume / Math.max(indicators.volumeSma20, 1);
    if (volumeRatio < 1.25) return notTriggered;

    // 5. Not overbought
    const rsi = this.last(indicators.rsi14);
    if (!isNaN(rsi) && rsi > 75) return notTriggered;

    const entry  = this.round2(last.close * 1.002);
    const stop   = this.round2(consolidationLow * 0.997);
    const risk   = entry - stop;
    if (risk <= 0) return notTriggered;
    const target = this.round2(entry + risk * 2.0);

    let score = 65;
    if (volumeRatio > 2.0) score += 15;
    else if (volumeRatio > 1.5) score += 8;
    if (conRange < 0.03) score += 10;
    if (rangePos > 0.75) score += 10;

    return {
      triggered: true,
      strategy: 'BREAKOUT',
      direction: 'LONG',
      entry,
      stop,
      target,
      confidence: Math.min(score, 100),
      notes: `${symbol} breaking out of ${(conRange * 100).toFixed(1)}% base on ${(volumeRatio).toFixed(1)}x volume. R/R 2:1.`,
    };
  }
}
