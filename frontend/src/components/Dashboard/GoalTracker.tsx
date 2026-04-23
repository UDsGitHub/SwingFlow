interface GoalTrackerProps {
  dailyGoal: number;
  accountSize: number;
  setupCount: number;
  bestRR: number;
}

export function GoalTracker({ dailyGoal, accountSize, setupCount, bestRR }: GoalTrackerProps) {
  const progressPercent = Math.min((setupCount / 3) * 100, 100);

  return (
    <div id="tour-goal" className="bg-surface-800 rounded-2xl border border-surface-700 p-5 space-y-5">
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Daily Goal</p>
        <p className="text-3xl font-bold text-bull-400 font-mono">${dailyGoal}</p>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Setup pipeline</span>
          <span>{setupCount} active</span>
        </div>
        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Account" value={`$${accountSize.toLocaleString()}`} />
        <Stat label="Best R/R" value={bestRR > 0 ? `${bestRR}:1` : '—'} highlight />
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
