import { useEffect, useState } from 'react';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { TradeSetup } from '../../types';
import { useChartData } from '../../hooks/useWatchlist';
import { useTheme } from '../../context/ThemeContext';

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
          <span className="w-2 h-2 rounded-full bg-gray-400" />
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

function levelLabelChip(text: string, color: string, yOffset = 0, chipBg = '#101624') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (props: any) => {
    const vb = props?.viewBox;
    if (!vb) return <g />;

    const x = (vb.x ?? 0) + 8;
    const y = (vb.y ?? 0) + yOffset - 9;
    const width = Math.max(64, text.length * 6 + 12);

    return (
      <g>
        <rect
          x={x}
          y={y - 9}
          width={width}
          height={18}
          rx={4}
          fill={chipBg}
          stroke={color}
          strokeOpacity={0.45}
        />
        <text
          x={x + 6}
          y={y + 4}
          fill={color}
          fontSize={10}
          fontWeight={600}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {text}
        </text>
      </g>
    );
  };
}

function buildLevelLabelOffsets(setup: TradeSetup, priceMin: number, priceMax: number, chartHeightPx: number) {
  const chartHeight = chartHeightPx - 10; // keep aligned with chart height and top margin
  const minGapPx = 20;
  const paddingTop = 8;
  const paddingBottom = 8;
  const range = Math.max(priceMax - priceMin, 0.0001);

  const levels = [
    { key: 'entry', value: setup.entry },
    { key: 'stop', value: setup.stop },
    { key: 'target', value: setup.target },
  ] as const;

  const byY = levels
    .map((l) => ({
      key: l.key,
      y: ((priceMax - l.value) / range) * chartHeight,
    }))
    .sort((a, b) => a.y - b.y);

  const adjusted = byY.map((p) => ({ ...p }));

  // Forward pass: ensure minimum spacing top -> bottom.
  for (let i = 1; i < adjusted.length; i += 1) {
    if (adjusted[i].y - adjusted[i - 1].y < minGapPx) {
      adjusted[i].y = adjusted[i - 1].y + minGapPx;
    }
  }

  // Keep within chart bounds.
  const overflowBottom = adjusted[adjusted.length - 1].y - (chartHeight - paddingBottom);
  if (overflowBottom > 0) {
    for (let i = 0; i < adjusted.length; i += 1) adjusted[i].y -= overflowBottom;
  }
  const overflowTop = paddingTop - adjusted[0].y;
  if (overflowTop > 0) {
    for (let i = 0; i < adjusted.length; i += 1) adjusted[i].y += overflowTop;
  }

  const original = new Map(byY.map((p) => [p.key, p.y]));
  return adjusted.reduce<Record<'entry' | 'stop' | 'target', number>>((acc, p) => {
    const raw = original.get(p.key) ?? p.y;
    acc[p.key] = p.y - raw;
    return acc;
  }, { entry: 0, stop: 0, target: 0 });
}

