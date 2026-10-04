import type { ActionErrorCode } from '../../types/game';

export function formatEuros(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatActionError(code: ActionErrorCode): { message: string; code: string } {
  const map: Record<ActionErrorCode, string> = {
    WRONG_PHASE: 'Action unavailable in current phase.',
    NOT_CURRENT_CANDIDATE: 'Only the active candidate can be drafted.',
    ALREADY_OWNED: 'This player is already on your roster.',
    POSITION_FULL: 'Your squad is already full for this position.',
    OVER_BUDGET: 'Insufficient budget to draft this player.',
    BUDGET_GUARD: 'Budget Guard: This action would leave insufficient funds or players to complete your squad.',
    NO_SKIPS_LEFT: 'No skips remaining this game.',
    ROSTER_INCOMPLETE: 'Your squad must have exactly 1 GK, 2 DEF, 2 MID, and 2 ATT.',
    REVEAL_NOT_COMPLETE: 'All 7 players must be revealed first.',
    REVEAL_ALREADY_COMPLETE: 'All 7 players are already revealed.',
    NOT_ON_ROSTER: 'This player is not currently on your roster.',
    YEAR_LIMIT: 'Simulation has reached Year 10.',
    SIMULATION_NOT_FINISHED: 'Simulation must reach Year 10 before ending.',
    NO_CANDIDATE: 'No candidate available in queue.',
  };

  return {
    message: map[code] || 'Action rejected.',
    code,
  };
}
