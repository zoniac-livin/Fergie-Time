import type { GamePhase } from '../../types/game';

/**
 * Maps each game phase to its canonical URL route.
 */
export function getRouteForPhase(phase: GamePhase): string {
  switch (phase) {
    case 'DRAFT':
      return '/draft';
    case 'REVEAL':
      return '/reveal';
    case 'SIMULATION':
      return '/sim';
    case 'ENDGAME':
      return '/results';
  }
}

/**
 * Pure route guard helper.
 * If currentPhase is not the expectedPhase, returns the redirect destination route.
 * If currentPhase matches expectedPhase, returns null (no redirect needed).
 */
export function getGuardRedirect(
  currentPhase: GamePhase,
  expectedPhase: GamePhase
): string | null {
  if (currentPhase === expectedPhase) {
    return null;
  }
  return getRouteForPhase(currentPhase);
}
