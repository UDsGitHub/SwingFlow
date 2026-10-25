import { PaperExitReason, SetupStatus } from '../types';

export interface PaperRecord {
  /** Setups whose paper trade has closed (excludes setups that never filled). */
  closed: number;
  wins: number;
  winRate: number | null;
  /** Mean R per closed paper trade — the strategy's live edge. */
  expectancyR: number | null;
  avgHoldDays: number | null;
  open: number;
  waiting: number;
  expired: number;
  skipped: number;
}

export interface RealRecord {
  closed: number;
  open: number;
  wins: number;
  winRate: number | null;
  totalPnl: number;
}

interface PaperRow { status: SetupStatus; paper_r: number | null; paper_exit_reason: PaperExitReason | null; sessions_held: number | null }
interface TradeRow { status: 'OPEN' | 'CLOSED'; realized_pnl: number | null }

const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : null);

export function summarizePaper(rows: PaperRow[]): PaperRecord {
  const closed = rows.filter(r => r.status === 'CLOSED' && r.paper_r != null);
  const rs = closed.map(r => Number(r.paper_r));
  const wins = rs.filter(r => r > 0).length;
  return {
    closed: closed.length,
    wins,
    winRate: pct(wins, closed.length),
    expectancyR: closed.length ? rs.reduce((a, b) => a + b, 0) / closed.length : null,
    avgHoldDays: closed.length ? closed.reduce((a, r) => a + Number(r.sessions_held ?? 0), 0) / closed.length : null,
    open: rows.filter(r => r.status === 'TRIGGERED').length,
    waiting: rows.filter(r => r.status === 'ACTIVE').length,
    expired: rows.filter(r => r.status === 'EXPIRED').length,
    skipped: rows.filter(r => r.status === 'SKIPPED').length,
  };
}

export function summarizeReal(rows: TradeRow[]): RealRecord {
  const closed = rows.filter(r => r.status === 'CLOSED' && r.realized_pnl != null);
  const wins = closed.filter(r => Number(r.realized_pnl) > 0).length;
  return {
    closed: closed.length,
    open: rows.filter(r => r.status === 'OPEN').length,
    wins,
    winRate: pct(wins, closed.length),
    totalPnl: Math.round(closed.reduce((a, r) => a + Number(r.realized_pnl), 0) * 100) / 100,
  };
}
