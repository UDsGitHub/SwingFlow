import { useState, useEffect } from 'react';
import { Check, Bell, BellOff, AlertTriangle, HelpCircle } from 'lucide-react';
import { configApi, healthApi } from '../../services/api';
import { AccountConfig } from '../../types';
import { Tooltip } from '../ui/Tooltip';
import {
  getSubscriptionState,
  requestNotificationPermission,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../services/notifications';

// ── Validation helpers ────────────────────────────────────────────

type FieldErrors   = Partial<Record<'accountSize' | 'dailyGoal' | 'riskPercent', string>>;
type FieldWarnings = Partial<Record<'accountSize' | 'dailyGoal' | 'riskPercent', string>>;

function validateAll(config: AccountConfig): { errors: FieldErrors; warnings: FieldWarnings } {
  const errors:   FieldErrors   = {};
  const warnings: FieldWarnings = {};

  const acct = Number(config.accountSize);
  const goal = Number(config.dailyGoal);
  const risk = Number(config.riskPercent);

  if (!config.accountSize || isNaN(acct)) errors.accountSize = 'Please enter a valid number.';
  else if (acct < 100) errors.accountSize = 'Account size must be at least $100.';

  if (!config.dailyGoal || isNaN(goal)) errors.dailyGoal = 'Please enter a valid number.';
  else if (goal <= 0) errors.dailyGoal = 'Daily goal must be greater than $0.';
  else if (!isNaN(acct) && acct > 0 && goal > acct * 0.1)
    warnings.dailyGoal = 'Your daily goal is unusually high relative to your account size.';

  if (!isNaN(risk) && risk > 5)
    warnings.riskPercent = 'High risk — values above 2% are not recommended for swing trading. This may result in significant losses.';

  return { errors, warnings };
}

function validateField(
  field: keyof FieldErrors,
  value: string,
  config: AccountConfig,
  prev: { errors: FieldErrors; warnings: FieldWarnings },
): { errors: FieldErrors; warnings: FieldWarnings } {
  const errors   = { ...prev.errors };
  const warnings = { ...prev.warnings };

  if (field === 'accountSize') {
    const n = Number(value);
    if (!value || isNaN(n)) errors.accountSize = 'Please enter a valid number.';
    else if (n < 100)        errors.accountSize = 'Account size must be at least $100.';
    else                     delete errors.accountSize;
  }

  if (field === 'dailyGoal') {
    const n    = Number(value);
    const acct = Number(config.accountSize);
    if (!value || isNaN(n)) errors.dailyGoal = 'Please enter a valid number.';
    else if (n <= 0)         errors.dailyGoal = 'Daily goal must be greater than $0.';
    else                     delete errors.dailyGoal;

    if (!errors.dailyGoal && !isNaN(acct) && acct > 0 && n > acct * 0.1)
      warnings.dailyGoal = 'Your daily goal is unusually high relative to your account size.';
    else
      delete warnings.dailyGoal;
  }

  if (field === 'riskPercent') {
    const n = Number(value);
    if (!isNaN(n) && n > 5)
      warnings.riskPercent = 'High risk — values above 2% are not recommended for swing trading. This may result in significant losses.';
    else
      delete warnings.riskPercent;
  }

  return { errors, warnings };
}

// ── Main component ────────────────────────────────────────────────

const DEFAULT_CONFIG: AccountConfig = {
  accountSize: '5000', dailyGoal: '100', riskPercent: '1.5', dataProvider: 'mock',
};

export function SettingsPanel() {
  const [config, setConfig]         = useState<AccountConfig>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] = useState<AccountConfig>(DEFAULT_CONFIG);
  const [saving, setSaving]         = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validation, setValidation] = useState<{ errors: FieldErrors; warnings: FieldWarnings }>({ errors: {}, warnings: {} });
  const [providerKeys, setProviderKeys] = useState<{ finnhub: boolean; polygon: boolean } | null>(null);

  useEffect(() => {
    configApi.get()
      .then(c => { setConfig(c); setSavedConfig(c); })
      .catch(console.error);
    healthApi.get()
      .then(d => setProviderKeys(d.keys))
      .catch(() => {});
  }, []);

  const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
  const hasErrors = Object.keys(validation.errors).length > 0;

  // Warn browser on unload when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleBlur = (field: keyof FieldErrors, value: string) => {
    setValidation(prev => validateField(field, value, config, prev));
  };

  const handleSave = async () => {
    const result = validateAll(config);
    setValidation(result);
    if (Object.keys(result.errors).length > 0) return;

    setSaving(true);
    try {
      await configApi.update(config);
      setSavedConfig({ ...config });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setConfig(savedConfig);
    setValidation({ errors: {}, warnings: {} });
  };

  const footerVisible = isDirty || saveSuccess;

  return (
    // pb-24 when footer is visible so content isn't obscured
    <div className={`max-w-7xl mx-auto ${footerVisible ? 'pb-24' : ''}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column: form sections ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Account */}
          <Section title="Account" id="tour-settings-account">
            <ValidatedField
              label="Account Size ($)"
              value={config.accountSize}
              onChange={v => setConfig(c => ({ ...c, accountSize: v }))}
              onBlur={v => handleBlur('accountSize', v)}
              error={validation.errors.accountSize}
              warning={validation.warnings.accountSize}
              hint="Total trading capital"
              min="100" step="100"
            />
            <ValidatedField
              label="Daily Goal ($)"
              value={config.dailyGoal}
              onChange={v => setConfig(c => ({ ...c, dailyGoal: v }))}
              onBlur={v => handleBlur('dailyGoal', v)}
              error={validation.errors.dailyGoal}
              warning={validation.warnings.dailyGoal}
              hint="Target profit per day"
              min="1"
            />
            <ValidatedField
              label="Risk Per Trade (%)"
              value={config.riskPercent}
              onChange={v => setConfig(c => ({ ...c, riskPercent: v }))}
              onBlur={v => handleBlur('riskPercent', v)}
              warning={validation.warnings.riskPercent}
              hint="1–2% recommended for swing trading"
              min="0.1" max="20" step="0.5"
            />
          </Section>

          {/* Data Provider */}
          <Section title="Data Provider" id="tour-settings-provider">
            <div className="space-y-2">
              {(['mock', 'finnhub', 'polygon'] as const).map(provider => {
                const keyMissing = provider !== 'mock'
                  && providerKeys !== null
                  && !providerKeys[provider as 'finnhub' | 'polygon'];
                return (
                  <label
                    key={provider}
                    className={`flex items-center gap-3 ${keyMissing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value={provider}
                      checked={config.dataProvider === provider}
                      onChange={() => { if (!keyMissing) setConfig(c => ({ ...c, dataProvider: provider })); }}
                      disabled={keyMissing}
                      className="text-brand-500 bg-surface-700 border-surface-600"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-200">{PROVIDER_LABEL[provider]}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {keyMissing ? 'API key not configured' : PROVIDER_DESC[provider]}
                      </div>
                    </div>
                    {provider === 'mock' && (
                      <span className="text-xs bg-bull-500/15 text-bull-400 px-2 py-0.5 rounded-md font-medium">
                        Recommended
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {config.dataProvider !== 'mock' && !(providerKeys !== null && !providerKeys[config.dataProvider as 'finnhub' | 'polygon']) && (
              <div className="mt-4 bg-warn-500/5 border border-warn-500/15 rounded-xl p-3">
                <p className="text-xs text-warn-400 leading-relaxed">
                  {PROVIDER_CALLOUT[config.dataProvider]}
                </p>
              </div>
            )}
          </Section>

          {/* Alerts */}
          <Section title="Alerts & Notifications" id="tour-settings-notifications">
            <PushToggle />
          </Section>
        </div>

        {/* ── Right column: sticky live preview ── */}
        <div>
          <div className="sticky top-4 space-y-5" id="tour-settings-sizing">
            <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-gray-400 tracking-wide">
                  Position Sizing
                </p>
                <span className="flex items-center gap-1.5 text-xs text-brand-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse inline-block" />
                  Live preview
                </span>
              </div>
              <SizingPreview
                accountSize={Number(config.accountSize)}
                riskPercent={Number(config.riskPercent)}
                dailyGoal={Number(config.dailyGoal)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky save footer ── */}
      {footerVisible && (
        <div className="sticky bottom-0 -mx-5 md:-mx-8 z-10 bg-surface-900/95 backdrop-blur-sm border-t border-surface-700">
          <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm min-w-0">
              {isDirty && !saveSuccess && (
                <>
                  <span className="w-2 h-2 rounded-full bg-warn-400 flex-shrink-0" />
                  <span className="text-warn-400 truncate">Unsaved changes</span>
                </>
              )}
              {saveSuccess && !isDirty && (
                <>
                  <Check size={14} className="text-bull-400 flex-shrink-0" />
                  <span className="text-bull-400">Saved successfully</span>
                </>
              )}
              {hasErrors && (
                <span className="text-bear-400 text-xs ml-2">Fix errors before saving</span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {isDirty && (
                <button
                  onClick={handleDiscard}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Discard
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || hasErrors || !isDirty}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-all ${
                  saveSuccess && !isDirty
                    ? 'bg-bull-500 text-white'
                    : 'bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

type PushState = 'subscribed' | 'not-subscribed' | 'unsupported' | 'loading';

function PushToggle() {
  const [state, setState] = useState<PushState>('loading');

  useEffect(() => { getSubscriptionState().then(setState); }, []);

  const handleToggle = async () => {
    if (state === 'unsupported' || state === 'loading') return;
    if (state === 'subscribed') {
      const ok = await unsubscribeFromPush();
      if (ok) setState('not-subscribed');
      return;
    }
    const granted = await requestNotificationPermission();
    if (!granted) { setState('not-subscribed'); return; }
    const reg = await registerServiceWorker();
    if (reg) {
      const ok = await subscribeToPush(reg);
      if (ok) setState('subscribed');
    }
  };

  const subscribed = state === 'subscribed';

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          {subscribed
            ? <Bell size={14} className="text-brand-400" />
            : <BellOff size={14} className="text-gray-400" />
          }
          <span className="text-sm font-medium text-gray-200">Enable browser notifications</span>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">
          Get notified when new setups are detected or price targets are hit — even when the tab is in the background.
        </p>
        {state === 'unsupported' && (
          <p className="text-xs text-warn-400 mt-1.5">Push notifications are not supported in this browser.</p>
        )}
      </div>
      <button
        onClick={handleToggle}
        disabled={state === 'unsupported' || state === 'loading'}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
          subscribed ? 'bg-brand-500' : 'bg-surface-600'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        role="switch"
        aria-checked={subscribed}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          subscribed ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
      <p className="text-xs font-semibold text-gray-400 tracking-wide mb-4">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ValidatedField({ label, value, onChange, onBlur, error, warning, hint, min, max, step }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  error?: string;
  warning?: string;
  hint?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  const borderClass = error
    ? 'border-bear-500 focus:border-bear-400'
    : warning
    ? 'border-warn-500/60 focus:border-warn-500'
    : 'border-surface-600 focus:border-brand-500';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onBlur?.(e.target.value)}
        className={`w-full bg-surface-700 border rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none font-mono transition-colors ${borderClass}`}
      />
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-bear-400 mt-1.5">
          <AlertTriangle size={11} className="flex-shrink-0" />
          {error}
        </p>
      )}
      {!error && warning && (
        <p className="flex items-center gap-1.5 text-xs text-warn-400 mt-1.5">
          <AlertTriangle size={11} className="flex-shrink-0" />
          {warning}
        </p>
      )}
      {!error && !warning && hint && (
        <p className="text-xs text-gray-400 mt-1.5">{hint}</p>
      )}
    </div>
  );
}

function SizingPreview({ accountSize, riskPercent, dailyGoal }: {
  accountSize: number; riskPercent: number; dailyGoal: number;
}) {
  const riskDollars  = accountSize * (riskPercent / 100);
  const targetTrade  = riskDollars * 1.5;
  const tradesNeeded = riskDollars > 0 ? Math.ceil(dailyGoal / targetTrade) : 0;

  const valid = accountSize > 0 && riskPercent > 0 && dailyGoal > 0;

  return (
    <div className="grid grid-cols-1 gap-3">
      <SizingStat
        label="Risk / Trade"
        value={valid ? `$${riskDollars.toFixed(0)}` : '—'}
        color="text-bear-400"
        tooltip={`Account Size × Risk % ÷ 100\n$${accountSize.toLocaleString()} × ${riskPercent}% = $${riskDollars.toFixed(0)}`}
      />
      <SizingStat
        label="Target / Trade"
        value={valid ? `$${targetTrade.toFixed(0)}` : '—'}
        color="text-bull-400"
        tooltip={`Risk/Trade × 1.5 — assumes a 1.5:1 reward/risk ratio per trade.\n$${riskDollars.toFixed(0)} × 1.5 = $${targetTrade.toFixed(0)}`}
      />
      <SizingStat
        label="Min Trades"
        value={valid ? String(tradesNeeded) : '—'}
        color="text-brand-400"
        tooltip={`Daily Goal ÷ Target/Trade, rounded up.\n$${dailyGoal} ÷ $${targetTrade.toFixed(0)} = ${tradesNeeded} trade${tradesNeeded !== 1 ? 's' : ''}`}
      />
    </div>
  );
}

function SizingStat({ label, value, color, tooltip }: {
  label: string; value: string; color: string; tooltip?: string;
}) {
  return (
    <div className="bg-surface-700 rounded-xl p-3 flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-sm text-gray-400">
        {tooltip ? (
          <Tooltip content={tooltip} width="w-60">
            <span className="flex items-center gap-1 cursor-help">
              {label}
              <HelpCircle size={11} className="text-gray-500" />
            </span>
          </Tooltip>
        ) : label}
      </div>
      <div className={`text-sm font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

const PROVIDER_LABEL: Record<string, string> = {
  mock:    'Mock',
  finnhub: 'Finnhub',
  polygon: 'Polygon',
};

const PROVIDER_DESC: Record<string, string> = {
  mock:    'Deterministic mock data — works offline, no API key needed',
  finnhub: 'Free tier, real data — set FINNHUB_API_KEY in backend .env',
  polygon: 'Paid tier, full options data — set POLYGON_API_KEY in backend .env',
};

const PROVIDER_CALLOUT: Record<string, string> = {
  finnhub: 'Requires FINNHUB_API_KEY set in your backend .env file. Without it, data will fall back to Mock.',
  polygon: 'Requires POLYGON_API_KEY set in your backend .env file. This is a paid tier.',
};
