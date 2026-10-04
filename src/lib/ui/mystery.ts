import type { PlayerProfile } from '../../types/game';
import type { MysteryCandidateView } from '../../types/ui';

/**
 * Transforms a PlayerProfile into an anonymized MysteryCandidateView.
 * Strict rules:
 * - GK shows only appearances, minutes, yellow and red cards. No clean sheets or outfield stats.
 * - Outfield shows appearances, minutes, cards, goals/90 and assists/90.
 * - No name, id, image, club, or draft season.
 */
export function createMysteryCandidateView(player: PlayerProfile): MysteryCandidateView {
  const isOutfield = player.position !== 'GK';
  const minutes = player.draft_stats.minutes;
  const ninetyMinuteUnits = minutes > 0 ? minutes / 90 : 0;

  const goalsPer90 =
    isOutfield && ninetyMinuteUnits > 0
      ? Number((player.draft_stats.goals / ninetyMinuteUnits).toFixed(2))
      : undefined;

  const assistsPer90 =
    isOutfield && ninetyMinuteUnits > 0
      ? Number((player.draft_stats.assists / ninetyMinuteUnits).toFixed(2))
      : undefined;

  return {
    position: player.position,
    age_at_draft: player.age_at_draft,
    draft_cost: player.draft_cost,
    stats: {
      appearances: player.draft_stats.appearances,
      minutes: player.draft_stats.minutes,
      yellow_cards: player.draft_stats.yellow_cards,
      red_cards: player.draft_stats.red_cards,
      goalsPer90,
      assistsPer90,
    },
  };
}
