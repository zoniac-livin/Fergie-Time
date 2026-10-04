import type {
  PlayerProfile,
  GameState,
  Position,
  Transaction,
} from '../../types/game';
import {
  INITIAL_BUDGET,
  isRosterCompositionComplete,
  getOpenSlotsCount,
} from './engine';

export interface ValueDelta {
  absolute: number;
  percent: number;
}

export interface InvestmentResult {
  player: PlayerProfile;
  roi: number;
  exitValue: number;
  profit: number;
}

export type FlopResult =
  | {
      status: 'FLOP';
      player: PlayerProfile;
      loss: number;
      exitValue: number;
      roi: number;
    }
  | {
      status: 'NEUTRAL';
      message: string;
    };

/**
 * Derives the list of drafted players from DRAFT transactions and the player pool.
 */
export function getDraftedPlayers(
  state: GameState,
  pool: readonly PlayerProfile[]
): PlayerProfile[] {
  const poolMap = new Map<string, PlayerProfile>(pool.map((p) => [p.id, p]));
  const drafted: PlayerProfile[] = [];

  for (const t of state.transactions) {
    if (t.kind === 'DRAFT') {
      const p = poolMap.get(t.playerId);
      if (p) {
        drafted.push(p);
      }
    }
  }

  return drafted;
}

/**
 * Returns sum of yearly_values[currentYear] for players currently on the roster.
 */
export function squadValue(state: GameState): number {
  let total = 0;
  const year = state.currentYear;
  const { GK, DEF, MID, ATT } = state.roster;

  for (let i = 0; i < GK.length; i++) total += GK[i].yearly_values[year];
  for (let i = 0; i < DEF.length; i++) total += DEF[i].yearly_values[year];
  for (let i = 0; i < MID.length; i++) total += MID[i].yearly_values[year];
  for (let i = 0; i < ATT.length; i++) total += ATT[i].yearly_values[year];

  return total;
}

/**
 * Returns total capital spent during the draft, derived strictly from DRAFT transactions.
 */
export function totalSpent(state: GameState): number {
  let spent = 0;
  for (let i = 0; i < state.transactions.length; i++) {
    const t = state.transactions[i];
    if (t.kind === 'DRAFT') {
      spent += t.amount;
    }
  }
  return spent;
}

/**
 * Returns total net worth: budget + squadValue.
 * Sale proceeds are already inside budget, so we never add sale amounts again.
 */
export function netWorth(state: GameState): number {
  return state.budget + squadValue(state);
}

/**
 * Computes net worth at a specific year given the transactions and all drafted players.
 * Used for the career/results progression chart.
 */
export function netWorthAt(
  year: number,
  transactions: readonly Transaction[],
  allDraftedPlayers: readonly PlayerProfile[]
): number {
  let budget = INITIAL_BUDGET;
  const soldPlayerIdsAtYear = new Set<string>();

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    if (t.year <= year) {
      if (t.kind === 'DRAFT') {
        budget -= t.amount;
      } else if (t.kind === 'SELL') {
        budget += t.amount;
        soldPlayerIdsAtYear.add(t.playerId);
      }
    }
  }

  let heldSquadValue = 0;
  for (let i = 0; i < allDraftedPlayers.length; i++) {
    const p = allDraftedPlayers[i];
    if (!soldPlayerIdsAtYear.has(p.id)) {
      heldSquadValue += p.yearly_values[year];
    }
  }

  return budget + heldSquadValue;
}

export function rosterComplete(state: GameState): boolean {
  return isRosterCompositionComplete(state.roster);
}

export function openSlots(state: GameState): Record<Position, number> {
  return getOpenSlotsCount(state.roster);
}

/**
 * Returns the 7 roster players in a deterministic fixed reveal order:
 * GK, DEF[0], DEF[1], MID[0], MID[1], ATT[0], ATT[1].
 */
export function getRevealOrder(state: GameState): PlayerProfile[] {
  const { GK, DEF, MID, ATT } = state.roster;
  return [...GK, ...DEF, ...MID, ...ATT];
}

/**
 * Computes difference vs previous year for a player.
 * Year 0 has no previous year.
 * Handles previous value of 0 gracefully (percent = 0, no NaN or Infinity).
 */
export function deltaVsPreviousYear(player: PlayerProfile, currentYear: number): ValueDelta {
  if (currentYear <= 0 || currentYear >= player.yearly_values.length) {
    return { absolute: 0, percent: 0 };
  }

  const curr = player.yearly_values[currentYear];
  const prev = player.yearly_values[currentYear - 1];
  const absolute = curr - prev;
  const percent = prev === 0 ? 0 : absolute / prev;

  return { absolute, percent };
}

/**
 * Exit value = SELL transaction amount if sold, otherwise yearly_values[10].
 */
export function getExitValue(
  player: PlayerProfile,
  transactions: readonly Transaction[]
): number {
  const sellTx = transactions.find((t) => t.playerId === player.id && t.kind === 'SELL');
  if (sellTx) {
    return sellTx.amount;
  }
  return player.yearly_values[10];
}

export function getPlayerROI(
  player: PlayerProfile,
  transactions: readonly Transaction[]
): number {
  const exitVal = getExitValue(player, transactions);
  return (exitVal - player.draft_cost) / player.draft_cost;
}

