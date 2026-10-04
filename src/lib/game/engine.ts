import type {
  PlayerProfile,
  GameState,
  ActionResult,
  Position,
  Roster,
  Transaction,
} from '../../types/game';
import { shufflePool } from './prng';

export const INITIAL_BUDGET = 250_000_000;
export const INITIAL_SKIPS = 3;
export const PLACEHOLDER_SEED = 12345;

export const POSITION_LIMITS: Record<Position, number> = {
  GK: 1,
  DEF: 2,
  MID: 2,
  ATT: 2,
};

export const POSITIONS: readonly Position[] = ['GK', 'DEF', 'MID', 'ATT'] as const;

export function createEmptyRoster(): Roster {
  return {
    GK: [],
    DEF: [],
    MID: [],
    ATT: [],
  };
}

export function createInitialState(seed: number = PLACEHOLDER_SEED): GameState {
  return {
    budget: INITIAL_BUDGET,
    currentYear: 0,
    roster: createEmptyRoster(),
    phase: 'DRAFT',
    seed,
    skipsRemaining: INITIAL_SKIPS,
    skippedIds: [],
    transactions: [],
    revealedCount: 0,
  };
}

export function isPlayerOwned(roster: Roster, id: string): boolean {
  return (
    roster.GK.some((p) => p.id === id) ||
    roster.DEF.some((p) => p.id === id) ||
    roster.MID.some((p) => p.id === id) ||
    roster.ATT.some((p) => p.id === id)
  );
}

export function getAllRosterPlayerIds(roster: Roster): string[] {
  return [
    ...roster.GK.map((p) => p.id),
    ...roster.DEF.map((p) => p.id),
    ...roster.MID.map((p) => p.id),
    ...roster.ATT.map((p) => p.id),
  ];
}

export function isRosterCompositionComplete(roster: Roster): boolean {
  return (
    roster.GK.length === POSITION_LIMITS.GK &&
    roster.DEF.length === POSITION_LIMITS.DEF &&
    roster.MID.length === POSITION_LIMITS.MID &&
    roster.ATT.length === POSITION_LIMITS.ATT
  );
}

export function getOpenSlotsCount(roster: Roster): Record<Position, number> {
  return {
    GK: POSITION_LIMITS.GK - roster.GK.length,
    DEF: POSITION_LIMITS.DEF - roster.DEF.length,
    MID: POSITION_LIMITS.MID - roster.MID.length,
    ATT: POSITION_LIMITS.ATT - roster.ATT.length,
  };
}

/**
 * Finds the k smallest numbers in an array.
 * Fast O(N) selection for k <= 2, which matches all position limits (max 2).
 */
function getKSmallest(numbers: number[], k: number): number[] {
  if (numbers.length < k) return [];
  if (k === 1) {
    let min = numbers[0];
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] < min) min = numbers[i];
    }
    return [min];
  }
  if (k === 2) {
    let min1 = Math.min(numbers[0], numbers[1]);
    let min2 = Math.max(numbers[0], numbers[1]);
    for (let i = 2; i < numbers.length; i++) {
      const v = numbers[i];
      if (v < min1) {
        min2 = min1;
        min1 = v;
      } else if (v < min2) {
        min2 = v;
      }
    }
    return [min1, min2];
  }
  return numbers.slice().sort((a, b) => a - b).slice(0, k);
}

/**
 * Budget Guard check:
 * For every position with open slots, the remaining budget must be able to afford
 * the k cheapest players in that position who are still in the unseen queue (not owned, not skipped),
 * where k is the number of open slots in that position.
 */
export function checkBudgetGuard(
  remainingBudget: number,
  openSlots: Record<Position, number>,
  unseenQueue: readonly PlayerProfile[],
  skippedSet: ReadonlySet<string>,
  ownedSet: ReadonlySet<string>
): boolean {
  // Group costs of valid unseen players by position
  const costsByPos: Record<Position, number[]> = {
    GK: [],
    DEF: [],
    MID: [],
    ATT: [],
  };

  for (let i = 0; i < unseenQueue.length; i++) {
    const p = unseenQueue[i];
    if (skippedSet.has(p.id) || ownedSet.has(p.id)) continue;
    if (openSlots[p.position] > 0) {
      costsByPos[p.position].push(p.draft_cost);
    }
  }

  let totalMinCost = 0;
  for (const pos of POSITIONS) {
    const k = openSlots[pos];
    if (k > 0) {
      const cheapest = getKSmallest(costsByPos[pos], k);
      if (cheapest.length < k) {
        return false; // Not enough players in unseen queue to fill this position
      }
      for (let j = 0; j < cheapest.length; j++) {
        totalMinCost += cheapest[j];
      }
    }
  }

  return remainingBudget >= totalMinCost;
}

