import { describe, it, expect } from 'vitest';
import type { PlayerProfile, GameState, Position } from '../types/game';
import {
  PLACEHOLDER_SEED,
  createInitialState,
  createEmptyRoster,
  isRosterCompositionComplete,
  getCurrentCandidate,
  draftPlayer,
  skipCandidate,
  startReveal,
  revealNext,
  completeReveal,
  sellPlayer,
  advanceYear,
  endSimulation,
  resetGame,
} from '../lib/game/engine';
import {
  squadValue,
  totalSpent,
  netWorth,
  netWorthAt,
  getDraftedPlayers,
  rosterComplete,
  openSlots,
  deltaVsPreviousYear,
  getExitValue,
  getPlayerROI,
  bestInvestment,
  worstFlop,
  playerPeakValue,
  playerLowestValue,
} from '../lib/game/selectors';
import { rank, RANK_THRESHOLDS } from '../lib/game/rank';
import { mulberry32, shufflePool, generateSeed } from '../lib/game/prng';
import realPlayers from '../data/players.json';

// Helper to deeply freeze objects to verify immutability
function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object') {
      deepFreeze(val);
    }
  }
  return obj;
}

// Fixture factory for creating test players
function createTestPlayer(
  id: string,
  name: string,
  position: Position,
  draftCost: number,
  yearlyValues?: number[]
): PlayerProfile {
  return {
    id,
    name,
    image_url: `https://example.com/${id}.jpg`,
    position,
    age_at_draft: 25,
    draft_cost: draftCost,
    draft_season: 2014,
    draft_stats: {
      appearances: 30,
      minutes: 2700,
      goals: position === 'ATT' ? 15 : position === 'MID' ? 5 : 0,
      assists: 5,
      yellow_cards: 2,
      red_cards: 0,
    },
    yearly_values: yearlyValues ?? Array(11).fill(draftCost),
  };
}

// Small fixture pool for deterministic unit tests
function createFixturePool(): PlayerProfile[] {
  return [
    createTestPlayer('1', 'GK One', 'GK', 5_000_000, [5_000_000, 6_000_000, 7_000_000, 8_000_000, 9_000_000, 10_000_000, 9_000_000, 8_000_000, 7_000_000, 6_000_000, 5_000_000]),
    createTestPlayer('2', 'GK Two', 'GK', 10_000_000),
    createTestPlayer('3', 'DEF One', 'DEF', 10_000_000),
    createTestPlayer('4', 'DEF Two', 'DEF', 12_000_000),
    createTestPlayer('5', 'DEF Three', 'DEF', 8_000_000),
    createTestPlayer('6', 'MID One', 'MID', 15_000_000),
    createTestPlayer('7', 'MID Two', 'MID', 20_000_000),
    createTestPlayer('8', 'MID Three', 'MID', 5_000_000),
    createTestPlayer('9', 'ATT One', 'ATT', 30_000_000, [30_000_000, 35_000_000, 40_000_000, 50_000_000, 60_000_000, 70_000_000, 60_000_000, 50_000_000, 40_000_000, 30_000_000, 20_000_000]),
    createTestPlayer('10', 'ATT Two', 'ATT', 25_000_000),
    createTestPlayer('11', 'ATT Three', 'ATT', 15_000_000),
  ];
}

