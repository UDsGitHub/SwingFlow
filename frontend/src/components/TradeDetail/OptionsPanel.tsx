import { OptionsSuggestion } from '../../types';
import { format } from 'date-fns';

interface OptionsPanelProps {
  suggestion: OptionsSuggestion | null;
  symbol: string;
}

export function OptionsPanel({ suggestion, symbol }: OptionsPanelProps) {
  if (!suggestion) {
    return (
      <div className="bg-surface-800 rounded-xl border border-surface-600 p-4">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Options Suggestion</h4>
        <p className="text-sm text-gray-500 text-center py-4">
          No options data available for this symbol.
        </p>
      </div>
    );
  }

  const expDate = format(new Date(suggestion.expiration), 'MMM d, yyyy');
  const isCall = suggestion.type === 'CALL';

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-600 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Options Suggestion</h4>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCall ? 'bg-bull-500/20 text-bull-400 border border-bull-500/30' : 'bg-bear-500/20 text-bear-400 border border-bear-500/30'}`}>
          {suggestion.type}
        </span>
      </div>

      {/* Main suggestion */}
      <div className="bg-surface-700 rounded-lg p-4 mb-4">
        <div className="text-center mb-3">
          <div className="text-sm text-gray-400">
            {symbol} ${suggestion.strike} {suggestion.type}
          </div>
          <div className="text-xs text-gray-500">Expires {expDate}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-0.5">Premium</div>
            <div className="text-lg font-bold font-mono text-warn-400">${suggestion.estimatedPremium.toFixed(2)}</div>
            <div className="text-xs text-gray-600">per contract</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-0.5">Delta</div>
            <div className="text-lg font-bold font-mono text-brand-400">{suggestion.delta.toFixed(2)}</div>
            <div className="text-xs text-gray-600">sensitivity</div>
          </div>
        </div>
      </div>

      {/* Position details */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Contracts" value={String(suggestion.contracts)} />
        <Stat label="Total Cost" value={`$${suggestion.totalCost.toFixed(0)}`} warn />
        <Stat label="Max Gain" value={`$${suggestion.maxGain.toFixed(0)}`} highlight />
      </div>

      {/* Educational note */}
      <div className="bg-warn-500/5 border border-warn-500/20 rounded-lg p-3">
        <p className="text-xs text-warn-400 font-semibold mb-1">⚠ Options Risk Disclosure</p>
        <p className="text-xs text-gray-500">
          Options can expire worthless. Maximum loss is limited to premium paid (${suggestion.totalCost.toFixed(0)}).
          Suggested strike is ATM/slightly ITM for higher probability. Always verify Greeks and liquidity before trading.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="bg-surface-700 rounded-lg p-2.5 text-center">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-sm font-bold font-mono ${warn ? 'text-bear-400' : highlight ? 'text-bull-400' : 'text-gray-200'}`}>
        {value}
      </div>
    </div>
  );
}
