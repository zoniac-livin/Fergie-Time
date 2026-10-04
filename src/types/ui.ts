import type { Position } from './game';

export interface MysteryStats {
  appearances: number;
  minutes: number;
  yellow_cards: number;
  red_cards: number;
  goalsPer90?: number;   // Outfield only
  assistsPer90?: number; // Outfield only
}

/**
 * Anonymized view of a candidate player for the Mystery Card.
 * Strict anonymity guarantee:
 * - NO player ID
 * - NO name, image, club, or country
 * - NO draft season or era hint
 */
export interface MysteryCandidateView {
  position: Position;
  age_at_draft: number;
  draft_cost: number;
  stats: MysteryStats;
}