describe('Game Engine & Zustand Store Rules', () => {
  describe('1. Initial State', () => {
    it('initializes with exact initial values', () => {
      const state = createInitialState(42);
      expect(state.budget).toBe(250_000_000);
      expect(state.currentYear).toBe(0);
      expect(state.phase).toBe('DRAFT');
      expect(state.seed).toBe(42);
      expect(state.skipsRemaining).toBe(3);
      expect(state.skippedIds).toEqual([]);
      expect(state.transactions).toEqual([]);
      expect(state.revealedCount).toBe(0);
      expect(state.roster).toEqual({
        GK: [],
        DEF: [],
        MID: [],
        ATT: [],
      });
    });

    it('uses fixed placeholder seed by default without calling Math.random', () => {
      const state = createInitialState();
      expect(state.seed).toBe(PLACEHOLDER_SEED);
    });

    it('createEmptyRoster and resetGame initialize clean states', () => {
      const empty = createEmptyRoster();
      expect(empty).toEqual({ GK: [], DEF: [], MID: [], ATT: [] });

      const customSeed = generateSeed();
      expect(customSeed).toBeGreaterThan(0);
      const reset = resetGame(customSeed);
      expect(reset.seed).toBe(customSeed);
      expect(reset.budget).toBe(250_000_000);
      expect(reset.phase).toBe('DRAFT');
    });
  });

  describe('2. Invariants & Deep Immutability', () => {
    it('leaves input state object completely untouched (deep-freeze check)', () => {
      const pool = createFixturePool();
      const state = deepFreeze(createInitialState(100));

      // Candidate check
      const candidate = getCurrentCandidate(state, pool)!;
      expect(candidate).toBeDefined();

      // Draft action
      const draftRes = draftPlayer(state, candidate, pool);
      expect(draftRes.result.ok).toBe(true);
      expect(state.roster[candidate.position]).toHaveLength(0); // Input state unchanged!
      expect(draftRes.state.roster[candidate.position]).toHaveLength(1);

      // Skip action on deep frozen state
      const skipRes = skipCandidate(state, pool);
      expect(skipRes.result.ok).toBe(true);
      expect(state.skipsRemaining).toBe(3); // Input state unchanged!
      expect(skipRes.state.skipsRemaining).toBe(2);

      // Transition on frozen state
      const frozenDraft = deepFreeze({
        ...state,
        roster: {
          GK: [pool[0]],
          DEF: [pool[2], pool[3]],
          MID: [pool[5], pool[6]],
          ATT: [pool[8], pool[9]],
        },
      });
      const revealRes = startReveal(frozenDraft);
      expect(revealRes.result.ok).toBe(true);
      expect(frozenDraft.phase).toBe('DRAFT');
      expect(revealRes.state.phase).toBe('REVEAL');

      const frozenReveal = deepFreeze({ ...frozenDraft, phase: 'REVEAL' as const, revealedCount: 0 });
      const nextRes = revealNext(frozenReveal);
      expect(nextRes.result.ok).toBe(true);
      expect(frozenReveal.revealedCount).toBe(0);
      expect(nextRes.state.revealedCount).toBe(1);

      const frozenCompleteReveal = deepFreeze({ ...frozenDraft, phase: 'REVEAL' as const, revealedCount: 7 });
      const compRes = completeReveal(frozenCompleteReveal);
      expect(compRes.result.ok).toBe(true);
      expect(frozenCompleteReveal.phase).toBe('REVEAL');
      expect(compRes.state.phase).toBe('SIMULATION');

      const frozenSim = deepFreeze({ ...frozenDraft, phase: 'SIMULATION' as const, currentYear: 0 });
      const advRes = advanceYear(frozenSim);
      expect(advRes.result.ok).toBe(true);
      expect(frozenSim.currentYear).toBe(0);
      expect(advRes.state.currentYear).toBe(1);

      const sellRes = sellPlayer(frozenSim, pool[0].id);
      expect(sellRes.result.ok).toBe(true);
      expect(frozenSim.roster.GK).toHaveLength(1);
      expect(sellRes.state.roster.GK).toHaveLength(0);

      const frozenEnd = deepFreeze({ ...frozenSim, currentYear: 10 });
      const endRes = endSimulation(frozenEnd);
      expect(endRes.result.ok).toBe(true);
      expect(frozenEnd.phase).toBe('SIMULATION');
      expect(endRes.state.phase).toBe('ENDGAME');
    });
  });

  describe('3. Phase Transitions', () => {
    it('only permits DRAFT -> REVEAL -> SIMULATION -> ENDGAME', () => {
      const state = createInitialState(1);

      // Cannot advance year or sell in DRAFT
      expect(advanceYear(state).result).toEqual({ ok: false, error: 'WRONG_PHASE' });
      expect(sellPlayer(state, '1').result).toEqual({ ok: false, error: 'WRONG_PHASE' });
      expect(endSimulation(state).result).toEqual({ ok: false, error: 'WRONG_PHASE' });
      expect(completeReveal(state).result).toEqual({ ok: false, error: 'WRONG_PHASE' });
      expect(revealNext(state).result).toEqual({ ok: false, error: 'WRONG_PHASE' });
    });

    it('rejects startReveal if roster composition is incomplete or wrong', () => {
      const pool = createFixturePool();
      const state = createInitialState(1);

      // Fewer than 7 players
      const res1 = startReveal(state);
      expect(res1.result).toEqual({ ok: false, error: 'ROSTER_INCOMPLETE' });

      // 7 players but wrong composition (0 GK, 3 DEF, 2 MID, 2 ATT)
      const wrongRoster = {
        GK: [],
        DEF: [pool[2], pool[3], pool[4]],
        MID: [pool[5], pool[6]],
        ATT: [pool[8], pool[9]],
      };
      const stateWrong = { ...state, roster: wrongRoster };
      const res2 = startReveal(stateWrong);
      expect(res2.result).toEqual({ ok: false, error: 'ROSTER_INCOMPLETE' });

      // Correct composition: 1 GK, 2 DEF, 2 MID, 2 ATT
      const validRoster = {
        GK: [pool[0]],
        DEF: [pool[2], pool[3]],
        MID: [pool[5], pool[6]],
        ATT: [pool[8], pool[9]],
      };
      const stateValid = { ...state, roster: validRoster };
      const res3 = startReveal(stateValid);
      expect(res3.result).toEqual({ ok: true });
      expect(res3.state.phase).toBe('REVEAL');
      expect(res3.state.revealedCount).toBe(0);
      expect(res3.state.budget).toBe(stateValid.budget); // Unchanged
    });

    it('enforces REVEAL progression and transition to SIMULATION', () => {
      let state: GameState = {
        ...createInitialState(1),
        phase: 'REVEAL',
        revealedCount: 0,
      };

      // Cannot complete reveal when count < 7
      expect(completeReveal(state).result).toEqual({ ok: false, error: 'REVEAL_NOT_COMPLETE' });

      // Reveal 7 cards
      for (let i = 0; i < 7; i++) {
        const res = revealNext(state);
        expect(res.result.ok).toBe(true);
        state = res.state;
      }
      expect(state.revealedCount).toBe(7);

      // Revealing again fails
      expect(revealNext(state).result).toEqual({ ok: false, error: 'REVEAL_ALREADY_COMPLETE' });

      // Complete reveal transitions to SIMULATION with currentYear = 0
      const comp = completeReveal(state);
      expect(comp.result.ok).toBe(true);
      expect(comp.state.phase).toBe('SIMULATION');
      expect(comp.state.currentYear).toBe(0);
    });

    it('enforces advanceYear limit at Year 10 and endSimulation strictly at Year 10', () => {
      let state: GameState = {
        ...createInitialState(1),
        phase: 'SIMULATION',
        currentYear: 0,
      };

      // Advance through years 0 -> 10
      for (let y = 0; y < 10; y++) {
        expect(endSimulation(state).result).toEqual({ ok: false, error: 'SIMULATION_NOT_FINISHED' });
        const adv = advanceYear(state);
        expect(adv.result.ok).toBe(true);
        state = adv.state;
      }
      expect(state.currentYear).toBe(10);

      // Cannot advance past 10
      expect(advanceYear(state).result).toEqual({ ok: false, error: 'YEAR_LIMIT' });

      // Can end simulation at 10
      const end = endSimulation(state);
      expect(end.result.ok).toBe(true);
      expect(end.state.phase).toBe('ENDGAME');
    });
  });

  describe('4. Draft & Skip Mechanics with Budget Guard', () => {
    it('draftPlayer validates candidate identity, ownership, position limit, and affordability', () => {
      const pool = createFixturePool();
      const state = createInitialState(1);

      const candidate = getCurrentCandidate(state, pool)!;
      expect(candidate).toBeDefined();

      // Passing non-candidate player
      const other = pool.find((p) => p.id !== candidate.id)!;
      expect(draftPlayer(state, other, pool).result).toEqual({
        ok: false,
        error: 'NOT_CURRENT_CANDIDATE',
      });

      // Successful pick
      const pick1 = draftPlayer(state, candidate, pool);
      expect(pick1.result.ok).toBe(true);
      expect(pick1.state.budget).toBe(state.budget - candidate.draft_cost);
      expect(pick1.state.transactions).toHaveLength(1);
      expect(pick1.state.transactions[0]).toEqual({
        playerId: candidate.id,
        year: 0,
        kind: 'DRAFT',
        amount: candidate.draft_cost,
      });

      // Attempting to draft already owned player
      const fakeStateWithOwned: GameState = {
        ...pick1.state,
        roster: {
          ...pick1.state.roster,
          [candidate.position]: [candidate],
        },
      };
      // If force drafted:
      expect(draftPlayer(fakeStateWithOwned, candidate, pool).result).toEqual({
        ok: false,
        error: 'NOT_CURRENT_CANDIDATE', // Candidate resolution already excludes owned
      });
    });

    it('rejects candidate drafting when position is full', () => {
      const pool = createFixturePool();
      // GK limit is 1. If roster already has 1 GK, GK is never candidate
      const state: GameState = {
        ...createInitialState(1),
        roster: {
          GK: [pool[0]],
          DEF: [],
          MID: [],
          ATT: [],
        },
      };
      const candidate = getCurrentCandidate(state, pool)!;
      expect(candidate.position).not.toBe('GK');
    });

    it('skipCandidate costs 1 skip, marks candidate as skipped, and rejects when skips = 0', () => {
      const pool = realPlayers as PlayerProfile[];
      let state = createInitialState(100);

      const c1 = getCurrentCandidate(state, pool)!;
      const skip1 = skipCandidate(state, pool);
      expect(skip1.result.ok).toBe(true);
      state = skip1.state;
      expect(state.skipsRemaining).toBe(2);
      expect(state.skippedIds).toContain(c1.id);

      // Skipped candidate never reappears
      const c2 = getCurrentCandidate(state, pool)!;
      expect(c2.id).not.toBe(c1.id);

      // Use remaining 2 skips
      const skip2 = skipCandidate(state, pool);
      expect(skip2.result.ok).toBe(true);
      state = skip2.state;

      const skip3 = skipCandidate(state, pool);
      expect(skip3.result.ok).toBe(true);
      state = skip3.state;

      expect(state.skipsRemaining).toBe(0);

      // 4th skip rejected with NO_SKIPS_LEFT
      const skip4 = skipCandidate(state, pool);
      expect(skip4.result).toEqual({ ok: false, error: 'NO_SKIPS_LEFT' });
    });

    it('budget guard rejects draftPlayer or skipCandidate if it would make filling roster impossible', () => {
      // Tiny pool with barely enough players
      const minimalPool = [
        createTestPlayer('1', 'GK', 'GK', 10_000_000),
        createTestPlayer('2', 'DEF1', 'DEF', 10_000_000),
        createTestPlayer('3', 'DEF2', 'DEF', 10_000_000),
        createTestPlayer('4', 'MID1', 'MID', 10_000_000),
        createTestPlayer('5', 'MID2', 'MID', 10_000_000),
        createTestPlayer('6', 'ATT1', 'ATT', 10_000_000),
        createTestPlayer('7', 'ATT2', 'ATT', 10_000_000),
      ];

      // If budget was reduced to 65M, sum of 7 players is 70M -> candidate cannot even be selected
      const lowBudgetState: GameState = {
        ...createInitialState(1),
        budget: 65_000_000,
      };
      // All candidates violate budget guard because 65M < 70M needed
      const candidate = getCurrentCandidate(lowBudgetState, minimalPool);
      expect(candidate).toBeNull();

      // If budget is 70M, exact amount needed:
      const exactBudgetState: GameState = {
        ...createInitialState(1),
        budget: 70_000_000,
      };
      const candidateExact = getCurrentCandidate(exactBudgetState, minimalPool);
      expect(candidateExact).not.toBeNull();

      // Skipping this candidate would leave only 6 players in pool for 7 slots -> BUDGET_GUARD
      const skipRes = skipCandidate(exactBudgetState, minimalPool);
      expect(skipRes.result).toEqual({ ok: false, error: 'BUDGET_GUARD' });
    });
  });

  describe('5. PRNG Determinism', () => {
    it('produces identical queues for identical seeds and different queues for different seeds', () => {
      const pool = createFixturePool();
      const q1 = shufflePool(pool, 42);
      const q2 = shufflePool(pool, 42);
      const q3 = shufflePool(pool, 999);

      expect(q1.map((p) => p.id)).toEqual(q2.map((p) => p.id));
      expect(q1.map((p) => p.id)).not.toEqual(q3.map((p) => p.id));
    });
  });

  describe('6. Sales & Simulations', () => {
    it('sellPlayer uses yearly_values[currentYear], cannot double-sell, and logs transaction', () => {
      const p = createTestPlayer('1', 'Test Player', 'GK', 10_000_000, [
        10_000_000,
        15_000_000,
        20_000_000,
        25_000_000,
        30_000_000,
        35_000_000,
        40_000_000,
        45_000_000,
        50_000_000,
        55_000_000,
        60_000_000,
      ]);

      let state: GameState = {
        ...createInitialState(1),
        phase: 'SIMULATION',
        currentYear: 2,
        budget: 100_000_000,
        roster: {
          GK: [p],
          DEF: [],
          MID: [],
          ATT: [],
        },
      };

      // Year 2 value is 20_000_000
      const sellRes = sellPlayer(state, p.id);
      expect(sellRes.result.ok).toBe(true);
      state = sellRes.state;

      expect(state.budget).toBe(120_000_000);
      expect(state.roster.GK).toHaveLength(0);
      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0]).toEqual({
        playerId: p.id,
        year: 2,
        kind: 'SELL',
        amount: 20_000_000,
      });

      // Selling again fails with NOT_ON_ROSTER
      const doubleSell = sellPlayer(state, p.id);
      expect(doubleSell.result).toEqual({ ok: false, error: 'NOT_ON_ROSTER' });
    });
  });

  describe('7. Selectors, Net Worth, & Financial Math', () => {
    it('netWorth equals exactly 250_000_000 at Year 0 right after the draft', () => {
      const p1 = createTestPlayer('1', 'GK', 'GK', 10_000_000);
      const p2 = createTestPlayer('2', 'DEF1', 'DEF', 15_000_000);
      const p3 = createTestPlayer('3', 'DEF2', 'DEF', 15_000_000);
      const p4 = createTestPlayer('4', 'MID1', 'MID', 20_000_000);
      const p5 = createTestPlayer('5', 'MID2', 'MID', 20_000_000);
      const p6 = createTestPlayer('6', 'ATT1', 'ATT', 30_000_000);
      const p7 = createTestPlayer('7', 'ATT2', 'ATT', 40_000_000);

      const totalCost = 10_000_000 + 15_000_000 + 15_000_000 + 20_000_000 + 20_000_000 + 30_000_000 + 40_000_000; // 150M
      const remainingBudget = 250_000_000 - totalCost; // 100M

      const state: GameState = {
        ...createInitialState(1),
        budget: remainingBudget,
        currentYear: 0,
        roster: {
          GK: [p1],
          DEF: [p2, p3],
          MID: [p4, p5],
          ATT: [p6, p7],
        },
      };

      expect(squadValue(state)).toBe(150_000_000);
      expect(netWorth(state)).toBe(250_000_000); // Exact check
    });

    it('totalSpent derives total capital spent strictly from DRAFT transactions', () => {
      const initial = createInitialState(1);
      expect(totalSpent(initial)).toBe(0);

      const stateWithTxs: GameState = {
        ...initial,
        transactions: [
          { playerId: '1', year: 0, kind: 'DRAFT', amount: 15_000_000 },
          { playerId: '2', year: 0, kind: 'DRAFT', amount: 32_500_000 },
          { playerId: '1', year: 3, kind: 'SELL', amount: 45_000_000 },
          { playerId: '3', year: 0, kind: 'DRAFT', amount: 10_000_000 },
        ],
      };

      expect(totalSpent(stateWithTxs)).toBe(57_500_000);
    });

    it('netWorth never double-counts a sale', () => {
      const p = createTestPlayer('1', 'GK', 'GK', 10_000_000, Array(11).fill(25_000_000));
      const state: GameState = {
        ...createInitialState(1),
        phase: 'SIMULATION',
        currentYear: 1,
        budget: 100_000_000,
        roster: {
          GK: [p],
          DEF: [],
          MID: [],
          ATT: [],
        },
      };

      const beforeSaleNetWorth = netWorth(state); // 100M + 25M = 125M
      expect(beforeSaleNetWorth).toBe(125_000_000);

      const sellRes = sellPlayer(state, p.id);
      expect(sellRes.result.ok).toBe(true);

      const afterSaleNetWorth = netWorth(sellRes.state); // budget is 125M, squadValue is 0
      expect(afterSaleNetWorth).toBe(125_000_000);
    });

    it('netWorthAt reconstructs accurate historical net worth', () => {
      const p1 = createTestPlayer('1', 'P1', 'GK', 10_000_000, [10_000_000, 20_000_000, 30_000_000, 40_000_000, 50_000_000, 60_000_000, 70_000_000, 80_000_000, 90_000_000, 100_000_000, 110_000_000]);
      const p2 = createTestPlayer('2', 'P2', 'ATT', 20_000_000, [20_000_000, 25_000_000, 30_000_000, 35_000_000, 40_000_000, 45_000_000, 50_000_000, 55_000_000, 60_000_000, 65_000_000, 70_000_000]);

      const transactions = [
        { playerId: '1', year: 0, kind: 'DRAFT' as const, amount: 10_000_000 },
        { playerId: '2', year: 0, kind: 'DRAFT' as const, amount: 20_000_000 },
        { playerId: '1', year: 2, kind: 'SELL' as const, amount: 30_000_000 },
      ];

      const allDrafted = [p1, p2];

      // At Year 0: initial 250M - 30M = 220M budget + (10M + 20M squad) = 250M
      expect(netWorthAt(0, transactions, allDrafted)).toBe(250_000_000);

      // At Year 1: budget 220M + p1(20M) + p2(25M) = 265M
      expect(netWorthAt(1, transactions, allDrafted)).toBe(265_000_000);

      // At Year 2: p1 sold for 30M. Budget = 220M + 30M = 250M. p2 held at 30M. Total = 280M
      expect(netWorthAt(2, transactions, allDrafted)).toBe(280_000_000);
    });

    it('deltaVsPreviousYear correctly handles year 0 and previous value of 0', () => {
      const p = createTestPlayer('1', 'Player', 'MID', 10_000_000, [0, 5_000_000, 10_000_000]);

      // Year 0 has no previous
      expect(deltaVsPreviousYear(p, 0)).toEqual({ absolute: 0, percent: 0 });

      // Year 1 previous was 0 -> percent = 0 (no NaN/Infinity)
      expect(deltaVsPreviousYear(p, 1)).toEqual({ absolute: 5_000_000, percent: 0 });

      // Year 2 previous was 5M -> +5M, +100% (1.0)
      expect(deltaVsPreviousYear(p, 2)).toEqual({ absolute: 5_000_000, percent: 1 });
    });

    it('bestInvestment and worstFlop handle edges and tie-breaks (lowest numeric id wins)', () => {
      const p1 = createTestPlayer('10', 'Player Ten', 'MID', 10_000_000, Array(11).fill(10_000_000));
      const p2 = createTestPlayer('2', 'Player Two', 'ATT', 10_000_000, Array(11).fill(10_000_000));

      const state: GameState = {
        ...createInitialState(1),
        transactions: [],
      };

      // Both have ROI 0. Tie-break: lowest numeric id (id '2' < id '10')
      const best = bestInvestment(state, [p1, p2]);
      expect(best?.player.id).toBe('2');

      // Nobody lost value -> worstFlop returns NEUTRAL
      const flopNeutral = worstFlop(state, [p1, p2]);
      expect(flopNeutral).toEqual({
        status: 'NEUTRAL',
        message: 'No players lost value',
      });

      // Both lose exactly 5M (exit value 5M). Tie-break: lowest numeric id ('2')
      const p1Loss = createTestPlayer('10', 'P10', 'MID', 10_000_000, Array(11).fill(5_000_000));
      const p2Loss = createTestPlayer('2', 'P2', 'ATT', 10_000_000, Array(11).fill(5_000_000));
      const flop = worstFlop(state, [p1Loss, p2Loss]);
      expect(flop.status).toBe('FLOP');
      if (flop.status === 'FLOP') {
        expect(flop.player.id).toBe('2');
        expect(flop.loss).toBe(5_000_000);
      }
    });

    it('rank thresholds work at exact boundaries', () => {
      expect(RANK_THRESHOLDS.MASTER_NEGOTIATOR).toBe(500_000_000);
      expect(RANK_THRESHOLDS.TRANSFER_STRATEGIST).toBe(200_000_000);
      expect(rank(199_999_999)).toBe('RELEGATION FODDER');
      expect(rank(200_000_000)).toBe('TRANSFER STRATEGIST');
      expect(rank(350_000_000)).toBe('TRANSFER STRATEGIST');
      expect(rank(500_000_000)).toBe('TRANSFER STRATEGIST');
      expect(rank(500_000_001)).toBe('MASTER NEGOTIATOR');
      expect(rank(1_000_000_000)).toBe('MASTER NEGOTIATOR');
    });

    it('rosterComplete, openSlots, exitValue, ROI, peak and lowest value helpers', () => {
      const p = createTestPlayer('1', 'P1', 'GK', 10_000_000, [
        10_000_000, 15_000_000, 20_000_000, 25_000_000, 30_000_000,
        35_000_000, 40_000_000, 45_000_000, 50_000_000, 55_000_000, 60_000_000,
      ]);

      expect(playerPeakValue(p)).toBe(60_000_000);
      expect(playerLowestValue(p)).toBe(10_000_000);

      // Unsold exit value = Year 10 value
      expect(getExitValue(p, [])).toBe(60_000_000);
      expect(getPlayerROI(p, [])).toBe(5); // (60M - 10M)/10M = 5.0 (500%)

      // Sold exit value
      const sellTx = [{ playerId: '1', year: 2, kind: 'SELL' as const, amount: 20_000_000 }];
      expect(getExitValue(p, sellTx)).toBe(20_000_000);
      expect(getPlayerROI(p, sellTx)).toBe(1); // (20M - 10M)/10M = 1.0 (100%)

      const state = createInitialState();
      expect(rosterComplete(state)).toBe(false);
      expect(openSlots(state)).toEqual({ GK: 1, DEF: 2, MID: 2, ATT: 2 });
    });
  });

  describe('8. Property Test: 200 Random Seeds with Random Policy', () => {
    it('always reaches a complete 1/2/2/2 roster, never hits an invalid state, and never negative budget', { timeout: 30_000 }, () => {
      const pool = realPlayers as PlayerProfile[];
      const SEED_COUNT = 200;

      for (let s = 1; s <= SEED_COUNT; s++) {
        let state = createInitialState(s * 7919);
        const rng = mulberry32(s * 7919);

        while (!isRosterCompositionComplete(state.roster)) {
          const candidate = getCurrentCandidate(state, pool);
          expect(candidate).not.toBeNull();
          if (!candidate) break;

          // Random policy: skip if skips remain and random coin flip passes
          if (state.skipsRemaining > 0 && rng() > 0.5) {
            const skipResult = skipCandidate(state, pool);
            if (skipResult.result.ok) {
              state = skipResult.state;
              continue;
            }
          }

          // Otherwise draft
          const draftResult = draftPlayer(state, candidate, pool);
          expect(draftResult.result).toEqual({ ok: true });
          expect(draftResult.state.budget).toBeGreaterThanOrEqual(0);
          state = draftResult.state;
        }

        // Roster must be complete
        expect(state.roster.GK).toHaveLength(1);
        expect(state.roster.DEF).toHaveLength(2);
        expect(state.roster.MID).toHaveLength(2);
        expect(state.roster.ATT).toHaveLength(2);
        expect(state.budget).toBeGreaterThanOrEqual(0);

        // Can start reveal
        const revealRes = startReveal(state);
        expect(revealRes.result.ok).toBe(true);
      }
    });
  });

  describe('9. Integration Test: Full Simulated Game with Real Pool', () => {
    it('runs full game (draft, reveal, 10 years, sales, endgame) and verifies net worth matches transactions', () => {
      const pool = realPlayers as PlayerProfile[];
      let state = createInitialState(2026);

      // Phase 1: DRAFT
      while (!isRosterCompositionComplete(state.roster)) {
        const candidate = getCurrentCandidate(state, pool)!;
        expect(candidate).toBeDefined();

        // Skip once if GK appears early to test skip
        if (candidate.position === 'GK' && state.skipsRemaining === 3) {
          const skipRes = skipCandidate(state, pool);
          if (skipRes.result.ok) {
            state = skipRes.state;
            continue;
          }
        }

        const draftRes = draftPlayer(state, candidate, pool);
        expect(draftRes.result.ok).toBe(true);
        state = draftRes.state;
      }

      expect(isRosterCompositionComplete(state.roster)).toBe(true);
      expect(state.budget).toBeGreaterThanOrEqual(0);
      expect(netWorth(state)).toBe(250_000_000);

      // Phase 2: REVEAL
      const startRev = startReveal(state);
      expect(startRev.result.ok).toBe(true);
      state = startRev.state;

      for (let r = 0; r < 7; r++) {
        const nextRev = revealNext(state);
        expect(nextRev.result.ok).toBe(true);
        state = nextRev.state;
      }

      const compRev = completeReveal(state);
      expect(compRev.result.ok).toBe(true);
      state = compRev.state;
      expect(state.phase).toBe('SIMULATION');
      expect(state.currentYear).toBe(0);

      const allDrafted = getDraftedPlayers(state, pool);
      expect(allDrafted).toHaveLength(7);

      // Phase 3: SIMULATION across 10 years
      // Sell 1 defender at Year 3
      // Sell 1 attacker at Year 7
      let soldCount = 0;

      while (state.currentYear < 10) {
        if (state.currentYear === 3 && state.roster.DEF.length > 0) {
          const defToSell = state.roster.DEF[0];
          const sellRes = sellPlayer(state, defToSell.id);
          expect(sellRes.result.ok).toBe(true);
          state = sellRes.state;
          soldCount++;
        }

        if (state.currentYear === 7 && state.roster.ATT.length > 0) {
          const attToSell = state.roster.ATT[0];
          const sellRes = sellPlayer(state, attToSell.id);
          expect(sellRes.result.ok).toBe(true);
          state = sellRes.state;
          soldCount++;
        }

        const adv = advanceYear(state);
        expect(adv.result.ok).toBe(true);
        state = adv.state;

        // Check netWorth vs netWorthAt selector at each year
        const currentNetWorth = netWorth(state);
        const reconstructedNetWorth = netWorthAt(state.currentYear, state.transactions, allDrafted);
        expect(Math.abs(currentNetWorth - reconstructedNetWorth)).toBeLessThan(0.01);
      }

      expect(state.currentYear).toBe(10);
      expect(soldCount).toBe(2);

      // Phase 4: ENDGAME
      const endRes = endSimulation(state);
      expect(endRes.result.ok).toBe(true);
      state = endRes.state;
      expect(state.phase).toBe('ENDGAME');

      // Best investment & worst flop
      const best = bestInvestment(state, allDrafted);
      const flop = worstFlop(state, allDrafted);
      const finalRank = rank(netWorth(state));

      expect(best).not.toBeNull();
      expect(flop).toBeDefined();
      expect(['MASTER NEGOTIATOR', 'TRANSFER STRATEGIST', 'RELEGATION FODDER']).toContain(finalRank);

      // Print game summary
      console.log('=== FULL GAME INTEGRATION TEST SUMMARY ===');
      console.log(`Final Net Worth: €${netWorth(state).toLocaleString('en-US')}`);
      console.log(`Final Rank: ${finalRank}`);
      console.log(`Best Investment: ${best?.player.name} (ROI: ${(best!.roi * 100).toFixed(1)}%)`);
      if (flop.status === 'FLOP') {
        console.log(`Worst Flop: ${flop.player.name} (Loss: €${flop.loss.toLocaleString('en-US')})`);
      } else {
        console.log('Worst Flop: None (No losses)');
      }
      console.log('==========================================');
    });
  });
});
