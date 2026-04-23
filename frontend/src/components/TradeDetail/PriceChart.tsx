import { useState } from 'react';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { TradeSetup } from '../../types';
import { useChartData } from '../../hooks/useWatchlist';

interface PriceChartProps {
  symbol: string;
  setup: TradeSetup | null;
}

const TIMEFRAMES = [
  { label: '10D', days: 10  },
  { label: '30D', days: 30  },
  { label: '60D', days: 60  },
  { label: '6M',  days: 180 },
] as const;

function formatDate(ts: number) {
  return format(new Date(ts), 'MMM d');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const close  = payload.find((p: any) => p.dataKey === 'close');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volume = payload.find((p: any) => p.dataKey === 'volume');
  return (
    <div className="bg-surface-700 border border-surface-600 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-2 font-medium">
        {label ? format(new Date(label), 'MMM d, yyyy') : ''}
      </p>
      {close && (
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-gray-400">Close:</span>
          <span className="text-white font-mono">${(close.value as number).toFixed(2)}</span>
        </div>
      )}
      {volume && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-surface-500 border border-surface-400" />
          <span className="text-gray-400">Volume:</span>
          <span className="text-white font-mono">{((volume.value as number) / 1e6).toFixed(2)}M</span>
        </div>
      )}
    </div>
  );
};

export function PriceChart({ symbol, setup }: PriceChartProps) {
  const [days, setDays]           = useState(60);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const { prices, loading }       = useChartData(symbol, days);

  if (loading) {
    return (
      <div className="bg-surface-800 rounded-xl border border-surface-600 p-4 h-80 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading chart…</div>
      </div>
    );
  }

  const validData = prices.filter(d => d.close > 0);
  if (validData.length === 0) return null;

  // Expand domain to always include entry/stop/target levels
  const allLevels = [
    ...validData.map(d => d.close),
    ...(setup ? [setup.entry, setup.stop, setup.target] : []),
  ];
  const priceMin = Math.min(...allLevels) * 0.97;
  const priceMax = Math.max(...allLevels) * 1.03;

  const activeLabel = TIMEFRAMES.find(t => t.days === days)?.label ?? '60D';

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-600 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{symbol} — {activeLabel} Price Chart</h3>

        <div className="flex items-center gap-4">
          {/* Timeframe switcher */}
          <div className="flex items-center bg-surface-700 rounded-lg p-0.5">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.label}
                onClick={() => setDays(tf.days)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  days === tf.days
                    ? 'bg-brand-500/20 text-brand-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-brand-400 inline-block" /> EMA 20
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-warn-400 inline-block" /> EMA 50
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-surface-600 inline-block rounded-sm opacity-70" /> Vol
            </span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart
          data={validData}
          margin={{ top: 10, right: 90, left: 0, bottom: 0 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onMouseMove={(e: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const c = e?.activePayload?.find((p: any) => p.dataKey === 'close');
            setHoverPrice(c?.value ?? null);
          }}
          onMouseLeave={() => setHoverPrice(null)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a40" vertical={false} />

          <XAxis
            dataKey="timestamp"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(validData.length / 6)}
          />

          {/* Left price axis */}
          <YAxis
            yAxisId="price"
            domain={[priceMin, priceMax]}
            tickFormatter={v => `$${(v as number).toFixed(0)}`}
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={55}
          />

          {/* Right volume axis — increased contrast */}
          <YAxis
            yAxisId="volume"
            orientation="right"
            tickFormatter={v => `${((v as number) / 1e6).toFixed(0)}M`}
            tick={{ fontSize: 9, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={38}
            label={{
              value: 'Volume',
              angle: 90,
              position: 'insideRight',
              offset: 12,
              style: { fill: '#4b5563', fontSize: 9 },
            }}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#4b5563', strokeWidth: 1, strokeDasharray: '3 3' }}
          />

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

          {/* Horizontal crosshair — tracks hovered price */}
          {hoverPrice !== null && (
            <ReferenceLine
              yAxisId="price"
              y={hoverPrice}
              stroke="#4b5563"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          )}

          {/* Setup levels — entry / stop / target */}
          {setup && (
            <>
              <ReferenceLine
                yAxisId="price"
                y={setup.entry}
                stroke="#38bdf8"
                strokeDasharray="6 3"
                label={{ value: `Entry $${setup.entry.toFixed(2)}`, fill: '#38bdf8', fontSize: 10, position: 'right' }}
              />
              <ReferenceLine
                yAxisId="price"
                y={setup.stop}
                stroke="#ef4444"
                strokeDasharray="6 3"
                label={{ value: `Stop $${setup.stop.toFixed(2)}`, fill: '#ef4444', fontSize: 10, position: 'right' }}
              />
              <ReferenceLine
                yAxisId="price"
                y={setup.target}
                stroke="#22c55e"
                strokeDasharray="6 3"
                label={{ value: `Target $${setup.target.toFixed(2)}`, fill: '#22c55e', fontSize: 10, position: 'right' }}
              />
            </>
          )}

          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.01} />
            </linearGradient>
          </defs>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
