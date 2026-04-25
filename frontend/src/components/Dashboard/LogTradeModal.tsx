import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, TrendingUp, TrendingDown } from 'lucide-react';
import { gsap } from 'gsap';
import { TradeSetup } from '../../types';
import { setupsApi } from '../../services/api';
import { Button } from '../ui/Button';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface LogTradeModalProps {
  open: boolean;
  setups: TradeSetup[];
  onClose: () => void;
  onRecorded: () => void;
}

const STRATEGY_LABELS: Record<string, string> = {
  TREND_PULLBACK: 'Trend Pullback',
  BREAKOUT:       'Breakout',
  REVERSAL:       'Reversal',
};

const STRATEGY_CHIP = 'text-gray-300 bg-surface-700/80 border border-surface-600';

function computePnl(setup: TradeSetup, exitPrice: number): number {
  const shares = setup.stockSuggestion?.shares ?? 1;
  const diff = setup.direction === 'LONG'
    ? exitPrice - setup.entry
    : setup.entry - exitPrice;
  return parseFloat((diff * shares).toFixed(2));
}

export function LogTradeModal({ open, setups, onClose, onRecorded }: LogTradeModalProps) {
  const [selectedId, setSelectedId]   = useState('');
  const [exitPrice, setExitPrice]     = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Reset state each time the modal opens
  useEffect(() => {
    if (open) {
      setSelectedId(setups.length === 1 ? setups[0].id : '');
      setExitPrice('');
      setError(null);
    }
  }, [open, setups]);

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

  const selected = setups.find(s => s.id === selectedId) ?? null;
  const priceNum = Number(exitPrice);
  const preview  = selected && exitPrice !== '' && priceNum > 0
    ? computePnl(selected, priceNum)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) { setError('Select a setup first.'); return; }
    if (!priceNum || priceNum <= 0) { setError('Enter a valid exit price.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      await setupsApi.close(selected.id, priceNum);
      onRecorded();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes('409') || msg.includes('Already') ? 'This trade is already closed.' : 'Failed to record. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={panelRef} className="bg-surface-800 rounded-2xl border border-surface-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-700">
          <h2 className="text-sm font-semibold text-gray-200">Log Trade Outcome</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Setup selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Setup</label>
            {setups.length === 0 ? (
              <p className="text-sm text-gray-400 bg-surface-700 rounded-xl px-4 py-3">
                No active setups. Run a scan first to generate setups you can log against.
              </p>
            ) : (
              <div className="space-y-2">
                {setups.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedId(s.id); setError(null); }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                      selectedId === s.id
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-surface-600 bg-surface-700 hover:border-surface-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {selectedId === s.id && (
                        <div className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                          <Check size={9} className="text-white" />
                        </div>
                      )}
                      {selectedId !== s.id && (
                        <div className="w-4 h-4 rounded-full border border-surface-500 flex-shrink-0" />
                      )}
                      <div>
                        <span className="font-bold font-mono text-white text-sm">{s.symbol}</span>
                        <span className={`ml-2 text-sf-field px-1.5 py-0.5 rounded-md font-medium ${STRATEGY_CHIP}`}>
                          {STRATEGY_LABELS[s.strategy]}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Entry</div>
                      <div className="text-sm font-mono text-gray-200">${s.entry.toFixed(2)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Exit price — only shown once a setup is selected */}
          {selected && (
            <>
              {/* Quick-fill buttons for stop and target */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Exit Price</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setExitPrice(selected.stop.toFixed(2))}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-bear-500/10 text-bear-400 border border-bear-500/20 hover:bg-bear-500/20 transition-colors font-mono"
                  >
                    Stop ${selected.stop.toFixed(2)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setExitPrice(selected.target.toFixed(2))}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-bull-500/10 text-bull-400 border border-bull-500/20 hover:bg-bull-500/20 transition-colors font-mono"
                  >
                    Target ${selected.target.toFixed(2)}
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={exitPrice}
                  onChange={e => { setExitPrice(e.target.value); setError(null); }}
                  placeholder={`e.g. ${selected.target.toFixed(2)}`}
                  className="w-full bg-surface-700 border border-surface-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 font-mono transition-colors"
                  autoFocus
                />
              </div>

              {/* P&L preview */}
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
                    Estimated P&L
                    <span className="text-xs text-gray-500">
                      ({selected.stockSuggestion?.shares ?? 1} shares)
                    </span>
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
              disabled={submitting || !selected || !exitPrice || setups.length === 0}
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

