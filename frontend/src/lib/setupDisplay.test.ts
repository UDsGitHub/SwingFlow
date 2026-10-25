import { describe, expect, it } from 'vitest';
import { exitSummary, formatMoney, formatR, hasFixedTarget, paperStatus, shouldRaiseStop } from './setupDisplay';
import { makeSetup } from '../test/fixtures';

describe('setup display helpers', () => {
  it('knows whether a plan has a fixed target', () => {
    expect(hasFixedTarget(makeSetup())).toBe(false);
    expect(hasFixedTarget(makeSetup({ exitPlan: { maxHoldDays: 10 } }))).toBe(true);
    expect(hasFixedTarget(makeSetup({ exitPlan: null }))).toBe(true);
  });

  it('summarizes the exit', () => {
    expect(exitSummary(makeSetup())).toBe('Trailing stop 3× ATR · up to 40 days');
    expect(exitSummary(makeSetup({ exitPlan: { maxHoldDays: 10 } }))).toBe('Target $109.37');
  });

  it('formats R and money with signs', () => {
    expect(formatR(1.84)).toBe('+1.8R');
    expect(formatR(-1)).toBe('−1.0R');
    expect(formatMoney(187.34, true)).toBe('+$187.34');
    expect(formatMoney(-75.1, true)).toBe('−$75.10');
    expect(formatMoney(-5)).toBe('−$5.00');
  });

  it.each([
    [{ status: 'ACTIVE' }, 'Waiting for entry', 'neutral'],
    [{ status: 'TRIGGERED', paperFillPrice: 98.4 }, 'Triggered $98.40', 'brand'],
    [{ status: 'CLOSED', paperR: 2.6 }, 'Closed +2.6R', 'up'],
    [{ status: 'CLOSED', paperR: -1 }, 'Closed −1.0R', 'down'],
    [{ status: 'EXPIRED' }, 'Expired', 'muted'],
    [{ status: 'SKIPPED' }, 'Skipped (gap)', 'muted'],
  ] as const)('labels %j', (fields, label, tone) => {
    expect(paperStatus(makeSetup(fields))).toEqual({ label, tone });
  });

  it('asks to raise the stop only when the trailing stop is above the broker stop', () => {
    expect(shouldRaiseStop({ stopPrice: 93.94, suggestedStop: 97.1 })).toBe(true);
    expect(shouldRaiseStop({ stopPrice: 97.1, suggestedStop: 97.1 })).toBe(false);
    expect(shouldRaiseStop({ stopPrice: 98, suggestedStop: 97.1 })).toBe(false);
    expect(shouldRaiseStop({ stopPrice: null, suggestedStop: 97.1 })).toBe(true);
    expect(shouldRaiseStop({ stopPrice: 90, suggestedStop: null })).toBe(false);
  });
});
