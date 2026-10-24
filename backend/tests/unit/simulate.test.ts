import { describe, expect, it } from 'vitest';
import { BacktestConfig, BacktestTrade, DEFAULT_CONFIG, barDate, simulateSymbol } from '../../src/backtest/simulate';
import { BaseStrategy } from '../../src/strategies/BaseStrategy';
import { ExitPlan } from '../../src/strategies/strategyConfig';
import { Indicators, OHLC, RegimeSnapshot, StrategyResult, StrategyType } from '../../src/types';
import { barsFrom } from '../helpers/bars';

type Row = [number, number, number, number];

/** Triggers on the chosen bar indexes with fixed levels: entry 100, stop 95, target 110. */
class StubStrategy extends BaseStrategy {
  readonly name: string;
  constructor(private signalTimestamps: Set<number>, private strategy: StrategyType = 'REVERSAL') {
    super();
    this.name = strategy;
  }
  evaluate(_symbol: string, window: OHLC[], _indicators: Indicators): StrategyResult {
    return {
      triggered: this.signalTimestamps.has(window[window.length - 1].timestamp),
      strategy: this.strategy, direction: 'LONG',
      entry: 100, stop: 95, target: 110, confidence: 75, notes: '', checks: {}, explanation: '',
    };
  }
}

const WARMUP: Row = [98, 99, 97, 98];
const CFG: BacktestConfig = { ...DEFAULT_CONFIG, windowBars: 5, slippagePct: 0 };

function regimes(bars: OHLC[], regime: RegimeSnapshot['regime'] = 'RANGING'): Map<string, RegimeSnapshot> {
  return new Map(bars.map(b => [barDate(b), { regime } as RegimeSnapshot]));
}

/** 5 warm-up bars (signal on the 5th), then the scenario bars. */
function run(path: Row[], exits?: Partial<ExitPlan>, cfg: Partial<BacktestConfig> = {}): BacktestTrade {
  const bars = barsFrom([...Array(5).fill(WARMUP), ...path]);
  const strategy = new StubStrategy(new Set([bars[4].timestamp]));
  const trades = simulateSymbol('X', bars, regimes(bars), [strategy], {
    ...CFG, ...cfg, exits: exits ? { REVERSAL: exits } : undefined,
  });
  expect(trades).toHaveLength(1);
  return trades[0];
}

describe('simulateSymbol — fills', () => {
  it('fills a buy-stop when the high reaches the entry', () => {
    const t = run([[99, 101, 98, 100], [101, 111, 100, 109]]);
    expect(t).toMatchObject({ outcome: 'TARGET', fillPrice: 100, exitPrice: 110, rMultiple: 2, holdDays: 2 });
  });

  it('fills at the open when the open is above the entry but within the chase limit', () => {
    const t = run([[100.5, 102, 100, 101], [101, 111, 100, 109]]);
    expect(t.fillPrice).toBe(100.5);
  });

  it('skips the trade when the open gaps more than 1% above the entry', () => {
    expect(run([[102, 104, 101, 103]]).outcome).toBe('GAP_SKIP');
  });

  it('expires unfilled after the entry window', () => {
    expect(run(Array(4).fill(WARMUP)).outcome).toBe('NO_FILL');
  });

  it('reports OPEN when the data ends inside the entry window', () => {
    expect(run([WARMUP]).outcome).toBe('OPEN');
  });

  it('applies slippage to the fill and the exit', () => {
    const t = run([[99, 101, 98, 100], [101, 111, 100, 109]], undefined, { slippagePct: 0.01 });
    expect(t.fillPrice).toBeCloseTo(101, 2);
    expect(t.exitPrice).toBeCloseTo(108.9, 2);
  });
});

