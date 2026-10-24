import { OHLC } from '../../src/types';

/** [open, high, low, close] rows → daily bars on consecutive weekdays starting at `startDate` (ET midnight timestamps). */
export function barsFrom(rows: [number, number, number, number][], startDate = '2025-01-06', volume = 1_000_000): OHLC[] {
  const d = new Date(`${startDate}T12:00:00Z`);
  return rows.map(([open, high, low, close]) => {
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    const bar = { timestamp: Date.parse(`${d.toISOString().slice(0, 10)}T05:00:00Z`), open, high, low, close, volume };
    d.setUTCDate(d.getUTCDate() + 1);
    return bar;
  });
}

/** A flat series of `n` identical bars. */
export function flatBars(n: number, price = 100, startDate = '2025-01-06'): OHLC[] {
  return barsFrom(Array.from({ length: n }, () => [price, price * 1.005, price * 0.995, price] as [number, number, number, number]), startDate);
}

/** Closes → bars with a small symmetric range around each close (open = previous close). */
export function barsFromCloses(closes: number[], startDate = '2025-01-06'): OHLC[] {
  return barsFrom(closes.map((c, i) => {
    const o = i ? closes[i - 1] : c;
    return [o, Math.max(o, c) * 1.002, Math.min(o, c) * 0.998, c] as [number, number, number, number];
  }), startDate);
}
