import { useState, useEffect } from 'react';
import { TradeSetup } from '../../types';
import { setupsApi } from '../../services/api';
import { format } from 'date-fns';

export function HistoryPanel({ onSetupClick }: { onSetupClick: (setup: TradeSetup) => void }) {
  const [setups, setSetups] = useState<TradeSetup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setupsApi.all()
      .then(setSetups)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-surface-800 animate-pulse rounded-xl h-16 border border-surface-600" />
        ))}
      </div>
    );
  }

  if (setups.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16 text-gray-500">
        <div className="text-4xl mb-3">📋</div>
        <p>No trade history yet. Run a scan to generate setups.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-surface-800 rounded-xl border border-surface-600 overflow-hidden">
        <div className="grid grid-cols-7 text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 border-b border-surface-600">
          <span>Symbol</span>
          <span>Strategy</span>
          <span className="text-right">Entry</span>
          <span className="text-right">Target</span>
          <span className="text-center">R/R</span>
          <span className="text-center">Confidence</span>
          <span className="text-right">Detected</span>
        </div>

        {setups.map(s => (
          <button
            key={s.id}
            onClick={() => onSetupClick(s)}
            className="w-full grid grid-cols-7 items-center px-4 py-3 border-b border-surface-700 last:border-0 hover:bg-surface-700/50 transition-colors text-left"
          >
            <span className="font-bold font-mono text-white">{s.symbol}</span>
            <span className="text-xs text-gray-400">{s.strategy.replace('_', ' ')}</span>
            <span className="text-right font-mono text-sm text-brand-400">${s.entry.toFixed(2)}</span>
            <span className="text-right font-mono text-sm text-bull-400">${s.target.toFixed(2)}</span>
            <span className="text-center font-mono text-sm text-warn-400">{s.riskReward}:1</span>
            <div className="flex justify-center">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                s.confidence >= 80 ? 'bg-bull-500/20 text-bull-400' :
                s.confidence >= 65 ? 'bg-warn-500/20 text-warn-400' :
                'bg-brand-500/20 text-brand-400'
              }`}>{s.confidence}%</span>
            </div>
            <span className="text-right text-xs text-gray-500">
              {format(new Date(s.detectedAt), 'MMM d HH:mm')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
