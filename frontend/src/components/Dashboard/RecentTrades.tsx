import { useNavigate } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { TradeSetup } from '../../types';
import { useAllSetups } from '../../hooks/useSetups';

const STRATEGY_BADGE: Record<string, string> = {
  TREND_PULLBACK: 'bg-brand-500/10 text-brand-400',
  BREAKOUT:       'bg-warn-500/10 text-warn-400',
  REVERSAL:       'bg-purple-500/10 text-purple-400',
};

const STRATEGY_LABELS: Record<string, string> = {
  TREND_PULLBACK: 'Trend Pullback',
  BREAKOUT:       'Breakout',
  REVERSAL:       'Reversal',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'bg-brand-500/10 text-brand-400',
  TRIGGERED: 'bg-warn-500/10 text-warn-400',
  COMPLETED: 'bg-bull-500/10 text-bull-400',
  EXPIRED:   'bg-surface-600 text-gray-400',
};

export function RecentTrades() {
  const navigate = useNavigate();
  const { allSetups, loading } = useAllSetups();
  const setups = allSetups
    .filter(s => s.status === 'COMPLETED' || s.status === 'EXPIRED')
    .slice(0, 8);

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-300 mb-4">Recent Closed Setups</h2>

      <div className="bg-surface-800 rounded-2xl border border-surface-700 overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-surface-800 animate-pulse" />
            ))}
          </div>
        ) : setups.length === 0 ? (
          <div className="py-12 text-center">
            <ClipboardList size={20} className="text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No recent setups. Your history will appear here after the first scan.</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 text-xs font-medium text-gray-400 uppercase tracking-wider px-5 py-3 border-b border-surface-700">
              <span className="col-span-2">Symbol</span>
              <span className="col-span-3">Strategy</span>
              <span className="col-span-2 text-right">Entry</span>
              <span className="col-span-2 text-right">Target</span>
              <span className="col-span-1 text-center">R/R</span>
              <span className="col-span-1 text-center">Status</span>
              <span className="col-span-1 text-right">Date</span>
            </div>

            {setups.map(s => (
              <button
                key={s.id}
                onClick={() => navigate(`/setup/${s.id}`, { state: { from: 'history' } })}
                className="w-full grid grid-cols-12 items-center px-5 py-3 border-b border-surface-700 last:border-0 hover:bg-surface-750 transition-colors text-left"
              >
                <span className="col-span-2 font-bold font-mono text-white text-sm">{s.symbol}</span>

                <div className="col-span-3">
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${STRATEGY_BADGE[s.strategy] ?? 'bg-surface-700 text-gray-400'}`}>
                    {STRATEGY_LABELS[s.strategy] ?? s.strategy}
                  </span>
                </div>

                <span className="col-span-2 text-right font-mono text-sm text-gray-200">${s.entry.toFixed(2)}</span>
                <span className="col-span-2 text-right font-mono text-sm text-bull-400">${s.target.toFixed(2)}</span>
                <span className="col-span-1 text-center font-mono text-sm text-warn-400">{s.riskReward}:1</span>

                <div className="col-span-1 flex justify-center">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[s.status] ?? ''}`}>
                    {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                  </span>
                </div>

                <span className="col-span-1 text-right text-xs text-gray-400 tabular-nums">
                  {format(new Date(s.detectedAt), 'MMM d')}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
