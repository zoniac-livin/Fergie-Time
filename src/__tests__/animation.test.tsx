import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MysteryCard } from '../components/draft/MysteryCard';
import { TacticalPitch } from '../components/draft/TacticalPitch';
import { AnimatedBudget } from '../components/draft/AnimatedBudget';
import { useGameStore } from '../store/gameStore';
import { INITIAL_BUDGET } from '../lib/game/engine';
import { createMysteryCandidateView } from '../lib/ui/mystery';
import { formatEuros } from '../lib/ui/format';
import type { PlayerProfile, Roster } from '../types/game';
import realPlayers from '../data/players.json';

// Mock framer-motion's useReducedMotion to simulate both modes
const mockUseReducedMotion = vi.fn();
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    useReducedMotion: () => mockUseReducedMotion(),
  };
});

describe('Animation Checkpoint (c) Tests', () => {
  const pool = realPlayers as PlayerProfile[];

  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
    useGameStore.getState().startNewGame(12345);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AnimatedBudget & Store Draft Integration', () => {
    it('displays the exact initial store budget before a draft', () => {
      const storeBudget = useGameStore.getState().budget;
      expect(storeBudget).toBe(INITIAL_BUDGET);

      const html = renderToStaticMarkup(<AnimatedBudget budget={storeBudget} />);
      expect(html).toContain(formatEuros(storeBudget));
      expect(html).toContain('data-testid="budget-display"');
    });

    it('counter final displayed value equals the store budget after a draft', () => {
      const candidate = useGameStore.getState().getCurrentCandidate();
      expect(candidate).not.toBeNull();

      const res = useGameStore.getState().draftPlayer(candidate!);
      expect(res.ok).toBe(true);

      const newStoreBudget = useGameStore.getState().budget;
      expect(newStoreBudget).toBe(INITIAL_BUDGET - candidate!.draft_cost);

      const counterHtml = renderToStaticMarkup(<AnimatedBudget budget={newStoreBudget} />);
      expect(counterHtml).toContain(formatEuros(newStoreBudget));
      expect(counterHtml).toContain(`Remaining budget: ${formatEuros(newStoreBudget)}`);
    });

    it('includes aria-live region with final budget value only', () => {
      const budget = 123_456_789;
      const html = renderToStaticMarkup(<AnimatedBudget budget={budget} />);
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain(`Remaining budget: ${formatEuros(budget)}`);
    });
  });

  describe('Reduced Motion Mode', () => {
    beforeEach(() => {
      mockUseReducedMotion.mockReturnValue(true);
    });

    it('AnimatedBudget shows final value immediately with reduced motion after a draft', () => {
      const candidate = useGameStore.getState().getCurrentCandidate()!;
      useGameStore.getState().draftPlayer(candidate);
      const finalBudget = useGameStore.getState().budget;

      const html = renderToStaticMarkup(<AnimatedBudget budget={finalBudget} />);
      expect(html).toContain(formatEuros(finalBudget));
    });

    it('TacticalPitch renders filled slots statically with reduced motion (no hidden opacity)', () => {
      const gk = pool.find((p) => p.position === 'GK')!;
      const defs = pool.filter((p) => p.position === 'DEF').slice(0, 2);
      const mids = pool.filter((p) => p.position === 'MID').slice(0, 2);
      const atts = pool.filter((p) => p.position === 'ATT').slice(0, 2);

      const filledRoster: Roster = {
        GK: [gk],
        DEF: [defs[0], defs[1]],
        MID: [mids[0], mids[1]],
        ATT: [atts[0], atts[1]],
      };

      const html = renderToStaticMarkup(<TacticalPitch roster={filledRoster} />);

      // All filled slots should show cost and age immediately without opacity:0
      expect(html).not.toContain('opacity:0');
      expect(html).toContain(formatEuros(gk.draft_cost));
      expect(html).toContain(`AGE ${gk.age_at_draft}`);
      expect(html).toContain(formatEuros(defs[0].draft_cost));
      expect(html).toContain(formatEuros(atts[1].draft_cost));

      // Filled slot aria labels
      expect(html).toContain(`Goalkeeper slot 1 filled, cost ${formatEuros(gk.draft_cost)}`);
    });

    it('MysteryCard renders all data statically with reduced motion (no tilt styles)', () => {
      const candidate = pool.find((p) => p.position === 'ATT' && p.name.includes('Klose'))!;
      const view = createMysteryCandidateView(candidate);
      const html = renderToStaticMarkup(<MysteryCard candidate={view} />);

      expect(html).toContain(candidate.position);
      expect(html).toContain(`AGE ${candidate.age_at_draft}`);
      expect(html).toContain(formatEuros(candidate.draft_cost));
      expect(html).not.toContain('rotateX');
    });
  });

  describe('Anonymity with animated components', () => {
    function withSentinel(player: PlayerProfile, tag: string): PlayerProfile {
      return {
        ...player,
        id: `PID_7f3a91_${tag}`,
        name: `NAME_c2d8e5_${tag}`,
        image_url: `https://sentinel.invalid/IMG_91ab_${tag}`,
        draft_season: 1987,
      };
    }

    it('MysteryCard with motion wrapper still has zero sentinel identifiers across all 4 positions', () => {
      const positions = ['GK', 'DEF', 'MID', 'ATT'] as const;
      for (const pos of positions) {
        const rawCandidate = pool.find((p) => p.position === pos)!;
        const candidate = withSentinel(rawCandidate, pos);
        const view = createMysteryCandidateView(candidate);
        const html = renderToStaticMarkup(<MysteryCard candidate={view} />);

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
      }
    });

    it('TacticalPitch with motion slots still has zero sentinel identifiers across all 4 positions', () => {
      const rawGk = pool.find((p) => p.position === 'GK')!;
      const rawDefs = pool.filter((p) => p.position === 'DEF').slice(0, 2);
      const rawMids = pool.filter((p) => p.position === 'MID').slice(0, 2);
      const rawAtts = pool.filter((p) => p.position === 'ATT').slice(0, 2);

      const gk = withSentinel(rawGk, 'GK_0');
      const defs = [withSentinel(rawDefs[0], 'DEF_0'), withSentinel(rawDefs[1], 'DEF_1')];
      const mids = [withSentinel(rawMids[0], 'MID_0'), withSentinel(rawMids[1], 'MID_1')];
      const atts = [withSentinel(rawAtts[0], 'ATT_0'), withSentinel(rawAtts[1], 'ATT_1')];

      const filledRoster: Roster = {
        GK: [gk],
        DEF: [defs[0], defs[1]],
        MID: [mids[0], mids[1]],
        ATT: [atts[0], atts[1]],
      };

      const html = renderToStaticMarkup(<TacticalPitch roster={filledRoster} />);
      const allDrafted = [gk, ...defs, ...mids, ...atts];

      expect(html).not.toContain('PID_7f3a91');
      expect(html).not.toContain('NAME_c2d8e5');
      expect(html).not.toContain('IMG_91ab');
      expect(html).not.toContain('sentinel.invalid');
      expect(html).not.toContain('1987');

      for (const player of allDrafted) {
        expect(html).not.toContain(player.id);
        expect(html.toLowerCase()).not.toContain(player.id.toLowerCase());
        expect(html).not.toContain(player.name);
        expect(html.toLowerCase()).not.toContain(player.name.toLowerCase());
        expect(html).not.toContain('data-player-id');
        expect(html).not.toContain('data-id');
        expect(html).not.toContain(player.image_url);
        expect(html.toLowerCase()).not.toContain(player.image_url.toLowerCase());
        expect(html.toLowerCase()).not.toContain('transfermarkt');
        expect(html).not.toContain(String(player.draft_season));
      }
    });
  });
});
