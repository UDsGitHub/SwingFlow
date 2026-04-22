import { OHLC, Indicators, StrategyResult } from '../types';

export abstract class BaseStrategy {
  abstract readonly name: string;

  abstract evaluate(symbol: string, ohlc: OHLC[], indicators: Indicators): StrategyResult;

  protected round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  protected lastN(arr: number[], n: number): number[] {
    return arr.slice(-n).filter(v => !isNaN(v));
  }

  protected last(arr: number[]): number {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!isNaN(arr[i])) return arr[i];
    }
    return NaN;
  }
}