/**
 * Returns player with highest ROI among allDraftedPlayers.
 * Tie-break: lowest numeric player id wins.
 */
export function bestInvestment(
  state: GameState,
  allDraftedPlayers: readonly PlayerProfile[]
): InvestmentResult | null {
  if (allDraftedPlayers.length === 0) return null;

  const results: InvestmentResult[] = allDraftedPlayers.map((player) => {
    const exitValue = getExitValue(player, state.transactions);
    const roi = (exitValue - player.draft_cost) / player.draft_cost;
    const profit = exitValue - player.draft_cost;
    return { player, roi, exitValue, profit };
  });

  results.sort((a, b) => {
    if (b.roi !== a.roi) {
      return b.roi - a.roi;
    }
    return Number(a.player.id) - Number(b.player.id);
  });

  return results[0];
}

/**
 * Returns player with most negative (exitValue - draft_cost) in euros.
 * If nobody lost value, returns a neutral status object.
 * Tie-break: lowest numeric player id wins.
 */
export function worstFlop(
  state: GameState,
  allDraftedPlayers: readonly PlayerProfile[]
): FlopResult {
  if (allDraftedPlayers.length === 0) {
    return { status: 'NEUTRAL', message: 'No players drafted' };
  }

  const flops: Array<{
    player: PlayerProfile;
    profit: number;
    exitValue: number;
    roi: number;
  }> = [];

  for (const player of allDraftedPlayers) {
    const exitValue = getExitValue(player, state.transactions);
    const profit = exitValue - player.draft_cost;
    if (profit < 0) {
      const roi = profit / player.draft_cost;
      flops.push({ player, profit, exitValue, roi });
    }
  }

  if (flops.length === 0) {
    return { status: 'NEUTRAL', message: 'No players lost value' };
  }

  flops.sort((a, b) => {
    if (a.profit !== b.profit) {
      return a.profit - b.profit; // Most negative first
    }
    return Number(a.player.id) - Number(b.player.id);
  });

  const worst = flops[0];
  return {
    status: 'FLOP',
    player: worst.player,
    loss: Math.abs(worst.profit),
    exitValue: worst.exitValue,
    roi: worst.roi,
  };
}

export interface TransactionLogEntry {
  playerId: string;
  playerName: string;
  year: number;
  kind: 'DRAFT' | 'SELL';
  amount: number;
}

/**
 * Joins transactions with player names from the pool to produce a display-ready log.
 * Chronological order (same as state.transactions).
 */
export function getTransactionLog(
  state: GameState,
  pool: readonly PlayerProfile[]
): TransactionLogEntry[] {
  const poolMap = new Map<string, string>(pool.map((p) => [p.id, p.name]));
  return state.transactions.map((t) => ({
    playerId: t.playerId,
    playerName: poolMap.get(t.playerId) ?? 'Unknown',
    year: t.year,
    kind: t.kind,
    amount: t.amount,
  }));
}

export function playerPeakValue(player: PlayerProfile): number {
  return Math.max(...player.yearly_values);
}

export function playerLowestValue(player: PlayerProfile): number {
  return Math.min(...player.yearly_values);
}

export interface AnnualChangeAnnotation {
  year: number;
  change: number;
}

export interface NetWorthAnnotations {
  largestGain: AnnualChangeAnnotation | null;
  largestLoss: AnnualChangeAnnotation | null;
}

/**
 * Computes the largest single-year net worth gain and loss from yearly net worth values (Year 0..N).
 * - Only non-zero changes are considered.
 * - Ties resolve to the earliest year.
 * - If no gains exist, largestGain is null; if no losses exist, largestLoss is null.
 */
export function getNetWorthAnnotations(
  yearlyNetWorth: readonly number[]
): NetWorthAnnotations {
  let largestGain: AnnualChangeAnnotation | null = null;
  let largestLoss: AnnualChangeAnnotation | null = null;

  for (let yr = 1; yr < yearlyNetWorth.length; yr++) {
    const diff = yearlyNetWorth[yr] - yearlyNetWorth[yr - 1];

    if (diff > 0) {
      if (!largestGain || diff > largestGain.change) {
        // Strict inequality picks the earliest year on ties
        largestGain = { year: yr, change: diff };
      }
    } else if (diff < 0) {
      if (!largestLoss || diff < largestLoss.change) {
        // Strict inequality picks the earliest year on ties (most negative change)
        largestLoss = { year: yr, change: diff };
      }
    }
  }

  return { largestGain, largestLoss };
}

export type PlayerExitStatus =
  | { status: 'RETAINED' }
  | { status: 'SOLD'; year: number };

/**
 * Returns whether a drafted player was retained through Year 10 or sold at a specific year.
 */
export function getPlayerExitStatus(
  player: PlayerProfile,
  transactions: readonly Transaction[]
): PlayerExitStatus {
  const sellTx = transactions.find((t) => t.playerId === player.id && t.kind === 'SELL');
  if (sellTx) {
    return { status: 'SOLD', year: sellTx.year };
  }
  return { status: 'RETAINED' };
}

/**
 * Returns net euro profit (exitValue - draft_cost) for a drafted player.
 */
export function getPlayerEuroProfit(
  player: PlayerProfile,
  transactions: readonly Transaction[]
): number {
  return getExitValue(player, transactions) - player.draft_cost;
}

