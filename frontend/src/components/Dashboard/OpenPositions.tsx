import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpCircle } from 'lucide-react';
import { Trade } from '../../types';
import { tradesApi } from '../../services/api';
import { Button } from '../ui/Button';
import { SectionLabel } from '../ui/SectionLabel';
import { STRATEGY_LABELS, shouldRaiseStop } from '../../lib/setupDisplay';

interface OpenPositionsProps {
  trades: Trade[];
  onCloseTrade: (tradeId: string) => void;
  onChanged: () => void;
}

/** Positions the user actually holds, with the trailing-stop suggestion SwingFlow tracks for each. */
export function OpenPositions({ trades, onCloseTrade, onChanged }: OpenPositionsProps) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState<string | null>(null);

  if (trades.length === 0) return null;

  const confirmStopMoved = async (trade: Trade) => {
    if (trade.suggestedStop == null) return;
    setSaving(trade.id);
    try {
      await tradesApi.update(trade.id, { stopPrice: trade.suggestedStop });
      onChanged();
    } finally {
      setSaving(null);
    }
  };

  return (
    <section id="open-positions" aria-label="Open positions" className="space-y-2">
      <SectionLabel>Open Positions</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {trades.map(t => {
          const raise = shouldRaiseStop(t);
          return (
            <div key={t.id} data-testid="open-position" className="rounded-2xl border border-surface-700 bg-surface-800 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => t.setupId && navigate(`/setup/${t.setupId}`, { state: { from: 'dashboard' } })}
                  className="text-left"
                >
                  <span className="font-mono font-bold text-white text-sf-value">{t.symbol}</span>
                  {t.strategy && <span className="ml-2 text-sf-field text-gray-400">{STRATEGY_LABELS[t.strategy]}</span>}
                  <div className="text-sf-field text-gray-500 mt-0.5 font-mono">
                    {t.shares} sh @ ${t.entryPrice.toFixed(2)}
                  </div>
                </button>
                <Button type="button" variant="secondary" onClick={() => onCloseTrade(t.id)} className="text-sf-label">
                  Close
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sf-field">
                <div className="rounded-xl bg-surface-700 p-2">
                  <div className="text-gray-500">Your stop</div>
                  <div className="font-mono text-data-down">{t.stopPrice != null ? `$${t.stopPrice.toFixed(2)}` : '—'}</div>
                </div>
                <div className="rounded-xl bg-surface-700 p-2">
                  <div className="text-gray-500">Trailing stop</div>
                  <div className="font-mono text-gray-200">{t.suggestedStop != null ? `$${t.suggestedStop.toFixed(2)}` : '—'}</div>
                </div>
              </div>

              {raise && t.suggestedStop != null && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-500/40 bg-brand-500/10 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-sf-field text-brand-300">
                    <ArrowUpCircle size={13} /> Raise stop to ${t.suggestedStop.toFixed(2)} at your broker
                  </span>
                  <Button type="button" variant="ghost" disabled={saving === t.id} onClick={() => confirmStopMoved(t)} className="text-sf-field">
                    {saving === t.id ? 'Saving…' : 'I moved it'}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
