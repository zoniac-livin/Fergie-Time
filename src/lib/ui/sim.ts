import type { PlayerProfile } from '../../types/game';

export type FocusTarget =
  | { kind: 'SELL'; playerId: string }
  | { kind: 'NEXT_YEAR' };

/**
 * Pure function: computes the next element to focus after a player is sold.
 * Given the remaining player order and the sold player's original index:
 * - If remaining player order is empty, returns NEXT_YEAR.
 * - Otherwise, returns the SELL target for the player now occupying soldIndex,
 *   or the last player if soldIndex is beyond the end.
 */
export function getNextFocusTarget(
  remainingPlayers: readonly { id: string }[],
  soldIndex: number
): FocusTarget {
  if (remainingPlayers.length === 0) {
    return { kind: 'NEXT_YEAR' };
  }
  const targetIndex = soldIndex < remainingPlayers.length ? soldIndex : remainingPlayers.length - 1;
  return { kind: 'SELL', playerId: remainingPlayers[targetIndex].id };
}

/**
 * Pure function: given the full roster before sale and the sold player ID,
 * computes the next focus target (SELL target or NEXT_YEAR).
 */
export function getNextFocusTargetAfterSale(
  rosterBeforeSale: readonly { id: string }[],
  soldPlayerId: string
): FocusTarget {
  const soldIndex = rosterBeforeSale.findIndex((p) => p.id === soldPlayerId);
  const remaining = rosterBeforeSale.filter((p) => p.id !== soldPlayerId);
  return getNextFocusTarget(remaining, soldIndex >= 0 ? soldIndex : 0);
}

/**
 * Pure function: determines whether confirm state should remain open when the year changes.
 * Returns false whenever previousYear !== currentYear.
 * Preserves the current confirm state if the year did not change.
 */
export function resetConfirmOnYearChange(
  currentConfirmOpen: boolean,
  previousYear: number,
  currentYear: number
): boolean {
  if (previousYear !== currentYear) {
    return false;
  }
  return currentConfirmOpen;
}

/**
 * Pure function: returns true if a year transition has occurred that requires resetting confirm state.
 */
export function shouldResetConfirm(
  previousYear: number,
  currentYear: number
): boolean {
  return previousYear !== currentYear;
}

/**
 * Pure function: returns roster players in fixed positional order: GK, DEF, MID, ATT.
 */
export function getOrderedRosterPlayers(roster: {
  GK: PlayerProfile[];
  DEF: PlayerProfile[];
  MID: PlayerProfile[];
  ATT: PlayerProfile[];
}): PlayerProfile[] {
  const result: PlayerProfile[] = [];
  for (const pos of ['GK', 'DEF', 'MID', 'ATT'] as const) {
    for (const p of roster[pos]) {
      result.push(p);
    }
  }
  return result;
}
