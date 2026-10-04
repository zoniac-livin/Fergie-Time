import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TacticalPitch } from '../components/draft/TacticalPitch';
import { formatEuros } from '../lib/ui/format';
import type { PlayerProfile, Roster } from '../types/game';
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

describe('TacticalPitch Strict Anonymity & Formation Rendering', () => {
  const pool = realPlayers as PlayerProfile[];

  // Select 7 distinct real players (1 GK, 2 DEF, 2 MID, 2 ATT) and clone with unique sentinels
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

  const emptyRoster: Roster = {
    GK: [],
    DEF: [],
    MID: [],
    ATT: [],
  };

  it('renders a filled roster with ZERO sentinel player names, IDs, image URLs, or draft seasons across all 4 positions', () => {
    const html = renderToStaticMarkup(<TacticalPitch roster={filledRoster} />);
    const allDrafted = [gk, ...defs, ...mids, ...atts];
    expect(allDrafted.length).toBe(7);

    // Top-level sentinel prefix checks (catches any plain-text or attribute leak)
    expect(html).not.toContain('PID_7f3a91');
    expect(html).not.toContain('NAME_c2d8e5');
    expect(html).not.toContain('IMG_91ab');
    expect(html).not.toContain('sentinel.invalid');
    expect(html).not.toContain('1987');

    // Verify for every single drafted player across all 4 positions (GK, DEF, MID, ATT)
    for (const player of allDrafted) {
      // 1. Player Name MUST NOT appear anywhere in rendered markup (plain text or attribute)
      expect(html).not.toContain(player.name);
      expect(html.toLowerCase()).not.toContain(player.name.toLowerCase());

      // 2. Player ID MUST NOT appear anywhere in rendered markup (plain text or attribute)
      expect(html).not.toContain(player.id);
      expect(html.toLowerCase()).not.toContain(player.id.toLowerCase());
      expect(html).not.toContain(`data-player-id`);
      expect(html).not.toContain(`data-id`);

      // 3. Image URL MUST NOT appear anywhere in rendered markup
      expect(html).not.toContain(player.image_url);
      expect(html.toLowerCase()).not.toContain(player.image_url.toLowerCase());
      expect(html.toLowerCase()).not.toContain('transfermarkt');

      // 4. Draft Season Year MUST NOT appear (no era leakage)
      expect(html).not.toContain(String(player.draft_season));

      // 5. Permitted anonymous data MUST be present: Cost and Age
      expect(html).toContain(formatEuros(player.draft_cost));
      expect(html).toContain(`AGE ${player.age_at_draft}`);
    }

    // Verify filled slot aria-labels
    expect(html).toContain(`Goalkeeper slot 1 filled, cost ${formatEuros(gk.draft_cost)}`);
    expect(html).toContain(`Defender slot 1 filled, cost ${formatEuros(defs[0].draft_cost)}`);
    expect(html).toContain(`Defender slot 2 filled, cost ${formatEuros(defs[1].draft_cost)}`);
    expect(html).toContain(`Midfielder slot 1 filled, cost ${formatEuros(mids[0].draft_cost)}`);
    expect(html).toContain(`Midfielder slot 2 filled, cost ${formatEuros(mids[1].draft_cost)}`);
    expect(html).toContain(`Attacker slot 1 filled, cost ${formatEuros(atts[0].draft_cost)}`);
    expect(html).toContain(`Attacker slot 2 filled, cost ${formatEuros(atts[1].draft_cost)}`);
  });

  it('renders an empty roster with all 7 slots in dashed empty state and correct labels', () => {
    const html = renderToStaticMarkup(<TacticalPitch roster={emptyRoster} />);

    // Check all 7 empty slot aria-labels
    expect(html).toContain('Goalkeeper slot 1 empty');
    expect(html).toContain('Defender slot 1 empty');
    expect(html).toContain('Defender slot 2 empty');
    expect(html).toContain('Midfielder slot 1 empty');
    expect(html).toContain('Midfielder slot 2 empty');
    expect(html).toContain('Attacker slot 1 empty');
    expect(html).toContain('Attacker slot 2 empty');

    // Slot position indicators
    expect(html).toContain('GK');
    expect(html).toContain('DEF');
    expect(html).toContain('MID');
    expect(html).toContain('ATT');

    // No costs should be rendered on empty pitch
    expect(html).not.toContain('€');
  });

  it('renders partial roster states correctly', () => {
    const partialRoster: Roster = {
      GK: [gk],
      DEF: [defs[0]],
      MID: [],
      ATT: [],
    };

    const html = renderToStaticMarkup(<TacticalPitch roster={partialRoster} />);

    // GK & DEF 1 are filled
    expect(html).toContain(`Goalkeeper slot 1 filled, cost ${formatEuros(gk.draft_cost)}`);
    expect(html).toContain(`Defender slot 1 filled, cost ${formatEuros(defs[0].draft_cost)}`);

    // DEF 2, MIDs, and ATTs are empty
    expect(html).toContain('Defender slot 2 empty');
    expect(html).toContain('Midfielder slot 1 empty');
    expect(html).toContain('Midfielder slot 2 empty');
    expect(html).toContain('Attacker slot 1 empty');
    expect(html).toContain('Attacker slot 2 empty');
  });
});
