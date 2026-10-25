import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Joyride, STATUS, EventData, Step } from 'react-joyride';
import { useTheme } from '../../context/ThemeContext';

interface ProductTourProps {
  run: boolean;
  onFinish: () => void;
}

// ── Per-route step definitions ────────────────────────────────

const DASHBOARD_STEPS: Step[] = [
  {
    target:    'body',
    placement: 'center',
    title: 'Welcome to SwingFlow',
    content: (
      <div>
        <p>SwingFlow scans your watchlist and surfaces high-probability swing trade setups — so you never have to watch charts all day.</p>
        <p style={{ marginTop: 8, opacity: 0.6, fontSize: 12 }}>Quick tour of the dashboard. Takes about 60 seconds.</p>
      </div>
    ),
  },
  {
    target:    '#tour-market',
    placement: 'bottom',
    title: 'Market Overview',
    content: 'A live pulse on every symbol in your watchlist: price change, trend direction, and RSI. Click any ticker to manage your watchlist.',
  },
  {
    target:    '#tour-goal',
    placement: 'right',
    title: 'Goal',
    content: 'Tracks the realized P&L of trades you closed this day, week or month against your goal, and says whether the goal is realistic: how often past periods reached it at your account size and risk. Set the goal and its period in Settings.',
  },
  {
    target:    '#tour-setups',
    placement: 'left',
    title: 'Active Setups',
    content: 'Setup cards are ranked by expected value (backtested edge × dollars at risk) so the best ideas show first. Each card includes entry, stop, target, confidence, and explicit execution guidance. If no setups appear after a scan, the dashboard also shows diagnostic reasons.',
  },
  {
    target:    '#tour-scan',
    placement: 'bottom',
    title: 'Scan Now',
    content: 'Runs the strategy engine across your watchlist with regime-aware gating and per-symbol explanations. You will see both new setups and a summary of why symbols did not qualify.',
  },
  {
    target:    '#tour-notifications',
    placement: 'bottom',
    title: 'Push Notifications',
    content: 'Use this center to review delivery status for alerts. You can also open Settings to verify notification health and send a test notification.',
  },
  {
    target:    '#tour-sidebar',
    placement: 'right',
    title: 'Navigation',
    content: (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', lineHeight: 1.8 }}>
        <li><strong>Dashboard</strong> — active setups and market overview</li>
        <li><strong>Watchlist</strong> — manage the symbols you scan</li>
        <li><strong>History</strong> — every past setup with full detail</li>
        <li><strong>Settings</strong> — account size, goal, risk % and its ceiling</li>
      </ul>
    ),
  },
];

const WATCHLIST_STEPS: Step[] = [
  {
    target:    'body',
    placement: 'center',
    title: 'Your Watchlist',
    content: 'The watchlist controls which symbols SwingFlow scans. Add the stocks you follow — every scan runs against this list.',
  },
  {
    target:    '#tour-watchlist-add',
    placement: 'bottom',
    title: 'Search & add symbols',
    content: (
      <div>
        <p>Open <strong>Search &amp; add symbol</strong> to look up tickers by name or symbol using your configured live market data provider.</p>
        <p style={{ marginTop: 8, opacity: 0.6, fontSize: 12 }}>Pick a result or quick-pick chip. Duplicates and invalid tickers show feedback under this card.</p>
      </div>
    ),
  },
  {
    target:    '#tour-watchlist-filter',
    placement: 'bottom',
    title: 'Filter your list',
    content:
      'This field only narrows rows already on your watchlist — it never adds symbols. Clear it to see every ticker again.',
  },
  {
    target:    '#tour-watchlist-table',
    placement: 'left',
    title: 'Live Market Data',
    content: (
      <div>
        <p>Click any column header to sort. Each row shows live data:</p>
        <ul style={{ margin: '8px 0 0', padding: '0 0 0 16px', lineHeight: 1.8 }}>
          <li><strong>Change</strong> — arrow + % move, green/red for direction</li>
          <li><strong>RSI</strong> — <span style={{ color: '#f59e0b' }}>OB</span> above 70, neutral <span style={{ color: '#94a3b8' }}>OS</span> below 30</li>
          <li><strong>⚡ button</strong> — scans just that symbol and takes you to results</li>
          <li><strong>Row click</strong> — opens the latest setup for that ticker</li>
        </ul>
      </div>
    ),
  },
];

