import { OHLC, Indicators } from '../types';

export function calculateEMA(prices: number[], period: number): number[] {
  const ema = new Array<number>(prices.length).fill(NaN);
  if (prices.length < period) return ema;

  const k = 2 / (period + 1);

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  ema[period - 1] = sum / period;

  for (let i = period; i < prices.length; i++) {
    ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
  }

  return ema;
}

/** RSI from average gain/loss: 100 with no losses, 50 for a flat series. */
function rsiFrom(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function calculateRSI(prices: number[], period = 14): number[] {
  const rsi = new Array<number>(prices.length).fill(NaN);
  if (prices.length < period + 1) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }

  avgGain /= period;
  avgLoss /= period;

  rsi[period] = rsiFrom(avgGain, avgLoss);

  // Wilder's smoothing
  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = Math.max(0, diff);
    const loss = Math.max(0, -diff);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = rsiFrom(avgGain, avgLoss);
  }

  return rsi;
}

export function calculateATR(data: OHLC[], period = 14): number[] {
  const atr = new Array<number>(data.length).fill(NaN);
  if (data.length < period + 1) return atr;

  const tr: number[] = [data[0].high - data[0].low];
  for (let i = 1; i < data.length; i++) {
    const hl = data[i].high - data[i].low;
    const hc = Math.abs(data[i].high - data[i - 1].close);
    const lc = Math.abs(data[i].low - data[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }

  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  atr[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }

  return atr;
}

export function calculateVolumeSMA(data: OHLC[], period = 20): number {
  if (data.length < period) {
    const sum = data.reduce((a, d) => a + d.volume, 0);
    return sum / data.length;
  }
  const recent = data.slice(-period);
  return recent.reduce((a, d) => a + d.volume, 0) / period;
}

export function calculateSMA(prices: number[], period: number): number[] {
  const sma = new Array<number>(prices.length).fill(NaN);
  for (let i = period - 1; i < prices.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += prices[j];
    sma[i] = sum / period;
  }
  return sma;
}

export function findSwingLow(lows: number[], lookback = 10): number {
  const slice = lows.slice(-lookback);
  return Math.min(...slice.filter(v => !isNaN(v)));
}

export function findSwingHigh(highs: number[], lookback = 10): number {
  const slice = highs.slice(-lookback);
  return Math.max(...slice.filter(v => !isNaN(v)));
}

export function lastValid(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return NaN;
}

export function computeIndicators(data: OHLC[]): Indicators {
  const closes = data.map(d => d.close);
  return {
    ema20: calculateEMA(closes, 20),
    ema50: calculateEMA(closes, 50),
    rsi14: calculateRSI(closes, 14),
    atr14: calculateATR(data, 14),
    volumeSma20: calculateVolumeSMA(data, 20),
  };
}
