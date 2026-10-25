import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BarView, TradeRules, TradeState, applyBar, initialTradeState, isTerminal, rMultiple } from '../../src/trading/tradeStateMachine';
import { EXIT_PLANS, ExitPlan } from '../../src/strategies/strategyConfig';
import { DEFAULT_CONFIG, barDate, simulateSymbol } from '../../src/backtest/simulate';
import { MockDataProvider } from '../../src/providers/MockDataProvider';
import { ReversalStrategy } from '../../src/strategies/ReversalStrategy';
import { computeIndicators } from '../../src/indicators/technical';
import { LIQUID_UNIVERSE } from '../../src/config/universe';
import { OHLC, RegimeSnapshot } from '../../src/types';

const RULES: TradeRules = { entryWindowDays: 3, maxChasePct: 0.01, slippagePct: 0 };
const PLAN: ExitPlan = { maxHoldDays: 10 };
const final = { final: true, atr: 2 };
const partial = { final: false, atr: 2 };

const DATES = ['2025-01-06', '2025-01-07', '2025-01-08', '2025-01-09', '2025-01-10', '2025-01-13', '2025-01-14'];
const bar = (i: number, open: number, high: number, low: number, close: number): BarView => ({ date: DATES[i], open, high, low, close });
/** Entry 100, stop 95, target 110 — waiting for its first session. */
const pending = (plan: ExitPlan = PLAN): TradeState => initialTradeState(100, 95, 110, plan);

function run(bars: BarView[], plan: ExitPlan = PLAN, state: TradeState = pending(plan)): TradeState {
  return bars.reduce((s, b) => applyBar(s, b, plan, RULES, final), state);
}

describe('fills', () => {
  it('fills when the high touches the entry, at the entry', () => {
    expect(run([bar(0, 99, 101, 98, 100)])).toMatchObject({ phase: 'OPEN', fillPrice: 100, fillDate: DATES[0], sessionsHeld: 1 });
  });

  it('fills at the open when it opens above the entry but within the 1% chase limit', () => {
    expect(run([bar(0, 100.5, 102, 100, 101)]).fillPrice).toBe(100.5);
  });

  it('skips when the open gaps more than 1% above the entry, even if price returns later', () => {
    const s = run([bar(0, 101.5, 102, 99, 100), bar(1, 99, 101, 98, 100)]);
    expect(s).toMatchObject({ phase: 'SKIPPED', exitDate: DATES[0], fillPrice: null });
  });

  it('expires after exactly 3 sessions without a fill', () => {
    const miss = (i: number) => bar(i, 98, 99, 97, 98);
    expect(run([miss(0), miss(1)])).toMatchObject({ phase: 'PENDING', sessionsWaited: 2 });
    expect(run([miss(0), miss(1), miss(2)])).toMatchObject({ phase: 'EXPIRED', exitDate: DATES[2] });
  });

  it('a fill on the last window session is not expired', () => {
    const miss = (i: number) => bar(i, 98, 99, 97, 98);
    expect(run([miss(0), miss(1), bar(2, 99, 101, 98, 100)]).phase).toBe('OPEN');
  });

  it('applies slippage to the fill', () => {
    const s = applyBar(pending(), bar(0, 99, 101, 98, 100), PLAN, { ...RULES, slippagePct: 0.01 }, final);
    expect(s.fillPrice).toBeCloseTo(101);
  });
});

