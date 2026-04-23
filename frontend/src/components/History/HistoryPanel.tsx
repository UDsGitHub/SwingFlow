import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { TradeSetup } from '../../types';
import { setupsApi } from '../../services/api';

const STRATEGY_LABELS: Record<string, string> = {
  TREND_PULLBACK: 'Trend Pullback',
  BREAKOUT:       'Breakout',
  REVERSAL:       'Reversal',
};

export function HistoryPanel() {
  const navigate = useNavigate();
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
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface-800 animate-pulse rounded-xl h-14 border border-surface-700" />
        ))}
      </div>
    );
  }

  if (setups.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center mx-auto mb-4">
          <ClipboardList size={22} className="text-gray-600" />
        </div>
        <p className="text-sm text-gray-500">No trade history yet. Run a scan to generate setups.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-surface-800 rounded-2xl border border-surface-700 overflow-hidden">
        <div className="grid grid-cols-7 text-xs font-medium text-gray-600 uppercase tracking-wider px-5 py-3 border-b border-surface-700">
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
            onClick={() => navigate(`/setup/${s.id}`)}
            className="w-full grid grid-cols-7 items-center px-5 py-3.5 border-b border-surface-700 last:border-0 hover:bg-surface-750 transition-colors text-left"
          >
            <span className="font-bold font-mono text-white text-sm">{s.symbol}</span>
            <span className="text-xs text-gray-500">{STRATEGY_LABELS[s.strategy] ?? s.strategy}</span>
            <span className="text-right font-mono text-sm text-brand-400">${s.entry.toFixed(2)}</span>
            <span className="text-right font-mono text-sm text-bull-400">${s.target.toFixed(2)}</span>
            <span className="text-center font-mono text-sm text-warn-400">{s.riskReward}:1</span>
            <div className="flex justify-center">
              <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                s.confidence >= 80 ? 'bg-bull-500/15 text-bull-400' :
                s.confidence >= 65 ? 'bg-warn-500/15 text-warn-400' :
                'bg-brand-500/15 text-brand-400'
              }`}>
                {s.confidence}%
              </span>
            </div>
            <span className="text-right text-xs text-gray-600">
              {format(new Date(s.detectedAt), 'MMM d, HH:mm')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
