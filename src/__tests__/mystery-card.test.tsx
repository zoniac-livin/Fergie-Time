import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MysteryCard } from '../components/draft/MysteryCard';
import { createMysteryCandidateView } from '../lib/ui/mystery';
import type { PlayerProfile, Position } from '../types/game';
import realPlayers from '../data/players.json';

function withSentinel(player: PlayerProfile, tag: string): PlayerProfile {
  return {
    ...player,
    id: `PID_7f3a91_${tag}`,
    name: `NAME_c2d8e5_${tag}`,
    image_url: `https://sentinel.invalid/IMG_91ab_${tag}`,
    draft_season: 1987,
  };
}

describe('MysteryCard Strict Anonymity & Rendering', () => {
  const pool = realPlayers as PlayerProfile[];
  const positions: Position[] = ['GK', 'DEF', 'MID', 'ATT'];

  it('renders clones of real players across ALL four positions with zero sentinel id, name, image_url, or draft_season', () => {
    for (const pos of positions) {
      const rawCandidate = pool.find((p) => p.position === pos)!;
      expect(rawCandidate).toBeDefined();

      const candidate = withSentinel(rawCandidate, pos);
      const view = createMysteryCandidateView(candidate);
      const html = renderToStaticMarkup(<MysteryCard candidate={view} />);

      // 1. Sentinel strings MUST NOT appear anywhere in HTML (including plain text nodes or attributes)
      expect(html).not.toContain(candidate.id);
      expect(html.toLowerCase()).not.toContain(candidate.id.toLowerCase());
      expect(html).not.toContain('PID_7f3a91');
      expect(html).not.toContain('data-player-id');
      expect(html).not.toContain('data-id');

      expect(html).not.toContain(candidate.name);
      expect(html.toLowerCase()).not.toContain(candidate.name.toLowerCase());
      expect(html).not.toContain('NAME_c2d8e5');

      expect(html).not.toContain(candidate.image_url);
      expect(html.toLowerCase()).not.toContain(candidate.image_url.toLowerCase());
      expect(html).not.toContain('IMG_91ab');
      expect(html).not.toContain('sentinel.invalid');
      expect(html.toLowerCase()).not.toContain('transfermarkt');

      expect(html).not.toContain(String(candidate.draft_season));
      expect(html).not.toContain('1987');

      // 2. Permitted data MUST be rendered correctly
      expect(html).toContain(candidate.position);
      expect(html).toContain(`AGE ${candidate.age_at_draft}`);
      expect(html).toContain(candidate.draft_stats.appearances.toString());
    }
  });

  it('renders a real Goalkeeper without goals/90, assists/90, or clean sheets and zero sentinels', () => {
    const rawGk = pool.find((p) => p.position === 'GK')!;
    expect(rawGk).toBeDefined();

    const gk = withSentinel(rawGk, 'GK_SPECIAL');
    const view = createMysteryCandidateView(gk);
    const html = renderToStaticMarkup(<MysteryCard candidate={view} />);

    // Strict GK sentinel checks:
    expect(html).not.toContain(gk.id);
    expect(html).not.toContain(gk.name);
    expect(html).not.toContain(gk.image_url);
    expect(html).not.toContain(String(gk.draft_season));
    expect(html).not.toContain('PID_7f3a91');
    expect(html).not.toContain('NAME_c2d8e5');
    expect(html).not.toContain('IMG_91ab');
    expect(html).not.toContain('1987');

    // No invented stats or outfield stats on GK
    expect(html.toLowerCase()).not.toContain('clean sheet');
    expect(html.toLowerCase()).not.toContain('goals / 90');
    expect(html.toLowerCase()).not.toContain('assists / 90');

    // Correct GK metrics present
    expect(html).toContain('APPEARANCES');
    expect(html).toContain('MINUTES PLAYED');
    expect(html).toContain('YELLOW CARDS');
    expect(html).toContain('RED CARDS');
  });
});
