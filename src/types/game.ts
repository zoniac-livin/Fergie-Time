export interface DraftStats {
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
}

export interface PlayerProfile {
  id: string;
  name: string;
  image_url: string;
  position: 'GK' | 'DEF' | 'MID' | 'ATT';
  age_at_draft: number;
  draft_cost: number;
  draft_season: number;
  draft_stats: DraftStats;
  yearly_values: number[]; // exactly 11 entries; index k = value k years after the draft season
}

export type GamePhase = 'DRAFT' | 'REVEAL' | 'SIMULATION' | 'ENDGAME';

export type Position = PlayerProfile['position'];

export interface Roster {
  GK: PlayerProfile[];
  DEF: PlayerProfile[];
  MID: PlayerProfile[];
  ATT: PlayerProfile[];
}

export type TransactionKind = 'DRAFT' | 'SELL';

export interface Transaction {
  playerId: string;
  year: number;
  kind: TransactionKind;
  amount: number;
}

export interface GameState {
  budget: number;
  currentYear: number;
  roster: Roster;
  phase: GamePhase;
  seed: number;
  skipsRemaining: number;
  skippedIds: string[];
  transactions: Transaction[];
  revealedCount: number;
}

export type ActionErrorCode =
  | 'WRONG_PHASE'
  | 'NOT_CURRENT_CANDIDATE'
  | 'ALREADY_OWNED'
  | 'POSITION_FULL'
  | 'OVER_BUDGET'
  | 'BUDGET_GUARD'
  | 'NO_SKIPS_LEFT'
  | 'ROSTER_INCOMPLETE'
  | 'REVEAL_NOT_COMPLETE'
  | 'REVEAL_ALREADY_COMPLETE'
  | 'NOT_ON_ROSTER'
  | 'YEAR_LIMIT'
  | 'SIMULATION_NOT_FINISHED'
  | 'NO_CANDIDATE';

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: ActionErrorCode };