describe('exits', () => {
  const filled = () => run([bar(0, 99, 101, 98, 100)]);

  it('stops out on a stop touch, and a bar touching both stop and target counts as a stop', () => {
    expect(run([bar(1, 99, 100, 94, 96)], PLAN, filled())).toMatchObject({ phase: 'CLOSED', exitReason: 'STOP', exitPrice: 95, sessionsHeld: 2 });
    expect(run([bar(1, 100, 111, 94, 105)], PLAN, filled()).exitReason).toBe('STOP');
  });

  it('fills gaps through the stop or the target at the open', () => {
    expect(run([bar(1, 92, 93, 90, 91)], PLAN, filled())).toMatchObject({ exitReason: 'STOP', exitPrice: 92 });
    expect(run([bar(1, 113, 115, 112, 114)], PLAN, filled())).toMatchObject({ exitReason: 'TARGET', exitPrice: 113 });
  });

  it('on the fill day, a stop touch counts but the target only counts on a close above it', () => {
    expect(run([bar(0, 99, 101, 94, 100)])).toMatchObject({ phase: 'CLOSED', exitReason: 'STOP', sessionsHeld: 1 });
    expect(run([bar(0, 99, 112, 98, 105)]).phase).toBe('OPEN');
    expect(run([bar(0, 99, 112, 98, 111)])).toMatchObject({ exitReason: 'TARGET', exitPrice: 110 });
  });

  it('time-exits at the close of the last allowed session (the fill day counts as one)', () => {
    const plan = { maxHoldDays: 3 };
    const s = run([bar(0, 99, 101, 98, 100), bar(1, 100, 102, 99, 101), bar(2, 101, 103, 100, 102)], plan);
    expect(s).toMatchObject({ phase: 'CLOSED', exitReason: 'TIME', exitPrice: 102, sessionsHeld: 3 });
  });

  it('with no fixed target, never takes profit at a level', () => {
    const plan = { maxHoldDays: 10, targetR: null };
    expect(run([bar(0, 99, 101, 98, 100), bar(1, 101, 150, 100, 149)], plan)).toMatchObject({ phase: 'OPEN', target: null });
  });

  it('trails the stop after the close, effective next session, labels the exit TRAIL_STOP, and never lowers it', () => {
    const plan = { maxHoldDays: 40, targetR: null, trailAtrMult: 2 };
    const s1 = run([bar(0, 99, 101, 98, 100), bar(1, 101, 110, 100, 109)], plan);
    expect(s1.stop).toBe(106); // 110 − 2 × ATR 2
    const s2 = run([bar(2, 108, 109, 107, 108)], plan, s1);
    expect(s2.stop).toBe(106); // highest is still 110
    expect(run([bar(3, 107, 108, 105, 106)], plan, s2)).toMatchObject({ exitReason: 'TRAIL_STOP', exitPrice: 106 });
  });

  it('does not trail without ATR', () => {
    const plan = { maxHoldDays: 40, targetR: null, trailAtrMult: 2 };
    const s = [bar(0, 99, 101, 98, 100), bar(1, 101, 110, 100, 109)].reduce((st, b) => applyBar(st, b, plan, RULES, { final: true, atr: NaN }), pending(plan));
    expect(s.stop).toBe(95);
  });

  it('moves the stop to break-even once the high reaches the trigger', () => {
    const plan = { maxHoldDays: 10, breakevenAtR: 1 };
    const s = run([bar(0, 99, 101, 98, 100), bar(1, 101, 106, 100, 105), bar(2, 104, 104, 99, 100)], plan);
    expect(s).toMatchObject({ exitReason: 'TRAIL_STOP', exitPrice: 100 });
    expect(rMultiple(s)).toBe(0);
  });

  it('exits on a close above the SMA (not on the fill day)', () => {
    const plan = { maxHoldDays: 10, targetR: null, exitAboveSma: 3 };
    const s0 = applyBar(pending(plan), bar(0, 99, 101, 98, 100), plan, RULES, { final: true, atr: 2, smaClose: 90 });
    expect(s0.phase).toBe('OPEN');
    const s1 = applyBar(s0, bar(1, 100, 103, 99, 102), plan, RULES, { final: true, atr: 2, smaClose: 101 });
    expect(s1).toMatchObject({ exitReason: 'SMA', exitPrice: 102 });
  });

  it('computes R against the risk at the actual fill', () => {
    expect(rMultiple(run([bar(1, 101, 111, 100, 109)], PLAN, run([bar(0, 99, 101, 98, 100)])))).toBe(2);
    expect(rMultiple(pending())).toBeNull();
  });
});

describe('partial (intraday) bars', () => {
  it('fills and stops intraday, but defers target, time exit and stop adjustments to the final bar', () => {
    const plan = { maxHoldDays: 1, trailAtrMult: 2 };
    const filled = applyBar(pending(plan), bar(0, 99, 101, 98, 100.5), plan, RULES, partial);
    expect(filled).toMatchObject({ phase: 'OPEN', sessionsHeld: 0, highest: null, stop: 95, managedThrough: null });

    // Target touched on a later day stays open until the final bar confirms the stop was not also hit.
    const onDay1 = run([bar(0, 99, 101, 98, 100)], { maxHoldDays: 10 });
    expect(applyBar(onDay1, bar(1, 101, 111, 100, 109), { maxHoldDays: 10 }, RULES, partial).phase).toBe('OPEN');
    expect(applyBar(onDay1, bar(1, 101, 111, 100, 109), { maxHoldDays: 10 }, RULES, final).exitReason).toBe('TARGET');
  });

  it('treats a stop touch or a gap beyond the stop/target as final', () => {
    const open = run([bar(0, 99, 101, 98, 100)]);
    expect(applyBar(open, bar(1, 99, 100, 94.5, 96), PLAN, RULES, partial)).toMatchObject({ phase: 'CLOSED', exitReason: 'STOP', sessionsHeld: 2 });
    expect(applyBar(open, bar(1, 113, 113, 113, 113), PLAN, RULES, partial)).toMatchObject({ exitReason: 'TARGET', exitPrice: 113 });
    expect(applyBar(pending(), bar(0, 102, 102, 102, 102), PLAN, RULES, partial).phase).toBe('SKIPPED');
  });

  it('never expires a setup on a partial bar', () => {
    const s = [0, 1].reduce((st, i) => applyBar(st, bar(i, 98, 99, 97, 98), PLAN, RULES, final), pending());
    expect(applyBar(s, bar(2, 98, 99, 97, 98), PLAN, RULES, partial)).toMatchObject({ phase: 'PENDING', sessionsWaited: 2 });
  });

  it('an intraday fill followed by that day\'s final bar does not fill twice, and still applies fill-day rules', () => {
    const intraday = applyBar(pending(), bar(0, 99, 100.2, 98.5, 100.1), PLAN, RULES, partial);
    const closed = applyBar(intraday, bar(0, 99, 101, 94, 100), PLAN, RULES, final);
    expect(closed).toMatchObject({ phase: 'CLOSED', exitReason: 'STOP', fillPrice: 100, sessionsHeld: 1 });
  });
});

