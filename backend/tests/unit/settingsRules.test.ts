import { describe, expect, it } from 'vitest';
import { Settings, mergeSettings } from '../../src/services/settingsRules';

const current: Settings = { accountSize: 5000, goalAmount: 100, goalPeriod: 'WEEKLY', riskPercent: 1.5, maxRiskPercent: 2 };

describe('mergeSettings', () => {
  it('accepts form strings and numbers and reports only changed fields', () => {
    const r = mergeSettings(current, { accountSize: '10000', goalPeriod: 'MONTHLY', riskPercent: 1, other: 'x' });
    expect(r).toEqual({ ok: true, settings: { ...current, accountSize: 10000, goalPeriod: 'MONTHLY', riskPercent: 1 }, changed: { accountSize: 10000, goalPeriod: 'MONTHLY', riskPercent: 1 } });
  });

  it('rejects non-numbers, non-positive values and unknown periods per field', () => {
    const r = mergeSettings(current, { accountSize: 'abc', goalAmount: '0', goalPeriod: 'YEARLY', riskPercent: '' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['accountSize', 'goalAmount', 'goalPeriod', 'riskPercent']);
  });

  it('keeps risk at or under the ceiling, including when only the ceiling is lowered', () => {
    expect(mergeSettings(current, { riskPercent: 2 }).ok).toBe(true);
    expect(mergeSettings(current, { riskPercent: 2.5 })).toMatchObject({ ok: false, errors: { riskPercent: 'Risk is above your 2% ceiling.' } });
    expect(mergeSettings(current, { maxRiskPercent: 1 })).toMatchObject({ ok: false, errors: { riskPercent: expect.any(String) } });
    expect(mergeSettings(current, { maxRiskPercent: 3, riskPercent: 2.5 }).ok).toBe(true);
  });

  it('caps the ceiling itself', () => {
    expect(mergeSettings(current, { maxRiskPercent: 11 })).toMatchObject({ ok: false, errors: { maxRiskPercent: expect.any(String) } });
  });
});
