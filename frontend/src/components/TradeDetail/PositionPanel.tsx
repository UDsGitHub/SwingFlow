import { useState } from 'react';
import { TradeSetup } from '../../types';
import { setupsApi, tradesApi } from '../../services/api';
import { useClosedTrades, useOpenTrades } from '../../hooks/useTrades';
import { SectionLabel } from '../ui/SectionLabel';
import { Button } from '../ui/Button';
import { formatMoney, shouldRaiseStop } from '../../lib/setupDisplay';

interface PositionPanelProps {
  setup: TradeSetup;
  onChanged: () => void;
}

const INPUT = 'w-full bg-surface-700 border border-surface-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 font-mono transition-colors';

/** The user's real position on this setup: record taking it, then close it. */
export function PositionPanel({ setup, onChanged }: PositionPanelProps) {
  const { openTrades } = useOpenTrades();
  const { closedTrades } = useClosedTrades();
  const open = openTrades.find(t => t.setupId === setup.id) ?? null;
  const closed = closedTrades.filter(t => t.setupId === setup.id);

  const [fillPrice, setFillPrice] = useState(String(setup.paperFillPrice?.toFixed(2) ?? setup.entry.toFixed(2)));
  const [shares, setShares]       = useState(String(setup.stockSuggestion?.shares || ''));
  const [exitPrice, setExitPrice] = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('409') ? 'That was already recorded.' : 'Could not save. Check the values and try again.');
    } finally {
      setBusy(false);
    }
  };

  const take = (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(fillPrice);
    const qty = Number(shares);
    if (!(price > 0)) return setError('Enter the price you were filled at.');
    if (!Number.isInteger(qty) || qty <= 0) return setError('Enter a whole number of shares.');
    void run(() => setupsApi.take(setup.id, { fillPrice: price, shares: qty }));
  };

  const close = (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(exitPrice);
    if (!open) return;
    if (!(price > 0)) return setError('Enter your exit price.');
    void run(async () => { await tradesApi.close(open.id, price); setExitPrice(''); });
  };

  return (
    <div id="your-position" className="bg-surface-800 rounded-2xl border border-surface-700 p-5 space-y-4">
      <SectionLabel as="h3" noMargin>Your Position</SectionLabel>

      {open ? (
        <form onSubmit={close} className="space-y-3">
          <p className="text-sf-body text-gray-300 font-mono" data-testid="position-summary">
            {open.shares} sh @ ${open.entryPrice.toFixed(2)} · your stop {open.stopPrice != null ? `$${open.stopPrice.toFixed(2)}` : '—'}
          </p>
          {shouldRaiseStop(open) && (
            <p className="text-sf-field text-brand-300">
              The trailing stop is now ${open.suggestedStop!.toFixed(2)} — raise your stop at your broker.
            </p>
          )}
          <div>
            <label htmlFor="position-exit" className="block text-sm font-medium text-gray-300 mb-1.5">Exit price</label>
            <input id="position-exit" type="number" step="0.01" min="0.01" value={exitPrice} onChange={e => setExitPrice(e.target.value)} className={INPUT} />
          </div>
          <Button type="submit" variant="primary" disabled={busy || !exitPrice}>
            {busy ? 'Recording…' : 'Close my trade'}
          </Button>
        </form>
      ) : (
        <form onSubmit={take} className="space-y-3">
          <p className="text-sf-field text-gray-500">
            Bought it? Record your actual fill so your P&L and goal use real numbers.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="take-fill" className="block text-sm font-medium text-gray-300 mb-1.5">Fill price</label>
              <input id="take-fill" type="number" step="0.01" min="0.01" value={fillPrice} onChange={e => setFillPrice(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label htmlFor="take-shares" className="block text-sm font-medium text-gray-300 mb-1.5">Shares</label>
              <input id="take-shares" type="number" step="1" min="1" value={shares} onChange={e => setShares(e.target.value)} className={INPUT} />
            </div>
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving…' : 'I took this trade'}
          </Button>
        </form>
      )}

      {error && <p className="text-sm text-bear-400">{error}</p>}

      {closed.length > 0 && (
        <ul className="space-y-1 border-t border-surface-700 pt-3">
          {closed.map(t => (
            <li key={t.id} className="flex justify-between text-sf-field font-mono">
              <span className="text-gray-400">
                {t.shares} sh ${t.entryPrice.toFixed(2)} → ${t.exitPrice?.toFixed(2)}
              </span>
              <span className={(t.realizedPnl ?? 0) >= 0 ? 'text-data-up' : 'text-data-down'}>
                {formatMoney(t.realizedPnl ?? 0, true)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
