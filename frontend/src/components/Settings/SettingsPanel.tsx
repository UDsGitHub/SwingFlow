import { useState, useEffect } from 'react';
import { Check, PlayCircle } from 'lucide-react';
import { configApi } from '../../services/api';
import { AccountConfig } from '../../types';
import { useAppContext } from '../../context/AppContext';

export function SettingsPanel() {
  const { startTour } = useAppContext();
  const [config, setConfig] = useState<AccountConfig>({
    accountSize: '5000',
    dailyGoal:   '100',
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
    <div className="max-w-lg mx-auto space-y-5">
      {/* Account */}
      <Section title="Account">
        <Field
          label="Account Size ($)"
          value={config.accountSize}
          onChange={v => setConfig(c => ({ ...c, accountSize: v }))}
          type="number" min="1000"
          hint="Total trading capital"
        />
        <Field
          label="Daily Goal ($)"
          value={config.dailyGoal}
          onChange={v => setConfig(c => ({ ...c, dailyGoal: v }))}
          type="number" min="10"
          hint="Target profit per day"
        />
        <Field
          label="Risk Per Trade (%)"
          value={config.riskPercent}
          onChange={v => setConfig(c => ({ ...c, riskPercent: v }))}
          type="number" min="0.5" max="5" step="0.5"
          hint="1–2% recommended for swing trading"
        />
      </Section>

      {/* Data provider */}
      <Section title="Data Provider">
        <div className="space-y-2">
          {(['mock', 'finnhub', 'polygon'] as const).map(provider => (
            <label key={provider} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="provider"
                value={provider}
                checked={config.dataProvider === provider}
                onChange={() => setConfig(c => ({ ...c, dataProvider: provider }))}
                className="text-brand-500 bg-surface-700 border-surface-600"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-200 capitalize">{provider}</div>
                <div className="text-xs text-gray-600 mt-0.5">{PROVIDER_DESC[provider]}</div>
              </div>
              {provider === 'mock' && (
                <span className="text-xs bg-bull-500/15 text-bull-400 px-2 py-0.5 rounded-md font-medium">
                  Recommended
                </span>
              )}
            </label>
          ))}
        </div>

        {config.dataProvider !== 'mock' && (
          <div className="mt-4 bg-warn-500/5 border border-warn-500/15 rounded-xl p-3">
            <p className="text-xs text-warn-400 leading-relaxed">
              API keys are configured via environment variables in the backend .env file.
              Switching providers requires a server restart.
            </p>
          </div>
        )}
      </Section>

      {/* Sizing preview */}
      <Section title="Position Sizing Preview">
        <SizingPreview
          accountSize={Number(config.accountSize)}
          riskPercent={Number(config.riskPercent)}
          dailyGoal={Number(config.dailyGoal)}
        />
      </Section>

      <button
        onClick={handleSave}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
          saved
            ? 'bg-bull-500 text-white'
            : 'bg-brand-500 hover:bg-brand-600 text-white'
        }`}
      >
        {saved ? <><Check size={15} /> Saved</> : 'Save Settings'}
      </button>

      <button
        onClick={startTour}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-300 hover:bg-surface-800 border border-surface-700 transition-colors"
      >
        <PlayCircle size={15} />
        Replay product tour
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', min, max, step, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; min?: string; max?: string; step?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        min={min} max={max} step={step}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-surface-700 border border-surface-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 font-mono transition-colors"
      />
      {hint && <p className="text-xs text-gray-600 mt-1.5">{hint}</p>}
    </div>
  );
}

function SizingPreview({ accountSize, riskPercent, dailyGoal }: {
  accountSize: number; riskPercent: number; dailyGoal: number;
}) {
  const riskDollars   = accountSize * (riskPercent / 100);
  const tradesNeeded  = Math.ceil(dailyGoal / (riskDollars * 1.5));

  return (
    <div className="grid grid-cols-3 gap-3">
      <SizingStat label="Risk/Trade"   value={`$${riskDollars.toFixed(0)}`}          color="text-bear-400" />
      <SizingStat label="Target/Trade" value={`$${(riskDollars * 1.5).toFixed(0)}`} color="text-bull-400" />
      <SizingStat label="Min Trades"   value={String(tradesNeeded)}                  color="text-brand-400" />
    </div>
  );
}

function SizingStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-700 rounded-xl p-3 text-center">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className={`text-sm font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

const PROVIDER_DESC: Record<string, string> = {
  mock:    'Deterministic mock data — works offline, no API key needed',
  finnhub: 'Free tier, real data — set FINNHUB_API_KEY in backend .env',
  polygon: 'Paid tier, full options data — set POLYGON_API_KEY in backend .env',
};