describe('idempotency', () => {
  it('ignores a final bar that was already applied, and bars on or before it', () => {
    const plan = { maxHoldDays: 40, targetR: null, trailAtrMult: 2 };
    const s = run([bar(0, 99, 101, 98, 100), bar(1, 101, 110, 100, 109)], plan);
    expect(applyBar(s, bar(1, 101, 110, 100, 109), plan, RULES, final)).toBe(s);
    expect(applyBar(s, bar(0, 99, 101, 50, 100), plan, RULES, partial)).toBe(s);
  });

  it('leaves terminal states untouched', () => {
    const closed = run([bar(0, 99, 101, 94, 100)]);
    expect(isTerminal(closed)).toBe(true);
    expect(applyBar(closed, bar(1, 1, 1000, 1, 500), PLAN, RULES, final)).toBe(closed);
  });
});

describe('parity: live stepping (partial snapshots + final bar) matches the backtest', () => {
  beforeAll(() => { process.env.MOCK_MARKET_TIME = '2026-10-23T20:30:00Z'; });
  afterAll(() => { delete process.env.MOCK_MARKET_TIME; });

  /** Monotone intraday snapshots of a finished bar: the range widens toward the final high/low. */
  function snapshots(b: OHLC): BarView[] {
    const date = barDate(b);
    return [0.25, 0.6, 1].map(f => ({
      date,
      open: b.open,
      high: b.open + (b.high - b.open) * f,
      low: b.open - (b.open - b.low) * f,
      close: b.open + (b.close - b.open) * f,
    }));
  }

  it('produces identical outcomes for every Reversal signal across 40 mock symbols', async () => {
    const provider = new MockDataProvider();
    const strategy = new ReversalStrategy();
    const cfg = { ...DEFAULT_CONFIG, exits: EXIT_PLANS };
    const rules: TradeRules = { entryWindowDays: cfg.entryWindowDays, maxChasePct: cfg.maxChasePct, slippagePct: cfg.slippagePct };
    const plan = EXIT_PLANS.REVERSAL;
    let compared = 0;

    for (const symbol of LIQUID_UNIVERSE.slice(0, 40)) {
      const bars = await provider.getHistoricalPrices(symbol, 500);
      const regimes = new Map(bars.map(b => [barDate(b), { regime: 'RANGING' } as RegimeSnapshot]));
      const trades = simulateSymbol(symbol, bars, regimes, [strategy], cfg);

      for (const t of trades) {
        const signalIdx = bars.findIndex(b => barDate(b) === t.signalDate);
        const window = bars.slice(signalIdx - cfg.windowBars + 1, signalIdx + 1);
        const atr = computeIndicators(window).atr14.at(-1)!;
        let state = initialTradeState(t.entry, t.stop, t.target, plan);
        for (let k = signalIdx + 1; k < bars.length && !isTerminal(state); k++) {
          for (const snap of snapshots(bars[k])) state = applyBar(state, snap, plan, rules, { final: false, atr });
          const b = bars[k];
          state = applyBar(state, { date: barDate(b), open: b.open, high: b.high, low: b.low, close: b.close }, plan, rules, { final: true, atr });
        }

        const outcome = state.phase === 'SKIPPED' ? 'GAP_SKIP' : state.phase === 'EXPIRED' ? 'NO_FILL'
          : state.phase === 'PENDING' || state.phase === 'OPEN' ? 'OPEN'
          : state.exitReason === 'TARGET' ? 'TARGET' : state.exitReason === 'TIME' ? 'TIMEOUT' : 'STOP';
        expect({ symbol, signal: t.signalDate, outcome, fillDate: state.fillDate ?? undefined, exitDate: state.phase === 'CLOSED' ? state.exitDate : undefined })
          .toEqual({ symbol, signal: t.signalDate, outcome: t.outcome, fillDate: t.fillDate, exitDate: t.exitDate });
        if (t.rMultiple !== undefined) expect(Math.round(rMultiple(state)! * 1000) / 1000).toBe(t.rMultiple);
        if (t.holdDays !== undefined) expect(state.sessionsHeld).toBe(t.holdDays);
        compared++;
      }
    }
    // Guard against a vacuous pass.
    expect(compared).toBeGreaterThan(100);
  });
});
