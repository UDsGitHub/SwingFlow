import { AccountConfig, GoalPeriod, GoalVerdict, TradeSetup } from '../types';

export const PERIOD_NOUN: Record<GoalPeriod, string> = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' };
export const PERIOD_ADJECTIVE: Record<GoalPeriod, string> = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' };
export const PERIOD_CURRENT: Record<GoalPeriod, string> = { DAILY: 'Today', WEEKLY: 'This week', MONTHLY: 'This month' };

export const VERDICT_LABELS: Record<GoalVerdict, string> = {
  REALISTIC: 'Realistic',
  STRETCH: 'Stretch',
  UNREALISTIC: 'Unrealistic',
};

export const VERDICT_CLASSES: Record<GoalVerdict, string> = {
  REALISTIC: 'text-data-up bg-bull-500/10 border-bull-500/25',
  STRETCH: 'text-warn-400 bg-warn-500/10 border-warn-500/25',
  UNREALISTIC: 'text-data-down bg-bear-500/10 border-bear-500/25',
};

/** Whole dollars with thousands separators; cents only below $10. */
export function money(n: number): string {
  const abs = Math.abs(n);
  const s = abs < 10 && abs % 1 !== 0 ? abs.toFixed(2) : Math.round(abs).toLocaleString('en-US');
  return `${n < 0 ? '−' : ''}$${s}`;
}

/** Highest expected value first (unmeasured strategies last), then score — the backtest's order. */
export function byExpectedValue(a: Pick<TradeSetup, 'expectedValue' | 'score'>, b: Pick<TradeSetup, 'expectedValue' | 'score'>): number {
  return (b.expectedValue ?? -Infinity) - (a.expectedValue ?? -Infinity) || b.score - a.score;
}

export type SettingsField = 'accountSize' | 'goalAmount' | 'goalPeriod' | 'riskPercent' | 'maxRiskPercent';
export type FieldMessages = Partial<Record<SettingsField, string>>;

/** Hard limit on the user's own risk ceiling (mirrors the backend). */
export const MAX_RISK_CEILING = 10;

/** Client-side mirror of the backend's settings rules, plus soft warnings. */
export function validateSettings(config: AccountConfig): { errors: FieldMessages; warnings: FieldMessages } {
  const errors: FieldMessages = {};
  const warnings: FieldMessages = {};
  const num = (v: string) => (v.trim() === '' ? NaN : Number(v));
  const acct = num(config.accountSize);
  const goal = num(config.goalAmount);
  const risk = num(config.riskPercent);
  const ceiling = num(config.maxRiskPercent);

  if (isNaN(acct)) errors.accountSize = 'Please enter a valid number.';
  else if (acct < 100) errors.accountSize = 'Account size must be at least $100.';

  if (isNaN(goal)) errors.goalAmount = 'Please enter a valid number.';
  else if (goal <= 0) errors.goalAmount = 'Goal must be greater than $0.';

  if (isNaN(ceiling)) errors.maxRiskPercent = 'Please enter a valid number.';
  else if (ceiling <= 0 || ceiling > MAX_RISK_CEILING) errors.maxRiskPercent = `Ceiling must be above 0% and at most ${MAX_RISK_CEILING}%.`;
  else if (ceiling > 2) warnings.maxRiskPercent = 'A ceiling above 2% allows large losses on a single trade.';

  if (isNaN(risk)) errors.riskPercent = 'Please enter a valid number.';
  else if (risk <= 0) errors.riskPercent = 'Risk must be greater than 0%.';
  else if (!errors.maxRiskPercent && risk > ceiling) errors.riskPercent = `Above your ${ceiling}% ceiling. Raise the ceiling first if you mean it.`;

  return { errors, warnings };
}