/**
 * Returns the current candidate player in the draft queue.
 * Only returns a player for whom draftPlayer would succeed:
 * - position still has an open slot
 * - not owned
 * - not skipped
 * - affordable (draft_cost <= budget)
 * - leaves enough budget and unseen players to fill all other open slots (budget guard passes)
 *
 * Players who fail affordability or budget guard are passed over automatically
 * and do NOT consume a skip.
 */
export function getCurrentCandidate(
  state: GameState,
  pool: readonly PlayerProfile[]
): PlayerProfile | null {
  if (state.phase !== 'DRAFT' || isRosterCompositionComplete(state.roster)) {
    return null;
  }

  const queue = shufflePool(pool, state.seed);
  const skippedSet = new Set(state.skippedIds);
  const ownedSet = new Set(getAllRosterPlayerIds(state.roster));
  const currentOpenSlots = getOpenSlotsCount(state.roster);

  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (ownedSet.has(p.id)) continue;
    if (skippedSet.has(p.id)) continue;
    if (currentOpenSlots[p.position] <= 0) continue;

    // Check affordability (passed over automatically if unaffordable)
    if (p.draft_cost > state.budget) continue;

    // Check budget guard if this candidate were drafted
    const remainingBudget = state.budget - p.draft_cost;
    const hypotheticalOpenSlots: Record<Position, number> = {
      ...currentOpenSlots,
      [p.position]: currentOpenSlots[p.position] - 1,
    };

    const unseenQueue = queue.slice(i + 1);
    const hypotheticalOwnedSet = new Set(ownedSet);
    hypotheticalOwnedSet.add(p.id);

    const guardPassed = checkBudgetGuard(
      remainingBudget,
      hypotheticalOpenSlots,
      unseenQueue,
      skippedSet,
      hypotheticalOwnedSet
    );

    if (!guardPassed) continue; // Budget guard failed -> passed over automatically

    return p;
  }

  return null;
}

export function draftPlayer(
  state: GameState,
  player: PlayerProfile,
  pool: readonly PlayerProfile[]
): { state: GameState; result: ActionResult } {
  if (state.phase !== 'DRAFT') {
    return { state, result: { ok: false, error: 'WRONG_PHASE' } };
  }

  const candidate = getCurrentCandidate(state, pool);
  if (!candidate || candidate.id !== player.id) {
    return { state, result: { ok: false, error: 'NOT_CURRENT_CANDIDATE' } };
  }

  if (isPlayerOwned(state.roster, player.id)) {
    return { state, result: { ok: false, error: 'ALREADY_OWNED' } };
  }

  if (state.roster[player.position].length >= POSITION_LIMITS[player.position]) {
    return { state, result: { ok: false, error: 'POSITION_FULL' } };
  }

  if (player.draft_cost > state.budget) {
    return { state, result: { ok: false, error: 'OVER_BUDGET' } };
  }

  // Budget guard check (verified explicitly in case candidate is passed directly)
  const queue = shufflePool(pool, state.seed);
  const candidateIndex = queue.findIndex((p) => p.id === player.id);
  const remainingBudget = state.budget - player.draft_cost;
  const currentOpenSlots = getOpenSlotsCount(state.roster);
  const hypotheticalOpenSlots: Record<Position, number> = {
    ...currentOpenSlots,
    [player.position]: currentOpenSlots[player.position] - 1,
  };
  const skippedSet = new Set(state.skippedIds);
  const ownedSet = new Set(getAllRosterPlayerIds(state.roster));
  ownedSet.add(player.id);

  const guardPassed = checkBudgetGuard(
    remainingBudget,
    hypotheticalOpenSlots,
    queue.slice(candidateIndex + 1),
    skippedSet,
    ownedSet
  );

  if (!guardPassed) {
    return { state, result: { ok: false, error: 'BUDGET_GUARD' } };
  }

  const transaction: Transaction = {
    playerId: player.id,
    year: 0,
    kind: 'DRAFT',
    amount: player.draft_cost,
  };

  const nextState: GameState = {
    ...state,
    budget: state.budget - player.draft_cost,
    roster: {
      ...state.roster,
      [player.position]: [...state.roster[player.position], player],
    },
    transactions: [...state.transactions, transaction],
  };

  return { state: nextState, result: { ok: true } };
}

