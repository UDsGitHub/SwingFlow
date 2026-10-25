import { describe, expect, it } from 'vitest';
import { completedBars, etPeriodRange, marketClock, periodStart, sessionProgress } from '../../src/lib/marketTime';
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

describe('goal periods', () => {
  it('starts days on the date, weeks on Monday and months on the 1st', () => {
    expect(periodStart('2026-10-25', 'DAILY')).toBe('2026-10-25');
    expect(periodStart('2026-10-25', 'WEEKLY')).toBe('2026-10-19'); // Sunday belongs to the week that began Monday
    expect(periodStart('2026-10-26', 'WEEKLY')).toBe('2026-10-26');
    expect(periodStart('2026-11-01', 'WEEKLY')).toBe('2026-10-26');
    expect(periodStart('2026-10-25', 'MONTHLY')).toBe('2026-10-01');
  });

  it('spans ET midnights, across DST changes', () => {
    // Week of Mon 2026-10-26: EDT start, EST end (clocks fall back on Sun 11-01) → 7 days + 1 hour.
    const week = etPeriodRange('2026-10-28', 'WEEKLY');
    expect(new Date(week.start).toISOString()).toBe('2026-10-26T04:00:00.000Z');
    expect(new Date(week.end).toISOString()).toBe('2026-11-02T05:00:00.000Z');
    const oct = etPeriodRange('2026-10-15', 'MONTHLY');
    expect(new Date(oct.start).toISOString()).toBe('2026-10-01T04:00:00.000Z');
    expect(new Date(oct.end).toISOString()).toBe('2026-11-01T04:00:00.000Z');
    const dec = etPeriodRange('2026-12-31', 'MONTHLY');
    expect(new Date(dec.end).toISOString()).toBe('2027-01-01T05:00:00.000Z');
    expect(etPeriodRange('2026-10-23', 'DAILY')).toEqual({ start: Date.parse('2026-10-23T04:00:00Z'), end: Date.parse('2026-10-24T04:00:00Z') });
  });
});
