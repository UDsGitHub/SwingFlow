import { describe, expect, it } from 'vitest';
import { completedBars, marketClock, sessionProgress } from '../../src/lib/marketTime';
import { barsFrom } from '../helpers/bars';

describe('marketClock', () => {
  it('reports ET date, minutes and weekday during EDT (UTC-4)', () => {
    expect(marketClock(Date.parse('2026-10-23T13:30:00Z'))).toEqual({ date: '2026-10-23', minutes: 9 * 60 + 30, weekday: 5 });
  });

  it('reports ET time during EST (UTC-5)', () => {
    expect(marketClock(Date.parse('2026-12-01T14:30:00Z'))).toMatchObject({ date: '2026-12-01', minutes: 9 * 60 + 30 });
  });

  it('rolls the date at ET midnight, not UTC midnight', () => {
    expect(marketClock(Date.parse('2026-10-24T02:00:00Z')).date).toBe('2026-10-23');
  });

  it('handles the spring-forward and fall-back DST days', () => {
    // 2026-03-08: clocks jump 02:00 → 03:00 ET; 2026-11-01: clocks fall back 02:00 → 01:00 ET.
    expect(marketClock(Date.parse('2026-03-09T13:30:00Z')).minutes).toBe(9 * 60 + 30);
    expect(marketClock(Date.parse('2026-11-02T14:30:00Z')).minutes).toBe(9 * 60 + 30);
  });
});

describe('sessionProgress', () => {
  it('is 0 before the open, 1 after the close, and fractional in between', () => {
    expect(sessionProgress(Date.parse('2026-10-23T13:00:00Z'))).toBe(0);
    expect(sessionProgress(Date.parse('2026-10-23T16:45:00Z'))).toBeCloseTo(0.5);
    expect(sessionProgress(Date.parse('2026-10-23T20:30:00Z'))).toBe(1);
  });

  it('is 1 on weekends', () => {
    expect(sessionProgress(Date.parse('2026-10-24T16:00:00Z'))).toBe(1);
  });
});

describe('completedBars', () => {
  // Thursday 2026-10-22 and Friday 2026-10-23
  const bars = barsFrom([[1, 1, 1, 1], [2, 2, 2, 2]], '2026-10-22');
  const lastDate = (at: string) => marketClock(completedBars(bars, Date.parse(at)).at(-1)!.timestamp).date;

  it('drops today\'s bar while the session is running', () => {
    expect(lastDate('2026-10-23T15:00:00Z')).toBe('2026-10-22');
  });

  it('still drops it just after the close, until the delayed feed is final (16:20 ET)', () => {
    expect(lastDate('2026-10-23T20:10:00Z')).toBe('2026-10-22');
    expect(lastDate('2026-10-23T20:20:00Z')).toBe('2026-10-23');
  });

  it('keeps every bar when the latest bar is from an earlier day', () => {
    expect(completedBars(bars, Date.parse('2026-10-24T14:00:00Z'))).toHaveLength(2);
  });

  it('handles an empty series', () => {
    expect(completedBars([], Date.now())).toEqual([]);
  });
});
