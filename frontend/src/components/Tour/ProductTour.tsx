import { Joyride, STATUS, EventData, Step } from 'react-joyride';

interface ProductTourProps {
  run: boolean;
  onFinish: () => void;
}

const STEPS: Step[] = [
  {
    target:    'body',
    placement: 'center',
    title: 'Welcome to SwingFlow',
    content: (
      <div>
        <p>SwingFlow scans your watchlist and surfaces high-probability swing trade setups — so you never have to watch charts all day.</p>
        <p style={{ marginTop: 8, opacity: 0.6, fontSize: 12 }}>This quick tour covers the key features. Takes about 60 seconds.</p>
      </div>
    ),
  },
  {
    target:    '#tour-scan',
    placement: 'bottom',
    title: 'Run a Scan',
    content: 'Click "Scan Now" to run the strategy engine across your watchlist. It checks three strategies — Trend Pullback, Breakout, and Oversold Reversal — and returns only setups that pass all criteria.',
  },
  {
    target:    '#tour-market',
    placement: 'bottom',
    title: 'Market Overview',
    content: 'A quick pulse on every symbol in your watchlist: price change, trend direction, and RSI. Click any ticker to jump to the Watchlist view.',
  },
  {
    target:    '#tour-goal',
    placement: 'right',
    title: 'Daily Goal Tracker',
    content: 'Set your daily profit target in Settings. The pipeline bar fills as setups accumulate — three strong setups typically covers a $100/day goal on a $5,000 account with 1.5% risk per trade.',
  },
  {
    target:    '#tour-setups',
    placement: 'left',
    title: 'Trade Setups',
    content: 'Each card shows a ready-to-trade setup with entry, stop loss, and target pre-calculated. The colored stripe reflects confidence. Click any card to see the full trade plan, chart, and position sizing.',
  },
  {
    target:    '#tour-notifications',
    placement: 'bottom',
    title: 'Push Notifications',
    content: 'Enable browser push notifications here. SwingFlow will alert you when a new setup is detected — even if the tab is in the background.',
  },
  {
    target:    '#tour-sidebar',
    placement: 'right',
    title: 'Navigation',
    content: (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', lineHeight: 1.8 }}>
        <li><strong style={{ color: '#fff' }}>Dashboard</strong> — active setups and market overview</li>
        <li><strong style={{ color: '#fff' }}>Watchlist</strong> — add or remove symbols to scan</li>
        <li><strong style={{ color: '#fff' }}>History</strong> — all past setups with full detail</li>
        <li><strong style={{ color: '#fff' }}>Settings</strong> — account size, daily goal, risk %</li>
      </ul>
    ),
  },
  {
    target:    'body',
    placement: 'center',
    title: "You're all set",
    content: (
      <div>
        <p>Click <strong style={{ color: '#fff' }}>Scan Now</strong> to find your first setups — they'll appear on the dashboard within seconds.</p>
        <p style={{ marginTop: 8, opacity: 0.6, fontSize: 12 }}>You can replay this tour any time from the Settings page.</p>
      </div>
    ),
  },
];

const GLOBAL_OPTIONS = {
  skipBeacon:   true,
  showProgress: true,
  buttons:      ['back', 'primary', 'skip'] as ('back' | 'close' | 'primary' | 'skip')[],
  overlayColor: 'rgba(0,0,0,0.65)',
  primaryColor: '#0ea5e9',
  backgroundColor: '#101624',
  arrowColor:   '#101624',
  textColor:    '#94a3b8',
  zIndex:       9999,
  offset:       12,
};

const STYLES = {
  tooltip: {
    borderRadius: '16px',
    border:       '1px solid #1f2d44',
    padding:      '20px 24px',
    maxWidth:     '340px',
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
  buttonNext: {
    backgroundColor: '#0ea5e9',
    borderRadius:    '10px',
    fontSize:        '12px',
    fontWeight:      '600',
    padding:         '7px 16px',
    color:           '#fff',
    border:          'none',
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

export function ProductTour({ run, onFinish }: ProductTourProps) {
  const handleEvent = (data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      onFinish();
    }
  };

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      scrollToFirstStep
      options={GLOBAL_OPTIONS}
      styles={STYLES}
      locale={{
        back:  'Back',
        last:  'Done',
        next:  'Next',
        skip:  'Skip tour',
        close: 'Close',
      }}
      onEvent={handleEvent}
    />
  );
}
