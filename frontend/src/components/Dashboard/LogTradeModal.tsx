import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, TrendingUp, TrendingDown } from 'lucide-react';
import { gsap } from 'gsap';
import { Trade } from '../../types';
import { tradesApi } from '../../services/api';
import { Button } from '../ui/Button';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { STRATEGY_LABELS } from '../../lib/setupDisplay';

interface LogTradeModalProps {
  open: boolean;
  /** The user's open positions. */
  trades: Trade[];
  /** Preselect this trade (e.g. "Close" clicked on a position row). */
  initialTradeId?: string | null;
  onClose: () => void;
  onRecorded: () => void;
}

const STRATEGY_CHIP = 'text-gray-300 bg-surface-700/80 border border-surface-600';

function computePnl(trade: Trade, exitPrice: number): number {
  return parseFloat(((exitPrice - trade.entryPrice) * trade.shares).toFixed(2));
}

/** Close one of the user's open positions at their actual exit price. */
export function LogTradeModal({ open, trades, initialTradeId, onClose, onRecorded }: LogTradeModalProps) {
  const [selectedId, setSelectedId]   = useState('');
  const [exitPrice, setExitPrice]     = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Reset state each time the modal opens (not on every trade-list refresh).
  useEffect(() => {
    if (open) {
      setSelectedId(initialTradeId ?? (trades.length === 1 ? trades[0].id : ''));
      setExitPrice('');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when opening
  }, [open, initialTradeId]);

  useLayoutEffect(() => {
    if (!open || prefersReducedMotion || !overlayRef.current || !panelRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.fromTo(overlayRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: 'power2.out' })
        .fromTo(panelRef.current, { autoAlpha: 0, y: 12, scale: 0.98 }, {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.3,
          ease: 'power3.out',
          clearProps: 'opacity,transform',
        }, '-=0.08');
    });

    return () => ctx.revert();
  }, [open, prefersReducedMotion]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const selected = trades.find(t => t.id === selectedId) ?? null;
  const priceNum = Number(exitPrice);
  const preview  = selected && exitPrice !== '' && priceNum > 0
    ? computePnl(selected, priceNum)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) { setError('Select a position first.'); return; }
    if (!priceNum || priceNum <= 0) { setError('Enter a valid exit price.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await tradesApi.close(selected.id, priceNum);
      onRecorded();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('409') ? 'This trade is already closed.' : 'Failed to record. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const quickFills = selected
    ? [
        ...(selected.stopPrice != null ? [{ label: `Stop $${selected.stopPrice.toFixed(2)}`, value: selected.stopPrice, tone: 'bear' }] : []),
        { label: `Entry $${selected.entryPrice.toFixed(2)}`, value: selected.entryPrice, tone: 'neutral' },
      ]
    : [];

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={panelRef} role="dialog" aria-label="Close a trade" className="bg-surface-800 rounded-2xl border border-surface-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-700">
          <h2 className="text-sm font-semibold text-gray-200">Close a Trade</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Position selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Position</label>
            {trades.length === 0 ? (
              <p className="text-sm text-gray-400 bg-surface-700 rounded-xl px-4 py-3">
                No open positions. Open a setup and choose “I took this trade” to record one.
              </p>
            ) : (
              <div className="space-y-2">
                {trades.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setSelectedId(t.id); setError(null); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                      selectedId === t.id
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-surface-600 bg-surface-700 hover:border-surface-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {selectedId === t.id ? (
                        <div className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                          <Check size={9} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-surface-500 flex-shrink-0" />
                      )}
                      <div>
                        <span className="font-bold font-mono text-white text-sm">{t.symbol}</span>
                        {t.strategy && (
                          <span className={`ml-2 text-sf-field px-1.5 py-0.5 rounded-md font-medium ${STRATEGY_CHIP}`}>
                            {STRATEGY_LABELS[t.strategy]}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">{t.shares} sh @</div>
                      <div className="text-sm font-mono text-gray-200">${t.entryPrice.toFixed(2)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <>
              <div>
                <label htmlFor="exit-price" className="block text-sm font-medium text-gray-300 mb-1.5">Exit Price</label>
                <div className="flex gap-2 mb-2">
                  {quickFills.map(q => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setExitPrice(q.value.toFixed(2))}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors font-mono ${
                        q.tone === 'bear'
                          ? 'bg-bear-500/10 text-bear-400 border-bear-500/20 hover:bg-bear-500/20'
                          : 'bg-surface-700 text-gray-300 border-surface-600 hover:bg-surface-600'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                <input
                  id="exit-price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={exitPrice}
                  onChange={e => { setExitPrice(e.target.value); setError(null); }}
                  placeholder={`e.g. ${selected.entryPrice.toFixed(2)}`}
                  className="w-full bg-surface-700 border border-surface-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 font-mono transition-colors"
                  autoFocus
                />
              </div>

              {preview !== null && (
                <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  preview >= 0
                    ? 'bg-bull-500/5 border-bull-500/20'
                    : 'bg-bear-500/5 border-bear-500/20'
                }`}>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    {preview >= 0
                      ? <TrendingUp size={14} className="text-bull-400" />
                      : <TrendingDown size={14} className="text-bear-400" />
                    }
                    Realized P&L
                    <span className="text-xs text-gray-500">({selected.shares} shares)</span>
                  </div>
                  <span className={`text-sf-value font-mono ${preview >= 0 ? 'text-data-up' : 'text-data-down'}`}>
                    {preview >= 0 ? '+' : ''}${preview.toFixed(2)}
                  </span>
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm text-bear-400">{error}</p>}

          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !selected || !exitPrice || trades.length === 0}
            >
              {submitting ? 'Recording…' : 'Record Close'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
