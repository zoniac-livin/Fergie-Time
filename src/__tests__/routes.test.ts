import { describe, it, expect } from 'vitest';
import { getRouteForPhase, getGuardRedirect } from '../lib/ui/routes';
import type { GamePhase } from '../types/game';

describe('Route Guard Pure Functions', () => {
  describe('getRouteForPhase', () => {
    it('maps every phase to its canonical route', () => {
      expect(getRouteForPhase('DRAFT')).toBe('/draft');
      expect(getRouteForPhase('REVEAL')).toBe('/reveal');
      expect(getRouteForPhase('SIMULATION')).toBe('/sim');
      expect(getRouteForPhase('ENDGAME')).toBe('/results');
    });
  });

  describe('getGuardRedirect', () => {
    const phases: GamePhase[] = ['DRAFT', 'REVEAL', 'SIMULATION', 'ENDGAME'];

    it('returns null when current phase matches expected phase', () => {
      for (const p of phases) {
        expect(getGuardRedirect(p, p)).toBeNull();
      }
    });

    it('returns the destination route when phase does not match expected phase', () => {
      expect(getGuardRedirect('REVEAL', 'DRAFT')).toBe('/reveal');
      expect(getGuardRedirect('SIMULATION', 'DRAFT')).toBe('/sim');
      expect(getGuardRedirect('ENDGAME', 'DRAFT')).toBe('/results');

      expect(getGuardRedirect('DRAFT', 'REVEAL')).toBe('/draft');
      expect(getGuardRedirect('SIMULATION', 'REVEAL')).toBe('/sim');
      expect(getGuardRedirect('ENDGAME', 'REVEAL')).toBe('/results');

      expect(getGuardRedirect('DRAFT', 'SIMULATION')).toBe('/draft');
      expect(getGuardRedirect('REVEAL', 'SIMULATION')).toBe('/reveal');
      expect(getGuardRedirect('ENDGAME', 'SIMULATION')).toBe('/results');

      expect(getGuardRedirect('DRAFT', 'ENDGAME')).toBe('/draft');
      expect(getGuardRedirect('REVEAL', 'ENDGAME')).toBe('/reveal');
      expect(getGuardRedirect('SIMULATION', 'ENDGAME')).toBe('/sim');
    });
  });
});
