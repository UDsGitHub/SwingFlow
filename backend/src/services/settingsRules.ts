import { GoalPeriod } from '../types';

export const GOAL_PERIODS: GoalPeriod[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
/** Hard limit on the user's own risk ceiling. */
export const MAX_RISK_CEILING = 10;

export interface Settings {
  accountSize: number;
  goalAmount: number;
  goalPeriod: GoalPeriod;
  riskPercent: number;
  maxRiskPercent: number;
}

export type SettingsField = keyof Settings;
export type SettingsErrors = Partial<Record<SettingsField, string>>;

const NUMERIC: Exclude<SettingsField, 'goalPeriod'>[] = ['accountSize', 'goalAmount', 'riskPercent', 'maxRiskPercent'];

/**
 * Merge a partial update (strings or numbers, as sent by the settings form or query string)
 * into the current settings and validate the result as a whole, so a lower ceiling cannot
 * leave risk above it. Unknown keys are ignored.
 */
export function mergeSettings(
  current: Settings,
  patch: Record<string, unknown>,
): { ok: true; settings: Settings; changed: Partial<Settings> } | { ok: false; errors: SettingsErrors } {
  const errors: SettingsErrors = {};
  const changed: Partial<Settings> = {};

  for (const field of NUMERIC) {
    const raw = patch[field];
    if (raw === undefined) continue;
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
    if (!Number.isFinite(n)) errors[field] = 'Must be a number.';
    else changed[field] = n;
  }
  if (patch.goalPeriod !== undefined) {
    if (GOAL_PERIODS.includes(patch.goalPeriod as GoalPeriod)) changed.goalPeriod = patch.goalPeriod as GoalPeriod;
    else errors.goalPeriod = 'Must be DAILY, WEEKLY or MONTHLY.';
  }

  const s: Settings = { ...current, ...changed };
  if (!errors.accountSize && !(s.accountSize > 0)) errors.accountSize = 'Account size must be greater than $0.';
  if (!errors.goalAmount && !(s.goalAmount > 0)) errors.goalAmount = 'Goal must be greater than $0.';
  if (!errors.maxRiskPercent && !(s.maxRiskPercent > 0 && s.maxRiskPercent <= MAX_RISK_CEILING)) {
    errors.maxRiskPercent = `Risk ceiling must be above 0% and at most ${MAX_RISK_CEILING}%.`;
  }
  if (!errors.riskPercent && !(s.riskPercent > 0)) errors.riskPercent = 'Risk must be greater than 0%.';
  else if (!errors.riskPercent && !errors.maxRiskPercent && s.riskPercent > s.maxRiskPercent) {
    errors.riskPercent = `Risk is above your ${s.maxRiskPercent}% ceiling.`;
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, settings: s, changed };
}