export function skipCandidate(
  state: GameState,
  pool: readonly PlayerProfile[]
): { state: GameState; result: ActionResult } {
  if (state.phase !== 'DRAFT') {
    return { state, result: { ok: false, error: 'WRONG_PHASE' } };
  }

  if (state.skipsRemaining <= 0) {
    return { state, result: { ok: false, error: 'NO_SKIPS_LEFT' } };
  }

  const candidate = getCurrentCandidate(state, pool);
  if (!candidate) {
    return { state, result: { ok: false, error: 'NO_CANDIDATE' } };
  }

  // Budget guard check: skipping this candidate must leave enough budget and unseen players
  const queue = shufflePool(pool, state.seed);
  const candidateIndex = queue.findIndex((p) => p.id === candidate.id);
  const skippedSet = new Set(state.skippedIds);
  skippedSet.add(candidate.id);
  const ownedSet = new Set(getAllRosterPlayerIds(state.roster));
  const currentOpenSlots = getOpenSlotsCount(state.roster);

  const guardPassed = checkBudgetGuard(
    state.budget,
    currentOpenSlots,
    queue.slice(candidateIndex + 1),
    skippedSet,
    ownedSet
  );

  if (!guardPassed) {
    return { state, result: { ok: false, error: 'BUDGET_GUARD' } };
  }

  const nextState: GameState = {
    ...state,
    skipsRemaining: state.skipsRemaining - 1,
    skippedIds: [...state.skippedIds, candidate.id],
  };

  return { state: nextState, result: { ok: true } };
}

export function startReveal(state: GameState): { state: GameState; result: ActionResult } {
  if (state.phase !== 'DRAFT') {
    return { state, result: { ok: false, error: 'WRONG_PHASE' } };
  }

  if (!isRosterCompositionComplete(state.roster)) {
    return { state, result: { ok: false, error: 'ROSTER_INCOMPLETE' } };
  }

  const nextState: GameState = {
    ...state,
    phase: 'REVEAL',
    revealedCount: 0,
  };

  return { state: nextState, result: { ok: true } };
}

export function revealNext(state: GameState): { state: GameState; result: ActionResult } {
  if (state.phase !== 'REVEAL') {
    return { state, result: { ok: false, error: 'WRONG_PHASE' } };
  }

  if (state.revealedCount >= 7) {
    return { state, result: { ok: false, error: 'REVEAL_ALREADY_COMPLETE' } };
  }

  const nextState: GameState = {
    ...state,
    revealedCount: state.revealedCount + 1,
  };

  return { state: nextState, result: { ok: true } };
}

export function completeReveal(state: GameState): { state: GameState; result: ActionResult } {
  if (state.phase !== 'REVEAL') {
    return { state, result: { ok: false, error: 'WRONG_PHASE' } };
  }

  if (state.revealedCount < 7) {
    return { state, result: { ok: false, error: 'REVEAL_NOT_COMPLETE' } };
  }

  const nextState: GameState = {
    ...state,
    phase: 'SIMULATION',
    currentYear: 0,
  };

  return { state: nextState, result: { ok: true } };
}

export function sellPlayer(
  state: GameState,
  playerId: string
): { state: GameState; result: ActionResult } {
  if (state.phase !== 'SIMULATION') {
    return { state, result: { ok: false, error: 'WRONG_PHASE' } };
  }

  let foundPosition: Position | null = null;
  let playerToSell: PlayerProfile | null = null;

  for (const pos of POSITIONS) {
    const p = state.roster[pos].find((item) => item.id === playerId);
    if (p) {
      foundPosition = pos;
      playerToSell = p;
      break;
    }
  }

  if (!foundPosition || !playerToSell) {
    return { state, result: { ok: false, error: 'NOT_ON_ROSTER' } };
  }

  const saleAmount = playerToSell.yearly_values[state.currentYear];
  const transaction: Transaction = {
    playerId,
    year: state.currentYear,
    kind: 'SELL',
    amount: saleAmount,
  };

  const nextRoster: Roster = {
    ...state.roster,
    [foundPosition]: state.roster[foundPosition].filter((p) => p.id !== playerId),
  };

  const nextState: GameState = {
    ...state,
    budget: state.budget + saleAmount,
    roster: nextRoster,
    transactions: [...state.transactions, transaction],
  };

  return { state: nextState, result: { ok: true } };
}

export function advanceYear(state: GameState): { state: GameState; result: ActionResult } {
  if (state.phase !== 'SIMULATION') {
    return { state, result: { ok: false, error: 'WRONG_PHASE' } };
  }

  if (state.currentYear >= 10) {
    return { state, result: { ok: false, error: 'YEAR_LIMIT' } };
  }

  const nextState: GameState = {
    ...state,
    currentYear: state.currentYear + 1,
  };

  return { state: nextState, result: { ok: true } };
}

export function endSimulation(state: GameState): { state: GameState; result: ActionResult } {
  if (state.phase !== 'SIMULATION') {
    return { state, result: { ok: false, error: 'WRONG_PHASE' } };
  }

  if (state.currentYear !== 10) {
    return { state, result: { ok: false, error: 'SIMULATION_NOT_FINISHED' } };
  }

  const nextState: GameState = {
    ...state,
    phase: 'ENDGAME',
  };

  return { state: nextState, result: { ok: true } };
}

export function resetGame(seed: number = PLACEHOLDER_SEED): GameState {
  return createInitialState(seed);
}
