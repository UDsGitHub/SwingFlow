/** Pure trade arithmetic and input validation shared by the trade API. */

/** Realized P&L of a long position, to the cent. */
export function realizedPnl(entryPrice: number, exitPrice: number, shares: number): number {
  return Math.round((exitPrice - entryPrice) * shares * 100) / 100;
}

export function validatePrice(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

export function validateShares(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

