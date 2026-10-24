// US equity market clock helpers. All market logic is in America/New_York,
// regardless of the server's timezone (Railway runs in UTC).

const MARKET_TZ = 'America/New_York';
export const SESSION_OPEN_MIN = 9 * 60 + 30;
export const SESSION_CLOSE_MIN = 16 * 60;

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
