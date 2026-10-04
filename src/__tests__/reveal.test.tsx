import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RevealCard } from '../components/reveal/RevealCard';
import { RevealPitch } from '../components/reveal/RevealPitch';
import { ClubValuePanel } from '../components/reveal/ClubValuePanel';
import { useGameStore } from '../store/gameStore';
import { getRevealOrder, netWorth, squadValue } from '../lib/game/selectors';
import { formatEuros } from '../lib/ui/format';
import type { PlayerProfile, Roster, GameState } from '../types/game';
import realPlayers from '../data/players.json';

const pool = realPlayers as PlayerProfile[];

function withSentinel(player: PlayerProfile, tag: string): PlayerProfile {
  return {
    ...player,
    id: `PID_7f3a91_${tag}`,
    name: `NAME_c2d8e5_${tag}`,
    image_url: `https://sentinel.invalid/IMG_91ab_${tag}`,
    draft_season: 1987,
  };
}

function buildMockRoster(poolPlayers: PlayerProfile[]): Roster {
  const gk = poolPlayers.find((p) => p.position === 'GK')!;
  const defs = poolPlayers.filter((p) => p.position === 'DEF').slice(0, 2);
  const mids = poolPlayers.filter((p) => p.position === 'MID').slice(0, 2);
  const atts = poolPlayers.filter((p) => p.position === 'ATT').slice(0, 2);

  return {
    GK: [gk],
    DEF: defs,
    MID: mids,
    ATT: atts,
  };
}

