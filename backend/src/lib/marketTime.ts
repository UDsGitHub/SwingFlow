// US equity market clock helpers. All market logic is in America/New_York,
// regardless of the server's timezone (Railway runs in UTC).

import { OHLC } from '../types';

const MARKET_TZ = 'America/New_York';
export const SESSION_OPEN_MIN = 9 * 60 + 30;
export const SESSION_CLOSE_MIN = 16 * 60;
/** Today's daily bar is treated as final from this time (covers the 15-min delayed SIP feed). */
export const DAILY_BAR_FINAL_MIN = 16 * 60 + 20;

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: MARKET_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
});

export interface MarketClock {
  /** ET calendar date, YYYY-MM-DD */
  date: string;
  /** Minutes since ET midnight */
  minutes: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function marketClock(at: Date | number = Date.now()): MarketClock {
  const parts = Object.fromEntries(fmt.formatToParts(new Date(at)).map(p => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
  };
}

/** Fraction of today's regular session elapsed: 0 before the open, 1 after the close or on weekends. */
export function sessionProgress(at: Date | number = Date.now()): number {
  const { minutes, weekday } = marketClock(at);
  if (weekday === 0 || weekday === 6) return 1;
  if (minutes <= SESSION_OPEN_MIN) return 0;
  if (minutes >= SESSION_CLOSE_MIN) return 1;
  return (minutes - SESSION_OPEN_MIN) / (SESSION_CLOSE_MIN - SESSION_OPEN_MIN);
}

/**
 * Drop today's still-forming daily bar so strategies only judge finished candles.
 * Before DAILY_BAR_FINAL_MIN ET, a bar dated today is incomplete.
 */
export function completedBars(bars: OHLC[], at: Date | number = Date.now()): OHLC[] {
  if (!bars.length) return bars;
  const clock = marketClock(at);
  if (marketClock(bars[bars.length - 1].timestamp).date !== clock.date) return bars;
  return clock.minutes >= DAILY_BAR_FINAL_MIN ? bars : bars.slice(0, -1);
}

/** UTC timestamp of 00:00 ET on an ET calendar date. */
function etMidnight(date: string): number {
  const est = Date.parse(`${date}T05:00:00Z`);
  // During EDT, 05:00Z is 01:00 local time, so midnight is an hour earlier.
  return marketClock(est).minutes === 60 ? est - 60 * 60 * 1000 : est;
}

/** [start, end) in UTC ms of an ET calendar date — 23 or 25 hours long on DST change days. */
export function etDayRange(date: string): { start: number; end: number } {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: etMidnight(date), end: etMidnight(next.toISOString().slice(0, 10)) };
}
