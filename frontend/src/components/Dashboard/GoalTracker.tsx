import { PencilLine } from 'lucide-react';

interface GoalTrackerProps {
  dailyGoal: number;
  accountSize: number;
  setupCount: number;
  bestRR: number;
  dailyPnl: number;
  onLogTrade: () => void;
}

export function GoalTracker({ dailyGoal, accountSize, setupCount, bestRR, dailyPnl, onLogTrade }: GoalTrackerProps) {
  const progressPercent = dailyGoal > 0 ? Math.min((dailyPnl / dailyGoal) * 100, 100) : 0;
  const progressColor   = dailyPnl >= dailyGoal ? 'from-bull-600 to-bull-400' : 'from-brand-600 to-brand-400';

  return (
    <div id="tour-goal" className="bg-surface-800 rounded-2xl border border-surface-700 p-5 space-y-5">
      {/* P&L vs Goal */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-400 tracking-wide">Today's P&L</p>
          <button
            onClick={onLogTrade}
            title="Log a trade outcome"
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-400 transition-colors"
          >
            <PencilLine size={12} />
            Log trade
          </button>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-3xl font-bold font-mono ${dailyPnl >= 0 ? 'text-bull-400' : 'text-bear-400'}`}>
            ${dailyPnl.toFixed(0)}
          </span>
          <span className="text-sm text-gray-400">/ ${dailyGoal} goal</span>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Progress to goal</span>
          <span>{progressPercent.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${progressColor} rounded-full transition-all duration-700`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Account"   value={`$${accountSize.toLocaleString()}`} />
        <Stat label="Best R/R"  value={bestRR > 0 ? `${bestRR}:1` : '—'} highlight />
        <Stat label="Pipeline"  value={`${setupCount} active`} />
        <Stat label="Remaining" value={`$${Math.max(dailyGoal - dailyPnl, 0).toFixed(0)}`} />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-surface-700 rounded-xl p-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-sm font-bold font-mono ${highlight ? 'text-warn-400' : 'text-gray-200'}`}>
        {value}
      </div>
    </div>
  );
}
