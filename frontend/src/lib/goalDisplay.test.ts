import { describe, expect, it } from 'vitest';
import { byExpectedValue, money, validateSettings } from './goalDisplay';
import { AccountConfig } from '../types';

const config: AccountConfig = { accountSize: '5000', goalAmount: '100', goalPeriod: 'WEEKLY', riskPercent: '1.5', maxRiskPercent: '2' };

describe('money', () => {
  it('formats whole dollars, cents under $10, and negatives', () => {
    expect(money(12345.6)).toBe('$12,346');
    expect(money(7.25)).toBe('$7.25');
    expect(money(-40)).toBe('−$40');
    expect(money(0)).toBe('$0');
  });
});

describe('byExpectedValue', () => {
  it('ranks by expected value, unmeasured last, then score', () => {
    const rows = [
      { id: 'a', expectedValue: 10, score: 50 },
      { id: 'b', expectedValue: null, score: 99 },
      { id: 'c', expectedValue: 20, score: 10 },
      { id: 'd', expectedValue: 10, score: 60 },
    ];
    expect(rows.sort(byExpectedValue).map(r => r.id)).toEqual(['c', 'd', 'a', 'b']);
  });
});

describe('validateSettings', () => {
  it('accepts valid settings', () => {
    expect(validateSettings(config)).toEqual({ errors: {}, warnings: {} });
  });

  it('blocks risk above the ceiling instead of warning', () => {
    expect(validateSettings({ ...config, riskPercent: '2.5' }).errors.riskPercent).toMatch(/ceiling/);
    expect(validateSettings({ ...config, riskPercent: '2.5', maxRiskPercent: '3' }).errors).toEqual({});
  });

  it('warns about a ceiling above 2% and rejects one above 10%', () => {
    expect(validateSettings({ ...config, maxRiskPercent: '3' }).warnings.maxRiskPercent).toBeDefined();
    expect(validateSettings({ ...config, maxRiskPercent: '11' }).errors.maxRiskPercent).toBeDefined();
  });

  it('rejects empty and non-positive values', () => {
    const { errors } = validateSettings({ ...config, accountSize: '', goalAmount: '0', riskPercent: '-1' });
    expect(Object.keys(errors).sort()).toEqual(['accountSize', 'goalAmount', 'riskPercent']);
  });
});
