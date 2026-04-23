import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { OptionsSuggestion } from '../../types';

interface OptionsPanelProps {
  suggestion: OptionsSuggestion | null;
  symbol: string;
}

export function OptionsPanel({ suggestion, symbol }: OptionsPanelProps) {
  if (!suggestion) {
    return (
      <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Options Suggestion</h4>
        <p className="text-sm text-gray-600 text-center py-6">
          No options data available for this symbol.
        </p>
      </div>
    );
  }

  const expDate = format(new Date(suggestion.expiration), 'MMM d, yyyy');
  const isCall  = suggestion.type === 'CALL';

  return (
    <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
      <div className="flex items-center justify-between mb-5">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Options Suggestion</h4>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
          isCall
            ? 'bg-bull-500/15 text-bull-400'
            : 'bg-bear-500/15 text-bear-400'
        }`}>
          {suggestion.type}
        </span>
      </div>

      <div className="bg-surface-700 rounded-xl p-4 mb-4">
        <div className="text-center mb-4">
          <p className="text-sm font-semibold text-gray-300">
            {symbol} ${suggestion.strike} {suggestion.type}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">Expires {expDate}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Premium</div>
            <div className="text-xl font-bold font-mono text-warn-400">${suggestion.estimatedPremium.toFixed(2)}</div>
            <div className="text-xs text-gray-700">per contract</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">Delta</div>
            <div className="text-xl font-bold font-mono text-brand-400">{suggestion.delta.toFixed(2)}</div>
            <div className="text-xs text-gray-700">sensitivity</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Contracts" value={String(suggestion.contracts)} />
        <Stat label="Total Cost" value={`$${suggestion.totalCost.toFixed(0)}`}  warn />
        <Stat label="Max Gain"   value={`$${suggestion.maxGain.toFixed(0)}`}    highlight />
      </div>

      <div className="flex items-start gap-2.5 bg-warn-500/5 border border-warn-500/15 rounded-xl p-3">
        <AlertTriangle size={13} className="text-warn-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-warn-400 mb-0.5">Options Risk Disclosure</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            Options can expire worthless. Max loss is limited to premium paid (${suggestion.totalCost.toFixed(0)}).
            Verify Greeks and liquidity before trading.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, warn }: {
  label: string; value: string; highlight?: boolean; warn?: boolean;
}) {
  return (
    <div className="bg-surface-700 rounded-xl p-2.5 text-center">
      <div className="text-xs text-gray-600 mb-0.5">{label}</div>
      <div className={`text-sm font-bold font-mono ${warn ? 'text-bear-400' : highlight ? 'text-bull-400' : 'text-gray-200'}`}>
        {value}
      </div>
    </div>
  );
}
