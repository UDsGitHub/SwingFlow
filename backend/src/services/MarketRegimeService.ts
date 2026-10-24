import { getProviderForUser } from '../providers/resolveUserProvider';
import { computeIndicators } from '../indicators/technical';
import { MarketRegime, OHLC, RegimeSnapshot } from '../types';

/** Daily bars needed for a regime read (EMA200 plus warm-up). */
export const REGIME_BARS = 260;
const INDICATOR_BARS = 120;

export class MarketRegimeService {
  async detectForUser(userId: string): Promise<RegimeSnapshot> {
    const provider = await getProviderForUser(userId);
    const symbol = process.env.REGIME_SYMBOL ?? 'SPY';
    return classifyRegime(symbol, await provider.getHistoricalPrices(symbol, REGIME_BARS));
  }
}

/** Pure regime classification from the most recent REGIME_BARS daily bars (also used by the backtester). */
export function classifyRegime(symbol: string, ohlc: OHLC[]): RegimeSnapshot {
  const indicators = computeIndicators(ohlc.slice(-INDICATOR_BARS));
  const last = ohlc[ohlc.length - 1];
  const ema50 = indicators.ema50[indicators.ema50.length - 1] ?? last.close;
  const ema200Series = ema(ohlc.map(c => c.close), 200);
  const ema200 = ema200Series[ema200Series.length - 1] ?? ema50;
  const atr = indicators.atr14[indicators.atr14.length - 1] ?? 0;
  const atrPercent = last.close > 0 ? atr / last.close : 0;

  let regime: MarketRegime = 'RANGING';
  if (last.close > ema50 && ema50 > ema200) regime = 'TRENDING_UP';
  if (last.close < ema50 && ema50 < ema200) regime = 'TRENDING_DOWN';

  // Elevated volatility reduces confidence regardless of direction.
  let confidence = 70;
  confidence += regime === 'RANGING' ? 5 : 10;
  confidence -= Math.min(30, Math.round(atrPercent * 300));
  confidence = Math.max(35, Math.min(confidence, 95));

  return {
    symbol,
    regime,
    confidence,
    ema50,
    ema200,
    atrPercent,
    lastPrice: last.close,
  };
}

function ema(values: number[], period: number): number[] {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}
