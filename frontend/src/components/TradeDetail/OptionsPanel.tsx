import { useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { OptionsSuggestion } from '../../types';
import { Tooltip } from '../ui/Tooltip';

interface OptionsPanelProps {
  suggestion: OptionsSuggestion | null;
  symbol: string;
  target?: number;
}

export function OptionsPanel({ suggestion, symbol, target }: OptionsPanelProps) {
  if (!suggestion) {
    return (
      <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
        <h4 className="text-xs font-semibold text-gray-400 tracking-wide mb-3">Options Suggestion</h4>
        <p className="text-sm text-gray-400 text-center py-6">
          No options data available for this symbol.
        </p>
      </div>
    );
  }

  const expDate      = format(new Date(suggestion.expiration), 'MMM d, yyyy');
  const availableType = suggestion.type;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [viewType, setViewType] = useState<'CALL' | 'PUT'>(availableType);

  return (
    <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
      {/* Header with CALL/PUT toggle */}
      <div className="flex items-center justify-between mb-5">
        <h4 className="text-xs font-semibold text-gray-400 tracking-wide">Options Suggestion</h4>

        <div className="flex items-center bg-surface-700 rounded-lg p-0.5 gap-0.5">
          {(['CALL', 'PUT'] as const).map(t => {
            const unavailable = t !== availableType;
            const btn = (
              <button
                key={t}
                disabled={unavailable}
                onClick={() => setViewType(t)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                  viewType === t
                    ? t === 'CALL'
                      ? 'bg-bull-500/20 text-bull-400'
                      : 'bg-bear-500/20 text-bear-400'
                    : unavailable
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {t}
              </button>
            );
            return unavailable ? (
              <Tooltip key={t} content="PUT data not available for this setup." width="w-52">
                <span>{btn}</span>
              </Tooltip>
            ) : btn;
          })}
        </div>
      </div>

      <div className="bg-surface-700 rounded-xl p-4 mb-4">
        <div className="text-center mb-4">
          <p className="text-sm font-semibold text-gray-300">
            {symbol} ${suggestion.strike} {suggestion.type}
          </p>
          <p className="text-sm text-gray-400 mt-0.5">Expires {expDate}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Premium */}
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">Premium</div>
            <div className="text-xl font-bold font-mono text-warn-400">${suggestion.estimatedPremium.toFixed(2)}</div>
            <div className="text-xs text-gray-400">per contract</div>
          </div>

          {/* Delta with tooltip */}
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1 flex items-center justify-center gap-1">
              Delta
              <Tooltip
                content="Delta measures how much the option price moves per $1 change in the stock. 0.50 means the option gains ~$0.50 for every $1 the stock rises."
                width="w-64"
              >
                <HelpCircle size={11} className="text-gray-500 cursor-help" />
              </Tooltip>
            </div>
            <div className="text-xl font-bold font-mono text-gray-200">{suggestion.delta.toFixed(2)}</div>
            <div className="text-xs text-gray-400">sensitivity</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Contracts"  value={String(suggestion.contracts)} />
        <Stat label="Total Cost" value={`$${suggestion.totalCost.toFixed(0)}`}  warn />
        <Stat
          label="Max Gain"
          value={`$${suggestion.maxGain.toFixed(0)}`}
          highlight
          tooltip={
            target != null
              ? `Theoretical maximum if the stock reaches the target price ($${target.toFixed(2)}) before expiry. Not a guaranteed outcome.`
              : 'Theoretical maximum gain before expiry. Not a guaranteed outcome.'
          }
        />
      </div>

      <div className="flex items-start gap-2.5 bg-warn-500/5 border border-warn-500/15 rounded-xl p-3">
        <AlertTriangle size={13} className="text-warn-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-warn-400 mb-0.5">Options Risk Disclosure</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Options can expire worthless. Max loss is limited to premium paid (${suggestion.totalCost.toFixed(0)}).
            Verify Greeks and liquidity before trading.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function Stat({ label, value, highlight, warn, tooltip }: {
  label: string; value: string; highlight?: boolean; warn?: boolean; tooltip?: string;
}) {
  const textClass = warn ? 'text-bear-400' : highlight ? 'text-bull-400' : 'text-gray-200';
  return (
    <div className="bg-surface-700 rounded-xl p-2.5 text-center">
      <div className="text-xs text-gray-400 mb-0.5 flex items-center justify-center gap-0.5">
        {label}
        {tooltip && (
          <Tooltip content={tooltip} width="w-60">
            <HelpCircle size={9} className="text-gray-500 cursor-help flex-shrink-0" />
          </Tooltip>
        )}
      </div>
      <div className={`text-sm font-bold font-mono ${textClass}`}>{value}</div>
    </div>
  );
}
