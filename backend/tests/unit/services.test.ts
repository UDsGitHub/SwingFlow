import { describe, expect, it } from 'vitest';
import { calculateATR, calculateEMA, calculateRSI, calculateVolumeSMA, computeIndicators } from '../../src/indicators/technical';
import { PositionSizingService } from '../../src/services/PositionSizingService';
import { SetupScoringService } from '../../src/services/SetupScoringService';
import { isEntryWindowOver } from '../../src/strategies/strategyConfig';
import { DigestInput, dailyDigestPayload, fillPayload, newSetupPayload } from '../../src/services/notificationMessages';
import { makeSetup } from '../helpers/setup';
import { StrategyResult } from '../../src/types';
import { barsFrom, barsFromCloses } from '../helpers/bars';

describe('technical indicators', () => {
  it('EMA seeds with the SMA and is NaN before the period', () => {
    const ema = calculateEMA([1, 2, 3, 4, 5], 3);
    expect(ema.slice(0, 2).every(Number.isNaN)).toBe(true);
    expect(ema[2]).toBe(2);
    expect(ema[3]).toBe(3);
    expect(ema[4]).toBe(4);
  });

  it('RSI is 100 for a series that only rises and 0 for one that only falls', () => {
    expect(calculateRSI(Array.from({ length: 20 }, (_, i) => i), 14).at(-1)).toBe(100);
    expect(calculateRSI(Array.from({ length: 20 }, (_, i) => 20 - i), 14).at(-1)).toBe(0);
  });

  it('RSI is a neutral 50 for a flat series', () => {
    expect(calculateRSI(Array(20).fill(100), 14).at(-1)).toBe(50);
  });

  it('ATR averages the true range, including gaps', () => {
    const bars = barsFrom(Array.from({ length: 16 }, () => [100, 101, 99, 100] as [number, number, number, number]));
    expect(calculateATR(bars, 14).at(-1)).toBeCloseTo(2);
    const gapped = [...bars, ...barsFrom([[110, 111, 109, 110]], '2025-02-10')];
    // True range of the gap bar = 111 − 100 = 11 → Wilder smoothing: (2·13 + 11) / 14
    expect(calculateATR(gapped, 14).at(-1)).toBeCloseTo((2 * 13 + 11) / 14);
  });

  it('volume SMA uses the last N bars', () => {
    const bars = barsFrom(Array.from({ length: 25 }, () => [1, 1, 1, 1] as [number, number, number, number]), '2025-01-06', 10);
    bars[24].volume = 210;
    expect(calculateVolumeSMA(bars, 20)).toBe((19 * 10 + 210) / 20);
  });

  it('computeIndicators returns aligned series', () => {
    const ind = computeIndicators(barsFromCloses(Array.from({ length: 60 }, (_, i) => 100 + i)));
    expect(ind.ema20).toHaveLength(60);
    expect(ind.rsi14).toHaveLength(60);
    expect(ind.ema20.at(-1)!).toBeGreaterThan(ind.ema50.at(-1)!);
  });
});

describe('PositionSizingService', () => {
  it('sizes shares so a stop-out loses the risk budget', () => {
    const s = new PositionSizingService().calculate({ entry: 187.5, stop: 183.2, target: 198.4, accountSize: 5000, riskPercent: 1.5 });
    expect(s).toEqual({ shares: 17, capitalRequired: 3187.5, riskDollars: 75, potentialGainDollars: 185.3 });
  });
});

describe('SetupScoringService', () => {
  const result = (confidence: number, checks: number, rr: number): StrategyResult => ({
    triggered: true, strategy: 'REVERSAL', direction: 'LONG', entry: 100, stop: 95, target: 100 + 5 * rr,
    confidence, notes: '', explanation: '', checks: Object.fromEntries(Array.from({ length: checks }, (_, i) => [`c${i}`, true])),
  });

  it('combines confidence, passed checks and risk/reward, capped at 100', () => {
    expect(new SetupScoringService().score(result(70, 5, 2.5))).toBe(Math.round(70 * 0.65 + 15 + 13));
    expect(new SetupScoringService().score(result(100, 10, 5))).toBe(100);
  });
});

describe('isEntryWindowOver', () => {
  const sessions = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'];

  it('expires once 3 sessions have passed after the signal', () => {
    expect(isEntryWindowOver('2026-10-20', sessions)).toBe(true);
    expect(isEntryWindowOver('2026-10-21', sessions)).toBe(false);
    expect(isEntryWindowOver('2026-10-23', sessions)).toBe(false);
  });
});

describe('notification payloads', () => {
  it('links a single new setup to its detail page and describes a trailing exit', () => {
    expect(newSetupPayload(makeSetup({ symbol: 'INTC' }))).toMatchObject({
      title: '🎯 INTC — REVERSAL',
      body: 'Entry $100.00 · Stop $95.00 · trailing stop · 75% confidence',
      data: { setupId: 'id-INTC', type: 'NEW_SETUP' },
    });
    expect(newSetupPayload(makeSetup({ exitPlan: { maxHoldDays: 10 } })).body).toContain('Target $112.50');
  });

  it('announces a fill with its stop and links to the setup', () => {
    expect(fillPayload({ setupId: 's1', symbol: 'AXP', fillPrice: 98.35, stop: 93.94 })).toEqual({
      title: '🟢 AXP triggered at $98.35',
      body: 'Entry hit · stop $93.94. If you took it, record your fill in SwingFlow.',
      data: { setupId: 's1', type: 'SETUP_FILLED' },
    });
  });
});

describe('dailyDigestPayload', () => {
  const empty: DigestInput = { newSetups: [], fills: [], closes: [], stopRaises: [] };

  it('sends nothing on a quiet day', () => {
    expect(dailyDigestPayload(empty)).toBeNull();
  });

  it('uses the regular deep-linked push for a lone new setup', () => {
    expect(dailyDigestPayload({ ...empty, newSetups: [makeSetup()] })?.data).toEqual({ setupId: 'id-AXP', type: 'NEW_SETUP' });
  });

  it('bundles everything else into one push that opens the dashboard, stop raises first', () => {
    const p = dailyDigestPayload({
      newSetups: ['A', 'B', 'C', 'D', 'E'].map(symbol => makeSetup({ symbol })),
      fills: [{ symbol: 'CB', fillPrice: 232.3 }],
      closes: [{ symbol: 'MSFT', r: 1.84, reason: 'TRAIL_STOP' }, { symbol: 'T', r: -1, reason: 'STOP' }],
      stopRaises: [{ symbol: 'AXP', stop: 97.1 }],
    })!;
    expect(p.title).toBe('SwingFlow · after the close');
    expect(p.body).toBe('Raise stop: AXP → $97.10 · 5 new setups: A, B, C, D +1 more · Triggered: CB at $232.30 · Closed: MSFT +1.8R (trailing stop), T −1.0R (stop)');
    expect(p.data).toEqual({ type: 'DAILY_DIGEST' });
  });
});
