interface GoalTrackerProps {
  dailyGoal: number;
  accountSize: number;
  setupCount: number;
  bestRR: number;
}

export function GoalTracker({ dailyGoal, accountSize, setupCount, bestRR }: GoalTrackerProps) {
  const progressPercent = Math.min((setupCount / 3) * 100, 100);

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-600 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Daily Goal</h3>
        <span className="text-2xl font-bold text-bull-400 font-mono">${dailyGoal}</span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Setup pipeline</span>
            <span>{setupCount} active</span>
          </div>
          <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="Account Size" value={`$${accountSize.toLocaleString()}`} />
          <Stat label="Best R/R" value={bestRR > 0 ? `${bestRR}:1` : '—'} highlight />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-surface-700 rounded-lg p-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-sm font-bold font-mono ${highlight ? 'text-warn-400' : 'text-gray-200'}`}>
        {value}
      </div>
    </div>
  );
}
