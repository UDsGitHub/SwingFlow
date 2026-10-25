import { supabaseAdmin } from '../db/supabase';
import { GoalPeriod } from '../types';
import { Settings } from './settingsRules';

const SETTINGS_SELECT = 'account_size, goal_amount, goal_period, risk_percent, max_risk_percent';
const COLUMNS: Record<keyof Settings, string> = {
  accountSize: 'account_size',
  goalAmount: 'goal_amount',
  goalPeriod: 'goal_period',
  riskPercent: 'risk_percent',
  maxRiskPercent: 'max_risk_percent',
};

export async function loadSettings(userId: string): Promise<Settings> {
  const { data, error } = await supabaseAdmin.from('settings').select(SETTINGS_SELECT).eq('user_id', userId).single();
  if (error || !data) throw new Error(error?.message ?? 'Settings not found');
  return {
    accountSize: Number(data.account_size),
    goalAmount: Number(data.goal_amount),
    goalPeriod: data.goal_period as GoalPeriod,
    riskPercent: Number(data.risk_percent),
    maxRiskPercent: Number(data.max_risk_percent),
  };
}

export async function saveSettings(userId: string, changed: Partial<Settings>): Promise<void> {
  const update = Object.fromEntries(Object.entries(changed).map(([k, v]) => [COLUMNS[k as keyof Settings], v]));
  if (!Object.keys(update).length) return;
  const { error } = await supabaseAdmin.from('settings').update(update).eq('user_id', userId);
  if (error) throw new Error(error.message);
}
