import { useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { OptionsSuggestion } from '../../types';
import { Tooltip } from '../ui/Tooltip';
import { SectionLabel } from '../ui/SectionLabel';

interface OptionsPanelProps {
  suggestion: OptionsSuggestion | null;
  symbol: string;
  target?: number;
}

export function OptionsPanel({ suggestion, symbol, target }: OptionsPanelProps) {
  if (!suggestion) {
    return (
      <div className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
        <SectionLabel as="h3">Options Suggestion</SectionLabel>
        <p className="text-sf-body text-center py-6 text-gray-400">
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
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <SectionLabel as="h3" noMargin className="mb-0">
          Options Suggestion
        </SectionLabel>

        <div className="flex items-center bg-surface-700 rounded-lg p-0.5 gap-0.5">
          {(['CALL', 'PUT'] as const).map(t => {
            const unavailable = t !== availableType;
            const btn = (
              <button
                key={t}
                type="button"
                disabled={unavailable}
                onClick={() => setViewType(t)}
                className={`px-2.5 py-1 rounded-md text-sf-field font-bold transition-colors ${
                  viewType === t
                    ? t === 'CALL'
                      ? 'bg-bull-500/20 text-data-up'
                      : 'bg-bear-500/20 text-data-down'
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
          <p className="text-sf-body font-semibold text-gray-200">
            {symbol} ${suggestion.strike} {suggestion.type}
          </p>
          <p className="text-sf-body text-gray-400 mt-0.5">Expires {expDate}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-sf-body text-gray-400 mb-1">Premium</div>
            <div className="text-sf-value-lg font-mono text-gray-100">${suggestion.estimatedPremium.toFixed(2)}</div>
            <div className="text-sf-field text-gray-500">per contract</div>
          </div>

          <div className="text-center">
            <div className="text-sf-body text-gray-400 mb-1 flex items-center justify-center gap-1">
              Delta
              <Tooltip
                content="Delta measures how much the option price moves per $1 change in the stock. 0.50 means the option gains ~$0.50 for every $1 the stock rises."
                width="w-64"
              >
                <HelpCircle size={11} className="text-gray-500 cursor-help" />
              </Tooltip>
            </div>
            <div className="text-sf-value-lg font-mono text-data-neutral">{suggestion.delta.toFixed(2)}</div>
            <div className="text-sf-field text-gray-500">sensitivity</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Contracts"  value={String(suggestion.contracts)} valueClass="text-gray-100" />
        <Stat label="Total Cost" value={`$${suggestion.totalCost.toFixed(0)}`}  valueClass="text-data-down" />
        <Stat
          label="Max Gain"
          value={`$${suggestion.maxGain.toFixed(0)}`}
          valueClass="text-data-up"
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
          <p className="text-sf-label font-semibold text-warn-400 mb-0.5">Options Risk Disclosure</p>
          <p className="text-sf-field text-gray-400 leading-relaxed">
            Options can expire worthless. Max loss is limited to premium paid (${suggestion.totalCost.toFixed(0)}).
            Verify Greeks and liquidity before trading.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass, tooltip }: {
  label: string; value: string; valueClass: string; tooltip?: string;
}) {
  return (
    <div className="bg-surface-700 rounded-xl p-2.5 text-center">
      <div className="text-sf-field text-gray-500 mb-0.5 flex items-center justify-center gap-0.5">
        {label}
        {tooltip && (
          <Tooltip content={tooltip} width="w-60">
            <HelpCircle size={9} className="text-gray-500 cursor-help flex-shrink-0" />
          </Tooltip>
        )}
      </div>
      <div className={`text-sf-value font-mono ${valueClass}`}>{value}</div>
    </div>
  );
}
