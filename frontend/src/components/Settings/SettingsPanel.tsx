import { useState, useEffect } from 'react';
import { configApi } from '../../services/api';
import { AccountConfig } from '../../types';

export function SettingsPanel() {
  const [config, setConfig] = useState<AccountConfig>({
    accountSize: '5000',
    dailyGoal: '100',
    riskPercent: '1.5',
    dataProvider: 'mock',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    configApi.get().then(setConfig).catch(console.error);
  }, []);

  const handleSave = async () => {
    await configApi.update(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-surface-800 rounded-xl border border-surface-600 p-5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Account Settings</h3>

        <div className="space-y-4">
          <Field
            label="Account Size ($)"
            value={config.accountSize}
            onChange={v => setConfig(c => ({ ...c, accountSize: v }))}
            type="number"
            min="1000"
            hint="Total trading capital"
          />
          <Field
            label="Daily Goal ($)"
            value={config.dailyGoal}
            onChange={v => setConfig(c => ({ ...c, dailyGoal: v }))}
            type="number"
            min="10"
            hint="Target profit per day"
          />
          <Field
            label="Risk Per Trade (%)"
            value={config.riskPercent}
            onChange={v => setConfig(c => ({ ...c, riskPercent: v }))}
            type="number"
            min="0.5"
            max="5"
            step="0.5"
            hint="1–2% recommended for swing trading"
          />
        </div>
      </div>

      <div className="bg-surface-800 rounded-xl border border-surface-600 p-5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Data Provider</h3>

        <div className="space-y-2">
          {(['mock', 'finnhub', 'polygon'] as const).map(provider => (
            <label key={provider} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="provider"
                value={provider}
                checked={config.dataProvider === provider}
                onChange={() => setConfig(c => ({ ...c, dataProvider: provider }))}
                className="text-brand-500"
              />
              <div>
                <div className="text-sm font-medium text-white capitalize">{provider}</div>
                <div className="text-xs text-gray-500">{PROVIDER_DESC[provider]}</div>
              </div>
              {provider === 'mock' && (
                <span className="ml-auto text-xs bg-bull-500/20 text-bull-400 border border-bull-500/30 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              )}
            </label>
          ))}
        </div>

        {config.dataProvider !== 'mock' && (
          <div className="mt-4 bg-warn-500/10 border border-warn-500/20 rounded-lg p-3">
            <p className="text-xs text-warn-400">
              API keys are configured via environment variables in the backend .env file.
              Switching providers requires a server restart.
            </p>
          </div>
        )}
      </div>

      <div className="bg-surface-800 rounded-xl border border-surface-600 p-5">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Position Sizing Preview</h3>
        <SizingPreview
          accountSize={Number(config.accountSize)}
          riskPercent={Number(config.riskPercent)}
          dailyGoal={Number(config.dailyGoal)}
        />
      </div>

      <button
        onClick={handleSave}
        className={`w-full py-3 rounded-xl font-semibold transition-all ${
          saved
            ? 'bg-bull-500 text-white'
            : 'bg-brand-500 hover:bg-brand-600 text-white'
        }`}
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', min, max, step, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; min?: string; max?: string; step?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 font-mono"
      />
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

function SizingPreview({ accountSize, riskPercent, dailyGoal }: {
  accountSize: number; riskPercent: number; dailyGoal: number;
}) {
  const riskDollars = accountSize * (riskPercent / 100);
  const tradesNeeded = Math.ceil(dailyGoal / (riskDollars * 1.5));

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-surface-700 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-500 mb-1">Risk/Trade</div>
        <div className="text-sm font-bold font-mono text-bear-400">${riskDollars.toFixed(0)}</div>
      </div>
      <div className="bg-surface-700 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-500 mb-1">Target/Trade</div>
        <div className="text-sm font-bold font-mono text-bull-400">${(riskDollars * 1.5).toFixed(0)}</div>
      </div>
      <div className="bg-surface-700 rounded-lg p-3 text-center">
        <div className="text-xs text-gray-500 mb-1">Min Trades</div>
        <div className="text-sm font-bold font-mono text-brand-400">{tradesNeeded}</div>
      </div>
    </div>
  );
}

const PROVIDER_DESC: Record<string, string> = {
  mock:     'Deterministic mock data — works offline, no API key needed',
  finnhub:  'Free tier, real market data, set FINNHUB_API_KEY in backend .env',
  polygon:  'Paid tier, full options data, set POLYGON_API_KEY in backend .env',
};
