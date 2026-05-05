import { BaseStrategy } from './BaseStrategy';
import { OHLC, Indicators, StrategyResult } from '../types';

export class BreakoutStrategy extends BaseStrategy {
  readonly name = 'BREAKOUT';

  evaluate(symbol: string, ohlc: OHLC[], indicators: Indicators): StrategyResult {
    const notTriggered: StrategyResult = {
      triggered: false, strategy: 'BREAKOUT', direction: 'LONG',
      entry: 0, stop: 0, target: 0, confidence: 0, notes: '',
      developing: false,
      checks: {},
      explanation: 'Not enough evidence yet for breakout setup.',
      estimatedEntryZone: null,
    };

    const len = ohlc.length;
    if (len < 20) return { ...notTriggered, explanation: 'Need at least 20 candles for breakout context.' };

    const last = ohlc[len - 1];
    const atr   = this.last(indicators.atr14);
    if (isNaN(atr)) return { ...notTriggered, explanation: 'Missing ATR indicator.' };
    const checks: Record<string, boolean> = {};

    // Look at consolidation window (7 candles before the last)
    const consolidation = ohlc.slice(-9, -1);
    if (consolidation.length < 7) return { ...notTriggered, explanation: 'Need at least 7 bars of consolidation.' };

    const conHighs = consolidation.map(d => d.high);
    const conLows  = consolidation.map(d => d.low);
    const consolidationHigh = Math.max(...conHighs);
    const consolidationLow  = Math.min(...conLows);

    const conRange = (consolidationHigh - consolidationLow) / consolidationHigh;

    // 1. Consolidation: range must be < 5% of price (tight base)
    checks.tightBase = conRange <= 0.05;
    if (!checks.tightBase) return { ...notTriggered, checks, explanation: 'Consolidation range too wide.' };

    // 2. Breakout: last close > consolidation high
    if (last.close <= consolidationHigh * 1.001) {
      const nearBreakout = conRange <= 0.05 && last.close >= consolidationHigh * 0.99;
      if (nearBreakout) {
        return {
          ...notTriggered,
          developing: true,
          checks,
          confidence: 50,
          explanation: 'Price is near breakout level; waiting for confirmed close above resistance.',
          estimatedEntryZone: [this.round2(consolidationHigh * 0.999), this.round2(consolidationHigh * 1.003)],
          notes: `${symbol} is consolidating near resistance; watch for volume-backed breakout confirmation.`,
        };
      }
      return notTriggered;
    }
    checks.breakout = true;

    // 3. Breakout candle is strong: close > open, close near high
    checks.strongCandle = last.close > last.open * 1.001;
    if (!checks.strongCandle) return { ...notTriggered, checks, explanation: 'Breakout candle body is too weak.' };
    const rangePos = (last.close - last.low) / (last.high - last.low);
    checks.rangePosition = rangePos >= 0.55;
    if (!checks.rangePosition) return { ...notTriggered, checks, explanation: 'Close not strong enough within candle range.' };

    // 4. Volume confirmation: breakout candle volume > 1.3x average
    const volumeRatio = last.volume / Math.max(indicators.volumeSma20, 1);
    checks.volume = volumeRatio >= 1.25;
    if (!checks.volume) return { ...notTriggered, checks, explanation: 'Volume confirmation is insufficient.' };

    // 5. Not overbought
    const rsi = this.last(indicators.rsi14);
    checks.notOverbought = isNaN(rsi) || rsi <= 75;
    if (!checks.notOverbought) return { ...notTriggered, checks, explanation: `RSI ${rsi.toFixed(0)} is overbought for breakout entry.` };

    const entry  = this.round2(last.close * 1.002);
    const stop   = this.round2(consolidationLow * 0.997);
    const risk   = entry - stop;
    checks.positiveRisk = risk > 0;
    if (!checks.positiveRisk) return { ...notTriggered, checks, explanation: 'Invalid setup geometry: non-positive risk.' };
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
      developing: false,
      checks,
      explanation: 'Breakout criteria satisfied.',
      estimatedEntryZone: [this.round2(entry * 0.998), this.round2(entry * 1.002)],
    };
  }
}