export function PriceChart({ symbol, setup }: PriceChartProps) {
  const { resolved } = useTheme();
  const isLight = resolved === 'light';
  const [days, setDays]           = useState(60);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const { prices, loading }       = useChartData(symbol, days);
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
  const chartHeight = isNarrow ? 220 : 260;
  const levelLabelOffsets = setup ? buildLevelLabelOffsets(setup, priceMin, priceMax, chartHeight) : null;
  const palette = {
    grid: isLight ? '#cbd5e1' : '#1e2a40',
    axis: isLight ? '#64748b' : '#6b7280',
    crosshair: isLight ? '#94a3b8' : '#4b5563',
    volumeFill: isLight ? '#cbd5e1' : '#1e2a40',
    priceLine: isLight ? '#64748b' : '#94a3b8',
    ema20: isLight ? '#475569' : '#cbd5e1',
    ema50: isLight ? '#64748b' : '#64748b',
    chipBg: isLight ? '#f8fafc' : '#101624',
  };

  const activeLabel = TIMEFRAMES.find(t => t.days === days)?.label ?? '60D';

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-600 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-white">{symbol} — {activeLabel} Price Chart</h3>

        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
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
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-gray-300 inline-block" /> EMA 20
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-gray-500 inline-block" /> EMA 50
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-2 bg-surface-600 inline-block rounded-sm opacity-70" /> Vol
            </span>
          </div>
        </div>
      </div>

      <div className={isNarrow ? 'h-[220px]' : 'h-[260px]'}>
        <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={validData}
          margin={isNarrow ? { top: 8, right: 8, left: 0, bottom: 0 } : { top: 10, right: 72, left: 8, bottom: 0 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onMouseMove={(e: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const c = e?.activePayload?.find((p: any) => p.dataKey === 'close');
            setHoverPrice(c?.value ?? null);
          }}
          onMouseLeave={() => setHoverPrice(null)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />

          <XAxis
            dataKey="timestamp"
            tickFormatter={formatDate}
            tick={{ fontSize: 10, fill: palette.axis }}
            axisLine={false}
            tickLine={false}
            interval={Math.floor(validData.length / 6)}
          />

          {/* Left price axis */}
          <YAxis
            yAxisId="price"
            domain={[priceMin, priceMax]}
            tickFormatter={v => `$${(v as number).toFixed(0)}`}
            tick={{ fontSize: 10, fill: palette.axis }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={isNarrow ? 48 : 62}
          />

          {/* Right volume axis — increased contrast */}
          <YAxis
            yAxisId="volume"
            orientation="right"
            tickFormatter={v => `${((v as number) / 1e6).toFixed(0)}M`}
            tick={{ fontSize: 9, fill: palette.axis }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={44}
            hide={isNarrow}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: palette.crosshair, strokeWidth: 1, strokeDasharray: '3 3' }}
          />

          {/* Volume bars */}
          <Bar yAxisId="volume" dataKey="volume" name="Volume" fill={palette.volumeFill} opacity={0.6} />

          {/* Price area */}
          <Area
            yAxisId="price"
            type="monotone"
            dataKey="close"
            name="Price"
            stroke={palette.priceLine}
            strokeWidth={2}
            fill="url(#priceGradient)"
            dot={false}
            activeDot={{ r: 4, fill: palette.priceLine }}
          />

          {/* EMAs — neutral grays (not accent) */}
          <Line yAxisId="price" type="monotone" dataKey="ema20" name="EMA 20" stroke={palette.ema20} strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls />
          <Line yAxisId="price" type="monotone" dataKey="ema50" name="EMA 50" stroke={palette.ema50} strokeWidth={1.5} dot={false} strokeDasharray="4 2" connectNulls />

          {/* Horizontal crosshair — tracks hovered price */}
          {hoverPrice !== null && (
            <ReferenceLine
              yAxisId="price"
              y={hoverPrice}
              stroke={palette.crosshair}
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
                stroke="#94a3b8"
                strokeDasharray="6 3"
                label={
                  !isNarrow
                    ? levelLabelChip(`Entry $${setup.entry.toFixed(2)}`, '#94a3b8', levelLabelOffsets?.entry ?? 0, palette.chipBg)
                    : undefined
                }
              />
              <ReferenceLine
                yAxisId="price"
                y={setup.stop}
                stroke="#ef4444"
                strokeDasharray="6 3"
                label={
                  !isNarrow
                    ? levelLabelChip(`Stop $${setup.stop.toFixed(2)}`, '#ef4444', levelLabelOffsets?.stop ?? 0, palette.chipBg)
                    : undefined
                }
              />
              <ReferenceLine
                yAxisId="price"
                y={setup.target}
                stroke="#22c55e"
                strokeDasharray="6 3"
                label={
                  !isNarrow
                    ? levelLabelChip(`Target $${setup.target.toFixed(2)}`, '#22c55e', levelLabelOffsets?.target ?? 0, palette.chipBg)
                    : undefined
                }
              />
            </>
          )}

          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={palette.priceLine} stopOpacity={0.12} />
              <stop offset="95%" stopColor={palette.priceLine} stopOpacity={0.02} />
            </linearGradient>
          </defs>
        </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