const HISTORY_STEPS: Step[] = [
  {
    target:    'body',
    placement: 'center',
    title: 'Trade History',
    content: 'Every setup SwingFlow has ever detected is stored here — active, expired, and everything in between. Use it to review past signals and track your edge over time.',
  },
  {
    target:    '#tour-history-table',
    placement: 'left',
    title: 'Reading the Table',
    content: (
      <div>
        <p>Every detected setup lives here. The <strong>P&amp;L column</strong> shows realized profit or loss for closed trades — green for wins, red for losses, dash for open or expired setups.</p>
        <ul style={{ margin: '8px 0 0', padding: '0 0 0 16px', lineHeight: 1.8 }}>
          <li><strong>Strategy</strong> — neutral chips label Trend Pullback, Breakout, or Reversal</li>
        </ul>
        <p style={{ marginTop: 8 }}>Use the analytics cards above to track weekly setup volume, trigger count, and notification delivery performance.</p>
        <p style={{ marginTop: 8 }}>Click any row to open the full trade plan.</p>
      </div>
    ),
  },
];

const SETTINGS_STEPS: Step[] = [
  {
    target:    'body',
    placement: 'center',
    title: 'Settings',
    content: 'Configure your account profile so SwingFlow can calculate exact position sizes and judge your goal against your capital.',
  },
  {
    target:    '#tour-settings-account',
    placement: 'right',
    title: 'Account Profile',
    content: (
      <div>
        <p>Four inputs that drive everything else:</p>
        <ul style={{ margin: '8px 0 0', padding: '0 0 0 16px', lineHeight: 1.8 }}>
          <li><strong>Account Size</strong> — your total trading capital</li>
          <li><strong>Goal</strong> — how much you want to make per day, week or month</li>
          <li><strong>Risk %</strong> — max loss per trade as a % of capital (1–2% is standard)</li>
          <li><strong>Risk ceiling</strong> — the most you will ever allow per trade</li>
        </ul>
      </div>
    ),
  },
  {
    target:    '#tour-settings-notifications',
    placement: 'right',
    title: 'Alerts',
    content: 'Turn on browser notifications, confirm readiness status, and run a test alert. This helps validate that setup notifications can be delivered before entry opportunities are missed.',
  },
  {
    target:    '#tour-settings-sizing',
    placement: 'right',
    title: 'Is This Goal Realistic?',
    content: 'Updates live as you edit. Compares your goal with what the strategy has made at these settings in the out-of-sample backtest (or your paper record, once it has enough trades), and suggests a realistic goal or the account size the goal needs. Suggestions only fill the form.',
  },
];

const SETUP_DETAIL_STEPS: Step[] = [
  {
    target:    'body',
    placement: 'center',
    title: 'Trade Setup Detail',
    content: 'This page has everything you need to evaluate and execute a trade — price chart with key levels, a checklist, position sizing, and an options suggestion.',
  },
  {
    target:    '#tour-chart',
    placement: 'bottom',
    title: 'Price Chart',
    content: 'A 60-day chart with EMA 20 (blue dashed) and EMA 50 (amber dashed) overlaid. The horizontal lines mark the entry, stop loss, and target — so you can see exactly where the setup sits relative to price history.',
  },
  {
    target:    '#tour-trade-plan',
    placement: 'right',
    title: 'Trade Plan',
    content: 'The trade plan now includes explicit execution instructions: when to enter, when setup is invalidated, and where to take profits, plus risk/reward and checklist confirmation.',
  },
  {
    target:    '#tour-options',
    placement: 'left',
    title: 'Options Suggestion',
    content: 'If you trade options, SwingFlow suggests a contract aligned with the setup\'s direction, expiration, and delta. The premium shown is an estimate — always verify liquidity and the bid/ask spread before trading.',
  },
  {
    target:    '#tour-close-trade',
    placement: 'left',
    title: 'Close Trade',
    content: (
      <div>
        <p>When you exit a trade, enter your actual exit price here. SwingFlow calculates your realized P&amp;L and adds it to today's goal tracker immediately.</p>
        <p style={{ marginTop: 8, opacity: 0.6, fontSize: 12 }}>Once recorded, this panel shows the outcome — exit price, dollar P&amp;L, and the time you closed.</p>
      </div>
    ),
  },
];

// ── Route → steps mapping ─────────────────────────────────────

