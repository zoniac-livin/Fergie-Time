export const RANK_THRESHOLDS = {
  MASTER_NEGOTIATOR: 500_000_000,
  TRANSFER_STRATEGIST: 200_000_000,
} as const;

export type InvestorRank = 'MASTER NEGOTIATOR' | 'TRANSFER STRATEGIST' | 'RELEGATION FODDER';

/**
 * Returns the investor tier based on total net worth.
 * Thresholds:
 *   > 500,000,000  -> 'MASTER NEGOTIATOR'
 *  >= 200,000,000  -> 'TRANSFER STRATEGIST'
 *   < 200,000,000  -> 'RELEGATION FODDER'
 */
export function rank(netWorth: number): InvestorRank {
  if (netWorth > RANK_THRESHOLDS.MASTER_NEGOTIATOR) {
    return 'MASTER NEGOTIATOR';
  }
  if (netWorth >= RANK_THRESHOLDS.TRANSFER_STRATEGIST) {
    return 'TRANSFER STRATEGIST';
  }
  return 'RELEGATION FODDER';
}

export const getRank = rank;