describe('simulateSymbol — exits', () => {
  it('stops out when the low touches the stop', () => {
    expect(run([[99, 101, 98, 100], [99, 100, 94, 96]])).toMatchObject({ outcome: 'STOP', exitPrice: 95, rMultiple: -1 });
  });

  it('counts a bar touching both stop and target as a stop (conservative)', () => {
    expect(run([[99, 101, 98, 100], [100, 111, 94, 105]]).outcome).toBe('STOP');
  });

  it('fills a gap through the stop at the open', () => {
    expect(run([[99, 101, 98, 100], [92, 93, 90, 91]])).toMatchObject({ outcome: 'STOP', exitPrice: 92, rMultiple: -1.6 });
  });

  it('fills a gap through the target at the open', () => {
    expect(run([[99, 101, 98, 100], [113, 115, 112, 114]])).toMatchObject({ outcome: 'TARGET', exitPrice: 113 });
  });

  it('on the fill day, only counts the target when the close is above it', () => {
    expect(run([[99, 112, 98, 105], [105, 106, 104, 105]], undefined, { maxHoldDays: 2 }).outcome).toBe('TIMEOUT');
    expect(run([[99, 112, 98, 111]]).outcome).toBe('TARGET');
  });

  it('time-exits at the close after the max hold', () => {
    expect(run([[99, 101, 98, 100], [100, 102, 99, 101], [101, 103, 100, 102]], undefined, { maxHoldDays: 3 }))
      .toMatchObject({ outcome: 'TIMEOUT', exitPrice: 102, holdDays: 3 });
  });

  it('uses the exit plan\'s max hold over the default', () => {
    const path: Row[] = [[99, 101, 98, 100], ...Array(6).fill([100, 102, 99, 101] as Row)];
    expect(run(path, { maxHoldDays: 4 }).holdDays).toBe(4);
  });

  it('targetR overrides the strategy target; null removes it', () => {
    const path: Row[] = [[99, 101, 98, 100], [101, 108, 100, 107], [107, 108, 106, 107]];
    expect(run(path, { maxHoldDays: 3, targetR: 1.5 })).toMatchObject({ outcome: 'TARGET', exitPrice: 107.5 });
    expect(run([[99, 101, 98, 100], [101, 120, 100, 119]], { maxHoldDays: 2, targetR: null }).outcome).toBe('TIMEOUT');
  });

  it('trails the stop below the highest high by a multiple of ATR, taking effect the next bar', () => {
    // ATR needs 15+ bars, so use a 20-bar window of warm-ups with a 2-point range (ATR = 2).
    const bars = barsFrom([...Array(20).fill(WARMUP), [99, 101, 98, 100], [101, 110, 100, 109], [108, 109, 105, 106]]);
    const strategy = new StubStrategy(new Set([bars[19].timestamp]));
    const [t] = simulateSymbol('X', bars, regimes(bars), [strategy], {
      ...CFG, windowBars: 20, exits: { REVERSAL: { maxHoldDays: 40, targetR: null, trailAtrMult: 2 } },
    });
    // High of 110 raises the stop to 110 − 2×2 = 106 for the next bar, whose low of 105 hits it.
    expect(t).toMatchObject({ outcome: 'STOP', exitPrice: 106, rMultiple: 1.2 });
  });

  it('does not trail when ATR is unavailable', () => {
    const t = run([[99, 101, 98, 100], [101, 110, 100, 109], [108, 109, 105, 106]], { maxHoldDays: 40, targetR: null, trailAtrMult: 2 });
    expect(t.outcome).toBe('OPEN');
  });

  it('moves the stop to break-even once the high reaches the trigger', () => {
    const t = run([[99, 101, 98, 100], [101, 106, 100, 105], [104, 104, 99, 100]], { maxHoldDays: 10, breakevenAtR: 1 });
    expect(t).toMatchObject({ outcome: 'STOP', exitPrice: 100, rMultiple: 0 });
  });

  it('exits at the close once it is above the N-day average', () => {
    const t = run([[99, 101, 98, 100], [100, 103, 99, 102]], { maxHoldDays: 10, targetR: null, exitAboveSma: 3 });
    expect(t).toMatchObject({ outcome: 'TARGET', exitPrice: 102, holdDays: 2 });
  });
});

describe('simulateSymbol — sizing and streams', () => {
  it('sizes from the planned risk and caps shares at buying power', () => {
    // $5000 × 1.5% = $75 risk / $5 per share = 15 shares; 15 × $100 fits in the account.
    expect(run([[99, 101, 98, 100], [101, 111, 100, 109]]).shares).toBe(15);
    const capped = run([[99, 101, 98, 100], [101, 111, 100, 109]], undefined, { riskPercent: 50 });
    expect(capped.shares).toBe(50); // 500 by risk, capped to floor(5000 / 100)
  });

  it('allows one open setup per strategy: signals during an open trade are ignored', () => {
    const bars = barsFrom([...Array(5).fill(WARMUP), [99, 101, 98, 100], [100, 102, 99, 101], [101, 111, 100, 109]]);
    const strategy = new StubStrategy(new Set([bars[4].timestamp, bars[5].timestamp, bars[6].timestamp]));
    const trades = simulateSymbol('X', bars, regimes(bars), [strategy], CFG);
    expect(trades).toHaveLength(1);
  });

  it('marks regime-blocked signals as ungated-only', () => {
    const bars = barsFrom([...Array(5).fill(WARMUP), [99, 101, 98, 100], [101, 111, 100, 109]]);
    const strategy = new StubStrategy(new Set([bars[4].timestamp]), 'TREND_PULLBACK');
    const [t] = simulateSymbol('X', bars, regimes(bars, 'RANGING'), [strategy], CFG);
    expect(t).toMatchObject({ allowedByRegime: false, inUngated: true, inGated: false });
  });

  it('skips days with no regime reading', () => {
    const bars = barsFrom([...Array(5).fill(WARMUP), [99, 101, 98, 100]]);
    const strategy = new StubStrategy(new Set([bars[4].timestamp]));
    expect(simulateSymbol('X', bars, new Map(), [strategy], CFG)).toHaveLength(0);
  });
});