function useRouteSteps(): Step[] {
  const { pathname } = useLocation();
  if (pathname.startsWith('/setup/')) return SETUP_DETAIL_STEPS;
  const map: Record<string, Step[]> = {
    '/':          DASHBOARD_STEPS,
    '/watchlist': WATCHLIST_STEPS,
    '/history':   HISTORY_STEPS,
    '/settings':  SETTINGS_STEPS,
  };
  return map[pathname] ?? DASHBOARD_STEPS;
}

// ── Shared styling ────────────────────────────────────────────

const GLOBAL_OPTIONS = {
  skipBeacon:      true,
  showProgress:    true,
  buttons:         ['back', 'primary', 'skip'] as ('back' | 'close' | 'primary' | 'skip')[],
  overlayColor:    'rgba(0,0,0,0.65)',
  primaryColor:    '#0ea5e9',
  backgroundColor: '#101624',
  arrowColor:      '#101624',
  textColor:       '#94a3b8',
  zIndex:          9999,
  offset:          12,
  /** Extra space when scrolling a step target into view — keeps tooltips from hugging the viewport edge */
  scrollOffset:    48,
};

const STYLES = {
  tooltip: {
    borderRadius: '16px',
    border:       '1px solid #1f2d44',
    padding:      '20px 24px',
    maxWidth:     '360px',
    fontSize:     '13px',
    lineHeight:   '1.6',
  },
  tooltipTitle: {
    fontSize:     '14px',
    fontWeight:   '600',
    color:        '#ffffff',
    marginBottom: '8px',
  },
  tooltipContent: {
    padding: '4px 0 8px',
    color:   '#94a3b8',
  },
  tooltipFooter: {
    marginTop: '16px',
    gap:       '8px',
  },
  /** Next + Done — Joyride v3 key is `buttonPrimary` (not `buttonNext`); default text color follows tooltip bg and reads as black on cyan */
  buttonPrimary: {
    backgroundColor: '#0ea5e9',
    borderRadius:    '8px',
    fontSize:        '12px',
    fontWeight:      '600',
    padding:         '8px 16px',
    color:           '#ffffff',
    border:          'none',
    cursor:          'pointer',
    outline:         'none',
  },
  buttonBack: {
    color:    '#475569',
    fontSize: '12px',
  },
  buttonSkip: {
    color:    '#374151',
    fontSize: '12px',
  },
};

// ── Component ─────────────────────────────────────────────────

export function ProductTour({ run, onFinish }: ProductTourProps) {
  const { resolved } = useTheme();
  const steps = useRouteSteps();
  const isLight = resolved === 'light';

  const options = useMemo(() => ({
    ...GLOBAL_OPTIONS,
    backgroundColor: isLight ? '#f8fafc' : '#101624',
    arrowColor:      isLight ? '#f8fafc' : '#101624',
    textColor:       isLight ? '#334155' : '#94a3b8',
  }), [isLight]);

  const styles = useMemo(() => ({
    ...STYLES,
    tooltip: {
      ...STYLES.tooltip,
      border: isLight ? '1px solid #cbd5e1' : '1px solid #1f2d44',
    },
    tooltipTitle: {
      ...STYLES.tooltipTitle,
      color: isLight ? '#0f172a' : '#ffffff',
    },
    tooltipContent: {
      ...STYLES.tooltipContent,
      color: isLight ? '#475569' : '#94a3b8',
    },
    buttonBack: {
      ...STYLES.buttonBack,
      color: isLight ? '#64748b' : '#475569',
    },
    buttonSkip: {
      ...STYLES.buttonSkip,
      color: isLight ? '#64748b' : '#374151',
    },
  }), [isLight]);

  const handleEvent = (data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      onFinish();
    }
  };

  return (
    <Joyride
      key={steps === DASHBOARD_STEPS ? 'dashboard' : steps === WATCHLIST_STEPS ? 'watchlist' : steps === HISTORY_STEPS ? 'history' : steps === SETTINGS_STEPS ? 'settings' : 'detail'}
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      options={options}
      styles={styles}
      locale={{
        back:  'Back',
        last:  'Done',
        next:  'Next',
        skip:  'Skip tour',
        close: 'Close',
        /** Shown on the primary button when `showProgress` is on — placeholders replaced by Joyride */
        nextWithProgress: (
          <span className="font-semibold text-white">Next</span>
        ),
      }}
      onEvent={handleEvent}
    />
  );
}
