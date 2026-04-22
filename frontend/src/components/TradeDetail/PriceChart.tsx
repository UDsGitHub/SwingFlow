import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { format } from 'date-fns';
import { TradeSetup } from '../../types';
import { useChartData } from '../../hooks/useWatchlist';

interface PriceChartProps {
  symbol: string;
  setup: TradeSetup | null;
}

function formatPrice(v: number) {
  return isNaN(v) ? null : `$${v.toFixed(2)}`;
}

function formatDate(ts: number) {
  return format(new Date(ts), 'MMM d');
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: number }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-700 border border-surface-600 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2">{label ? formatDate(label) : ''}</p>
      {payload.map((p, i) => (
        p.value != null && !isNaN(p.value) && (
          <div key={i} className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-gray-400">{p.name}:</span>
            <span className="text-white font-mono">
              {p.name === 'Volume' ? `${(p.value / 1e6).toFixed(1)}M` : `$${p.value.toFixed(2)}`}
            </span>
          </div>
        )
      ))}
    </div>
  );
};

export function PriceChart({ symbol, setup }: PriceChartProps) {
  const { prices, loading } = useChartData(symbol, 60);

  if (loading) {
    return (
      <div className="bg-surface-800 rounded-xl border border-surface-600 p-4 h-80 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading chart…</div>
      </div>
    );
  }

  const validData = prices.filter(d => d.close > 0);
  if (validData.length === 0) return null;

  const priceMin = Math.min(...validData.map(d => d.close)) * 0.98;
  const priceMax = Math.max(...validData.map(d => d.close)) * 1.02;

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-600 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{symbol} — 60 Day Price Chart</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-brand-400 inline-block" /> EMA 20</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-warn-400 inline-block" /> EMA 50</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={validData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a40" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(validData.length / 6)}
          />
          <YAxis
            yAxisId="price"
            domain={[priceMin, priceMax]}
            tickFormatter={v => `$${v.toFixed(0)}`}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            tickFormatter={v => `${(v / 1e6).toFixed(0)}M`}
            tick={{ fontSize: 9, fill: '#4b5563' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Volume bars */}
          <Bar yAxisId="volume" dataKey="volume" name="Volume" fill="#1e2a40" opacity={0.6} />

          {/* Price area */}
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="close"
            name="Price"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#priceGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#0ea5e9' }}
          />

          {/* EMAs */}
          <Line yAxisId="price" type="monotone" dataKey="ema20" name="EMA 20" stroke="#38bdf8" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls />
          <Line yAxisId="price" type="monotone" dataKey="ema50" name="EMA 50" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls />

          {/* Setup levels */}
          {setup && (
            <>
              <ReferenceLine yAxisId="price" y={setup.entry} stroke="#38bdf8" strokeDasharray="6 3" label={{ value: `Entry $${setup.entry}`, fill: '#38bdf8', fontSize: 10, position: 'right' }} />
              <ReferenceLine yAxisId="price" y={setup.stop} stroke="#ef4444" strokeDasharray="6 3" label={{ value: `Stop $${setup.stop}`, fill: '#ef4444', fontSize: 10, position: 'right' }} />
              <ReferenceLine yAxisId="price" y={setup.target} stroke="#22c55e" strokeDasharray="6 3" label={{ value: `Target $${setup.target}`, fill: '#22c55e', fontSize: 10, position: 'right' }} />
            </>
          )}

          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.01} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
