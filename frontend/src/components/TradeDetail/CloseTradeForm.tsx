import { useState } from 'react';
import { CheckCircle, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TradeSetup } from '../../types';
import { setupsApi } from '../../services/api';
import { format } from 'date-fns';
import { SectionLabel } from '../ui/SectionLabel';
import { Button } from '../ui/Button';

interface CloseTradeFormProps {
  setup: TradeSetup;
  onClosed: () => void;
}

type Toast = { type: 'success' | 'error'; message: string };

export function CloseTradeForm({ setup, onClosed }: CloseTradeFormProps) {
  const navigate = useNavigate();
  const [exitPrice, setExitPrice]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [toast, setToast]           = useState<Toast | null>(null);

  if (setup.status === 'COMPLETED' && setup.realizedPnl != null) {
    return <OutcomePanel setup={setup} />;
  }

  if (setup.status === 'EXPIRED') {
    return null;
  }

  const exitNum = exitPrice !== '' ? Number(exitPrice) : NaN;
  const preview = !isNaN(exitNum) && exitNum > 0
    ? computePnl(setup, exitNum)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(exitPrice);
    if (!price || price <= 0) { setError('Enter a valid exit price'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await setupsApi.close(setup.id, price);
      onClosed();
      setToast({ type: 'success', message: 'Trade closed · P&L added to history.' });
      setTimeout(() => navigate('/history'), 2000);
    } catch {
      setToast({ type: 'error', message: 'Failed to record close. Please try again.' });
      setError('Failed to record close. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-2xl text-sf-body font-medium border ${
            toast.type === 'success'
              ? 'bg-surface-800 border-bull-500/30 text-data-up'
              : 'bg-surface-800 border-bear-500/30 text-data-down'
          }`}
        >
          {toast.type === 'success'
            ? <CheckCircle size={14} />
            : <AlertCircle size={14} />
          }
          {toast.message}
        </div>
      )}

      <div id="tour-close-trade" className="bg-surface-800 rounded-2xl border border-surface-700 p-5">
        <SectionLabel as="h3">Close Trade</SectionLabel>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sf-label text-gray-400 mb-1.5">
              Exit Price
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={exitPrice}
              onChange={e => { setExitPrice(e.target.value); setError(null); }}
              placeholder={`e.g. ${setup.target.toFixed(2)}`}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2.5 text-white text-sf-body focus:outline-none focus:border-brand-500 font-mono transition-colors"
            />
            {error && <p className="text-sf-field text-data-down mt-1.5">{error}</p>}
          </div>

          {preview !== null && (
            <div
              className={`rounded-lg border p-3 flex items-center justify-between ${
                preview >= 0
                  ? 'bg-bull-500/5 border-bull-500/20'
                  : 'bg-bear-500/5 border-bear-500/20'
              }`}
            >
              <span className="text-sf-body text-gray-400">Estimated P&L</span>
              <span className={`text-sf-value font-mono flex items-center gap-2 ${
                preview >= 0 ? 'text-data-up' : 'text-data-down'
              }`}>
                {preview >= 0 ? '+' : ''}${Math.abs(preview).toFixed(2)}
                <span
                  className={`text-sf-field font-semibold px-1.5 py-0.5 rounded-md ${
                    preview >= 0
                      ? 'bg-bull-500/15 text-data-up'
                      : 'bg-bear-500/15 text-data-down'
                  }`}
                >
                  {preview >= 0 ? 'Win' : 'Loss'}
                </span>
              </span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={submitting || exitPrice === '' || isNaN(exitNum) || exitNum <= 0}
          >
            {submitting ? 'Recording…' : 'Record Close'}
          </Button>
        </form>

        <p className="text-sf-field text-gray-500 mt-3 leading-relaxed">
          Recording a close marks this setup as completed and adds the P&L to today&apos;s goal tracker.
        </p>
      </div>
    </>
  );
}

function OutcomePanel({ setup }: { setup: TradeSetup }) {
  const pnl   = setup.realizedPnl!;
  const isWin = pnl >= 0;
  const Icon  = isWin ? TrendingUp : TrendingDown;

  return (
    <div className={`bg-surface-800 rounded-2xl border p-5 ${isWin ? 'border-bull-500/30' : 'border-bear-500/30'}`}>
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle size={15} className={isWin ? 'text-data-up' : 'text-data-down'} />
        <SectionLabel as="h3" noMargin className="mb-0">Trade Closed</SectionLabel>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-700 rounded-xl p-3">
          <div className="text-sf-field text-gray-500 mb-1">Exit Price</div>
          <div className="text-sf-value font-mono text-gray-100">${setup.exitPrice!.toFixed(2)}</div>
        </div>
        <div className={`rounded-xl p-3 ${isWin ? 'bg-bull-500/10' : 'bg-bear-500/10'}`}>
          <div className="text-sf-field text-gray-500 mb-1">Realized P&L</div>
          <div className={`text-sf-value font-mono flex items-center gap-1 ${isWin ? 'text-data-up' : 'text-data-down'}`}>
            <Icon size={13} />
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </div>
        </div>
      </div>

      {setup.closedAt && (
        <p className="text-sf-field text-gray-500 mt-3">
          Closed {format(new Date(setup.closedAt), 'MMM d, yyyy h:mm a')}
        </p>
      )}
    </div>
  );
}

function computePnl(setup: TradeSetup, exitPrice: number): number {
  const shares = setup.stockSuggestion?.shares ?? 1;
  const diff   = setup.direction === 'LONG'
    ? exitPrice - setup.entry
    : setup.entry - exitPrice;
  return parseFloat((diff * shares).toFixed(2));
}
