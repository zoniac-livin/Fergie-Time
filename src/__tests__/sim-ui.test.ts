import { describe, it, expect } from 'vitest';
import {
  getNextFocusTarget,
  getNextFocusTargetAfterSale,
  resetConfirmOnYearChange,
  shouldResetConfirm,
  getOrderedRosterPlayers,
} from '../lib/ui/sim';
import type { PlayerProfile } from '../types/game';

function dummyPlayer(id: string, position: PlayerProfile['position'] = 'DEF'): PlayerProfile {
  return {
    id,
    name: `Player ${id}`,
    position,
    image_url: '',
    age_at_draft: 22,
    draft_cost: 10_000_000,
    draft_season: 2020,
    draft_stats: { appearances: 30, minutes: 2700, goals: 5, assists: 3, yellow_cards: 2, red_cards: 0 },
    yearly_values: [10_000_000],
  };
}

describe('Simulation UI Pure Logic (DOM-free tests)', () => {
  describe('getNextFocusTarget', () => {
    it('returns NEXT_YEAR when no players remain after sale', () => {
      const target = getNextFocusTarget([], 0);
      expect(target).toEqual({ kind: 'NEXT_YEAR' });
    });

    it('returns the player at the same index if within remaining bounds', () => {
      const remaining = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
      // Sold player was at index 1 -> target is the one that shifted into index 1 ('p2')
      const target = getNextFocusTarget(remaining, 1);
      expect(target).toEqual({ kind: 'SELL', playerId: 'p2' });
    });

    it('clamps to the last player if soldIndex is beyond remaining length', () => {
      const remaining = [{ id: 'p1' }, { id: 'p2' }];
      // Sold player was at index 2 (the last player) -> remaining has length 2, clamp to index 1 ('p2')
      const target = getNextFocusTarget(remaining, 2);
      expect(target).toEqual({ kind: 'SELL', playerId: 'p2' });
    });
  });

  describe('getNextFocusTargetAfterSale', () => {
    it('returns NEXT_YEAR when selling the only player in the roster', () => {
      const roster = [{ id: 'p1' }];
      const target = getNextFocusTargetAfterSale(roster, 'p1');
      expect(target).toEqual({ kind: 'NEXT_YEAR' });
    });

    it('focuses the next player occupying the sold player index', () => {
      const roster = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
      // Selling p1 (index 0) -> next focus should be p2 (now at index 0)
      const target1 = getNextFocusTargetAfterSale(roster, 'p1');
      expect(target1).toEqual({ kind: 'SELL', playerId: 'p2' });

      // Selling p2 (index 1) -> next focus should be p3 (now at index 1)
      const target2 = getNextFocusTargetAfterSale(roster, 'p2');
      expect(target2).toEqual({ kind: 'SELL', playerId: 'p3' });
    });

    it('focuses the previous player (now last) when selling the last player', () => {
      const roster = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
      // Selling p3 (index 2) -> next focus should be p2 (now at index 1)
      const target = getNextFocusTargetAfterSale(roster, 'p3');
      expect(target).toEqual({ kind: 'SELL', playerId: 'p2' });
    });
  });

  describe('resetConfirmOnYearChange & shouldResetConfirm', () => {
    it('resets confirmOpen to false when year changes', () => {
      expect(resetConfirmOnYearChange(true, 1, 2)).toBe(false);
      expect(resetConfirmOnYearChange(true, 0, 1)).toBe(false);
      expect(resetConfirmOnYearChange(false, 1, 2)).toBe(false);
    });

    it('preserves confirmOpen when year is unchanged', () => {
      expect(resetConfirmOnYearChange(true, 2, 2)).toBe(true);
      expect(resetConfirmOnYearChange(false, 2, 2)).toBe(false);
    });

    it('shouldResetConfirm returns true on year change, false otherwise', () => {
      expect(shouldResetConfirm(1, 2)).toBe(true);
      expect(shouldResetConfirm(2, 3)).toBe(true);
      expect(shouldResetConfirm(2, 2)).toBe(false);
    });
  });

  describe('getOrderedRosterPlayers', () => {
    it('orders players strictly GK, DEF, MID, ATT', () => {
      const gk = dummyPlayer('gk1', 'GK');
      const def1 = dummyPlayer('def1', 'DEF');
      const def2 = dummyPlayer('def2', 'DEF');
      const mid1 = dummyPlayer('mid1', 'MID');
      const mid2 = dummyPlayer('mid2', 'MID');
      const att1 = dummyPlayer('att1', 'ATT');
      const att2 = dummyPlayer('att2', 'ATT');

      const roster = {
        ATT: [att1, att2],
        MID: [mid1, mid2],
        GK: [gk],
        DEF: [def1, def2],
      };

      const ordered = getOrderedRosterPlayers(roster);
      expect(ordered.map((p) => p.position)).toEqual([
        'GK',
        'DEF',
        'DEF',
        'MID',
        'MID',
        'ATT',
        'ATT',
      ]);
      expect(ordered.map((p) => p.id)).toEqual([
        'gk1',
        'def1',
        'def2',
        'mid1',
        'mid2',
        'att1',
        'att2',
      ]);
    });
  });
});
