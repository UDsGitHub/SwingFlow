import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowUp, ArrowDown, Zap } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { PriceChart } from '../TradeDetail/PriceChart';
import { SetupCard } from '../Dashboard/SetupCard';


export function SymbolDetail() {
  const { sym }    = useParams<{ sym: string }>();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { summaries, setups, isScanning, triggerScan } = useAppContext();

  const fromSource = (location.state as { from?: string } | null)?.from;
  const backLabel  = fromSource === 'dashboard' ? 'Back to Dashboard'
                   : fromSource === 'watchlist' ? 'Back to Watchlist'
                   : 'Back';

  const symbol  = sym?.toUpperCase() ?? '';
  const summary = summaries.find(s => s.symbol === symbol);
  const activeSetups = setups.filter(s => s.symbol === symbol);

  const isPositive = (summary?.changePercent ?? 0) >= 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          {backLabel}
        </button>

        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-2xl font-bold text-white font-mono">{symbol}</h2>

          {summary ? (
            <div className="flex items-center gap-5 flex-1">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Price</div>
                <div className="text-lg font-bold font-mono text-gray-200">
                  ${summary.lastPrice.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">Change</div>
                <div className={`text-lg font-bold font-mono flex items-center gap-1 ${isPositive ? 'text-bull-400' : 'text-bear-400'}`}>
                  {isPositive ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  {isPositive ? '+' : ''}{summary.changePercent.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">RSI</div>
                <div className={`text-lg font-bold font-mono flex items-center gap-1.5 ${
                  summary.rsi >= 70 ? 'text-warn-400' :
                  summary.rsi <= 30 ? 'text-bull-400' : 'text-gray-200'
                }`}>
                  {summary.rsi}
                  {summary.rsi >= 70 && (
                    <span className="text-[10px] font-semibold bg-warn-500/15 text-warn-400 px-1.5 py-0.5 rounded-md">OB</span>
                  )}
                  {summary.rsi <= 30 && (
                    <span className="text-[10px] font-semibold bg-bull-500/15 text-bull-400 px-1.5 py-0.5 rounded-md">OS</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-400 flex-1">No market data — data refreshes every 60s</span>
          )}

          <button
            onClick={() => triggerScan()}
            disabled={isScanning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-300 bg-surface-700 hover:bg-surface-600 border border-surface-600 transition-colors disabled:opacity-40"
          >
            <Zap size={13} />
            {isScanning ? 'Scanning…' : 'Scan Now'}
          </button>
        </div>
      </div>

      {/* Chart */}
      <PriceChart symbol={symbol} setup={null} />

      {/* Active setups for this symbol */}
      {activeSetups.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            Active Setups
            <span className="ml-2 text-gray-400">({activeSetups.length})</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeSetups.map(setup => (
              <SetupCard
                key={setup.id}
                setup={setup}
                onClick={() => navigate(`/setup/${setup.id}`)}
                onDismiss={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {activeSetups.length === 0 && (
        <div className="bg-surface-800 rounded-2xl border border-surface-700 p-8 text-center">
          <p className="text-sm text-gray-400 mb-1">No active setups for {symbol}</p>
          <p className="text-xs text-gray-500">Run a scan to find trade opportunities.</p>
        </div>
      )}
    </div>
  );
}