describe('Task 3b Checkpoint (a) Reveal Route Tests', () => {
  let sampleRoster: Roster;

  beforeEach(() => {
    sampleRoster = buildMockRoster(pool);
    useGameStore.getState().startNewGame(9999);
  });

  describe('1. Selector getRevealOrder', () => {
    it('returns exactly 7 players in deterministic order: GK, DEF, DEF, MID, MID, ATT, ATT', () => {
      const mockState: GameState = {
        ...useGameStore.getState(),
        roster: sampleRoster,
        phase: 'REVEAL',
      };

      const order = getRevealOrder(mockState);
      expect(order).toHaveLength(7);
      expect(order[0].position).toBe('GK');
      expect(order[1].position).toBe('DEF');
      expect(order[2].position).toBe('DEF');
      expect(order[3].position).toBe('MID');
      expect(order[4].position).toBe('MID');
      expect(order[5].position).toBe('ATT');
      expect(order[6].position).toBe('ATT');

      expect(order[0].id).toBe(sampleRoster.GK[0].id);
      expect(order[1].id).toBe(sampleRoster.DEF[0].id);
      expect(order[2].id).toBe(sampleRoster.DEF[1].id);
      expect(order[3].id).toBe(sampleRoster.MID[0].id);
      expect(order[4].id).toBe(sampleRoster.MID[1].id);
      expect(order[5].id).toBe(sampleRoster.ATT[0].id);
      expect(order[6].id).toBe(sampleRoster.ATT[1].id);
    });
  });

  describe('2. Strict Hidden-Until-Revealed DOM Anonymity & Sentinel Leak Prevention', () => {
    it('face-down cards contain NO sentinel id, name, image_url, draft_season, or <img>', () => {
      const basePlayer = pool.find((p) => p.position === 'ATT')!;
      const sentinelPlayer = withSentinel(basePlayer, 'TEST_FACE_DOWN');

      const html = renderToStaticMarkup(
        <RevealCard
          player={sentinelPlayer}
          index={0}
          isRevealed={false}
          isTarget={true}
        />
      );

      // Sentinels MUST NOT exist in DOM
      expect(html).not.toContain(sentinelPlayer.id);
      expect(html).not.toContain('PID_7f3a91');
      expect(html).not.toContain(sentinelPlayer.name);
      expect(html).not.toContain('NAME_c2d8e5');
      expect(html).not.toContain(sentinelPlayer.image_url);
      expect(html).not.toContain('IMG_91ab');
      expect(html).not.toContain('sentinel.invalid');
      expect(html).not.toContain(String(sentinelPlayer.draft_season));
      expect(html).not.toContain('1987');

      // No image element or preloads rendered for unrevealed card
      expect(html).not.toContain('<img');
      expect(html).not.toContain('rel="preload"');

      // Permitted data only
      expect(html).toContain(sentinelPlayer.position);
      expect(html).toContain(formatEuros(sentinelPlayer.draft_cost));
      expect(html).toContain('#1');
      expect(html).toContain('data-card-state="face-down"');
    });

    it('revealed card shows name and image_url, but NEVER id or draft_season year', () => {
      const basePlayer = pool.find((p) => p.position === 'MID')!;
      const sentinelPlayer = withSentinel(basePlayer, 'TEST_REVEALED');

      const html = renderToStaticMarkup(
        <RevealCard
          player={sentinelPlayer}
          index={1}
          isRevealed={true}
          isTarget={true}
        />
      );

      // Permitted identification
      expect(html).toContain(sentinelPlayer.name);
      expect(html).toContain(sentinelPlayer.image_url);
      expect(html).toContain(sentinelPlayer.position);
      expect(html).toContain(`AGE ${sentinelPlayer.age_at_draft}`);
      expect(html).toContain(formatEuros(sentinelPlayer.draft_cost));
      expect(html).toContain(String(sentinelPlayer.draft_stats.appearances));
      expect(html).toContain(String(sentinelPlayer.draft_stats.goals));

      // Strictly FORBIDDEN data: id and draft_season year
      expect(html).not.toContain(sentinelPlayer.id);
      expect(html).not.toContain('PID_7f3a91');
      expect(html).not.toContain(String(sentinelPlayer.draft_season));
      expect(html).not.toContain('1987');

      // No club, nationality, or badge
      expect(html).not.toContain('club');
      expect(html).not.toContain('nationality');
      expect(html).not.toContain('country');
      expect(html).not.toContain('badge');
    });

    it('renders neutral silhouette when image_url is empty', () => {
      const basePlayer = pool[0];
      const emptyPhotoPlayer: PlayerProfile = {
        ...basePlayer,
        image_url: '',
      };

      const html = renderToStaticMarkup(
        <RevealCard
          player={emptyPhotoPlayer}
          index={2}
          isRevealed={true}
        />
      );

      expect(html).not.toContain('<img');
      expect(html).toContain('data-testid="silhouette-fallback"');
    });

    it('RevealPitch unrevealed slots contain zero sentinels, while revealed slots show name and thumbnail', () => {
      const sentinelRoster: Roster = {
        GK: [withSentinel(sampleRoster.GK[0], 'GK')],
        DEF: [withSentinel(sampleRoster.DEF[0], 'DEF0'), withSentinel(sampleRoster.DEF[1], 'DEF1')],
        MID: [withSentinel(sampleRoster.MID[0], 'MID0'), withSentinel(sampleRoster.MID[1], 'MID1')],
        ATT: [withSentinel(sampleRoster.ATT[0], 'ATT0'), withSentinel(sampleRoster.ATT[1], 'ATT1')],
      };

      // When revealedCount = 0 (all locked)
      const lockedHtml = renderToStaticMarkup(
        <RevealPitch roster={sentinelRoster} revealedCount={0} />
      );

      expect(lockedHtml).not.toContain('PID_7f3a91');
      expect(lockedHtml).not.toContain('NAME_c2d8e5');
      expect(lockedHtml).not.toContain('IMG_91ab');
      expect(lockedHtml).not.toContain('1987');
      expect(lockedHtml).not.toContain('<img');

      // When revealedCount = 1 (only GK revealed)
      const oneRevealedHtml = renderToStaticMarkup(
        <RevealPitch roster={sentinelRoster} revealedCount={1} />
      );

      // GK name and image thumbnail are visible
      expect(oneRevealedHtml).toContain(sentinelRoster.GK[0].name);
      expect(oneRevealedHtml).toContain(sentinelRoster.GK[0].image_url);

      // Unrevealed outfield players are still completely absent
      expect(oneRevealedHtml).not.toContain(sentinelRoster.DEF[0].name);
      expect(oneRevealedHtml).not.toContain(sentinelRoster.DEF[0].image_url);
      expect(oneRevealedHtml).not.toContain(sentinelRoster.ATT[1].name);
      expect(oneRevealedHtml).not.toContain('1987');
      expect(oneRevealedHtml).not.toContain('PID_7f3a91');
    });
  });

  describe('3. Step-by-Step Reveal Progression and Engine Integration', () => {
    it('reveals exactly N cards after N revealNext() calls and transitions to SIMULATION on completeReveal()', () => {
      useGameStore.setState({
        roster: sampleRoster,
        phase: 'REVEAL',
        revealedCount: 0,
      });

      const store = useGameStore.getState();
      expect(store.phase).toBe('REVEAL');
      expect(store.revealedCount).toBe(0);

      // Incrementally reveal 1 through 7
      for (let step = 1; step <= 7; step++) {
        const nextRes = store.revealNext();
        expect(nextRes.ok).toBe(true);
        expect(useGameStore.getState().revealedCount).toBe(step);
      }

      // 8th call fails with REVEAL_ALREADY_COMPLETE
      const overRes = store.revealNext();
      expect(overRes.ok).toBe(false);
      if (!overRes.ok) {
        expect(overRes.error).toBe('REVEAL_ALREADY_COMPLETE');
      }

      // completeReveal() moves to SIMULATION with currentYear 0
      const completeRes = store.completeReveal();
      expect(completeRes.ok).toBe(true);
      expect(useGameStore.getState().phase).toBe('SIMULATION');
      expect(useGameStore.getState().currentYear).toBe(0);
    });
  });

  describe('4. Club Value Panel & Exact Post-Draft Invariant (€250,000,000)', () => {
    it('calculates netWorth right after the draft as exactly €250,000,000', () => {
      const allSeven = [
        sampleRoster.GK[0],
        sampleRoster.DEF[0],
        sampleRoster.DEF[1],
        sampleRoster.MID[0],
        sampleRoster.MID[1],
        sampleRoster.ATT[0],
        sampleRoster.ATT[1],
      ];
      const spent = allSeven.reduce((sum, p) => sum + p.draft_cost, 0);
      const txs = allSeven.map((p) => ({
        playerId: p.id,
        year: 0,
        kind: 'DRAFT' as const,
        amount: p.draft_cost,
      }));

      useGameStore.setState({
        budget: 250_000_000 - spent,
        currentYear: 0,
        roster: sampleRoster,
        phase: 'REVEAL',
        revealedCount: 7,
        transactions: txs,
      });

      const state = useGameStore.getState();

      // Right after draft, netWorth must equal €250,000,000
      const worth = netWorth(state);
      expect(worth).toBe(250_000_000);
      expect(state.budget + squadValue(state)).toBe(250_000_000);

      // Check ClubValuePanel rendering
      const panelHtml = renderToStaticMarkup(
        <ClubValuePanel
          netWorth={worth}
          budget={state.budget}
          squadValue={squadValue(state)}
          onStartSimulation={() => {}}
        />
      );

      expect(panelHtml).toContain(formatEuros(250_000_000));
      expect(panelHtml).toContain('Valued at Year 0 prices');
      expect(panelHtml).toContain('Remaining budget');
      expect(panelHtml).toContain('Squad market value');
      expect(panelHtml).toContain(formatEuros(state.budget));
      expect(panelHtml).toContain(formatEuros(squadValue(state)));
      expect(panelHtml).toContain('START SIMULATION');
    });
  });

  describe('5. Resume After Refresh Behavior', () => {
    it('renders cards with index < revealedCount as revealed and remaining as face down', () => {
      const mockState: GameState = {
        ...useGameStore.getState(),
        roster: sampleRoster,
        phase: 'REVEAL',
        revealedCount: 3, // Persisted count: 3 revealed, 4 face-down
      };

      const order = getRevealOrder(mockState);

      const renderedCards = order.map((player, idx) =>
        renderToStaticMarkup(
          <RevealCard
            key={`card-${idx}`}
            player={player}
            index={idx}
            isRevealed={idx < mockState.revealedCount}
          />
        )
      );

      // Indices 0, 1, 2 must be revealed
      expect(renderedCards[0]).toContain('data-card-state="revealed"');
      expect(renderedCards[0]).toContain(order[0].name);

      expect(renderedCards[1]).toContain('data-card-state="revealed"');
      expect(renderedCards[1]).toContain(order[1].name);

      expect(renderedCards[2]).toContain('data-card-state="revealed"');
      expect(renderedCards[2]).toContain(order[2].name);

      // Indices 3, 4, 5, 6 must be face-down
      for (let i = 3; i < 7; i++) {
        expect(renderedCards[i]).toContain('data-card-state="face-down"');
        expect(renderedCards[i]).not.toContain(order[i].name);
        expect(renderedCards[i]).not.toContain('<img');
      }
    });
  });
});
