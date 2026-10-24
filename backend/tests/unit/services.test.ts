import { describe, expect, it } from 'vitest';
import { calculateATR, calculateEMA, calculateRSI, calculateVolumeSMA, computeIndicators } from '../../src/indicators/technical';
import { PositionSizingService } from '../../src/services/PositionSizingService';
import { SetupScoringService } from '../../src/services/SetupScoringService';
import { isEntryWindowOver } from '../../src/strategies/strategyConfig';
import { entryZonePayload, newSetupPayload, newSetupsDigestPayload } from '../../src/services/notificationMessages';
import { StrategyResult, TradeSetup } from '../../src/types';
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
  const setup = (symbol: string): TradeSetup => ({
    id: `id-${symbol}`, symbol, strategy: 'REVERSAL', direction: 'LONG', entry: 100, stop: 95, target: 112.5,
    confidence: 75, riskReward: 2.5, detectedAt: 0, status: 'ACTIVE', notes: '', stockSuggestion: null as unknown as TradeSetup['stockSuggestion'],
    optionsSuggestion: null, exitPrice: null, realizedPnl: null, closedAt: null, entryHitAt: null, stopHitAt: null, targetHitAt: null,
    pnlEstimate: null, score: 80, rank: null, entryInstruction: '', invalidationInstruction: '', targetInstruction: '',
  });

  it('links a single setup notification to its detail page', () => {
    expect(newSetupPayload(setup('INTC'))).toMatchObject({ title: '🎯 INTC — REVERSAL', data: { setupId: 'id-INTC', type: 'NEW_SETUP' } });
  });

  it('summarizes several setups in one digest with no setup link', () => {
    const p = newSetupsDigestPayload(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(setup));
    expect(p.title).toBe('🎯 7 new setups');
    expect(p.body).toBe('A, B, C, D, E +2 more · tap to review');
    expect(p.data).toEqual({ type: 'NEW_SETUPS' });
  });

  it('includes the live price in entry-zone alerts', () => {
    expect(entryZonePayload(setup('ANET'), 101.2).body).toContain('Current $101.2');
  });
});
