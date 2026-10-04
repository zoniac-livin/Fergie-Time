import { describe, it, expect } from 'vitest';
import {
  computeAge,
  getSeasonValuation,
  findDraftSeason,
  buildYearlyValues,
  POSITION_MAP,
} from '../../scripts/generate-pool';

// ─── Test 1: Games join (appearance with no matching game) ───────────────────

describe('games join', () => {
  it('maps appearances to seasons via game_id, excluding unmatched games', () => {
    // Simulate the join: gameSeasons maps game_id → season
    const gameSeasons = new Map<string, number>([
      ['g1', 2014],
      ['g2', 2015],
    ]);

    const appearances = [
      { game_id: 'g1', player_id: 1, minutes_played: 90 },
      { game_id: 'g2', player_id: 1, minutes_played: 45 },
      { game_id: 'g999', player_id: 1, minutes_played: 60 }, // no matching game
    ];

    let noMatch = 0;
    const seasonMinutes = new Map<number, number>();

    for (const app of appearances) {
      const season = gameSeasons.get(app.game_id);
      if (season === undefined) {
        noMatch++;
        continue;
      }
      seasonMinutes.set(season, (seasonMinutes.get(season) ?? 0) + app.minutes_played);
    }

    expect(noMatch).toBe(1);
    expect(seasonMinutes.get(2014)).toBe(90);
    expect(seasonMinutes.get(2015)).toBe(45);
    expect(seasonMinutes.has(2016)).toBe(false);
  });
});

// ─── Test 2: Earliest valid season selection ─────────────────────────────────

describe('earliest valid season selection', () => {
  it('picks the first season with >= 400 minutes AND a valuation', () => {
    const seasonMinutes = new Map<number, number>([
      [2014, 200], // not enough minutes
      [2015, 500], // enough minutes
      [2016, 600], // also enough, but later
    ]);

    const valuations = [
      { date: '2015-09-01', value: 20_000_000 }, // in 2015 window
      { date: '2016-09-01', value: 25_000_000 }, // in 2016 window
    ];

    const result = findDraftSeason(seasonMinutes, valuations);
    expect(result).not.toBeNull();
    expect(result!.draftSeason).toBe(2015);
    expect(result!.draftCost).toBe(20_000_000);
  });

  it('returns null when no season qualifies', () => {
    const seasonMinutes = new Map<number, number>([
      [2014, 200], // not enough minutes
    ]);

    const valuations = [
      { date: '2014-09-01', value: 20_000_000 },
    ];

    const result = findDraftSeason(seasonMinutes, valuations);
    expect(result).toBeNull();
  });

  it('skips a season with enough minutes but no valuation', () => {
    const seasonMinutes = new Map<number, number>([
      [2014, 500], // enough minutes, but no valuation
      [2015, 500], // enough minutes with valuation
    ]);

    const valuations = [
      { date: '2015-10-01', value: 15_000_000 }, // in 2015 window only
    ];

    const result = findDraftSeason(seasonMinutes, valuations);
    expect(result).not.toBeNull();
    expect(result!.draftSeason).toBe(2015);
  });
});

// ─── Test 3: Season valuation window boundaries ─────────────────────────────

describe('season valuation window boundaries', () => {
  it('includes 1 Aug S (start of window)', () => {
    const valuations = [
      { date: '2014-08-01', value: 10_000_000 },
    ];
    expect(getSeasonValuation(valuations, 2014)).toBe(10_000_000);
  });

  it('includes 31 Jul S+1 (end of window)', () => {
    const valuations = [
      { date: '2015-07-31', value: 12_000_000 },
    ];
    expect(getSeasonValuation(valuations, 2014)).toBe(12_000_000);
  });

  it('excludes 31 Jul S (day before window)', () => {
    const valuations = [
      { date: '2014-07-31', value: 8_000_000 },
    ];
    expect(getSeasonValuation(valuations, 2014)).toBeNull();
  });

  it('excludes 1 Aug S+1 (day after window)', () => {
    const valuations = [
      { date: '2015-08-01', value: 14_000_000 },
    ];
    expect(getSeasonValuation(valuations, 2014)).toBeNull();
  });

  it('picks the latest date within the window', () => {
    const valuations = [
      { date: '2014-08-01', value: 10_000_000 },
      { date: '2015-01-15', value: 11_000_000 },
      { date: '2015-07-31', value: 12_000_000 },
    ];
    expect(getSeasonValuation(valuations, 2014)).toBe(12_000_000);
  });
});

// ─── Test 4: Depreciation chaining ──────────────────────────────────────────

describe('depreciation chaining', () => {
  it('applies 0.75 factor chaining: 40M -> 30M -> 22.5M -> 16.875M', () => {
    // Player has valuation only at draft season (index 0), nothing after.
    // All indices 1..10 should depreciate.
    const draftSeason = 2014;
    const draftCost = 40_000_000;
    const valuations = [
      { date: '2014-09-01', value: 40_000_000 }, // only the draft season valuation
    ];

    const { values, depreciationIndices } = buildYearlyValues(draftSeason, draftCost, valuations);

    expect(values).toHaveLength(11);
    expect(values[0]).toBe(40_000_000);
    expect(values[1]).toBe(30_000_000);
    expect(values[2]).toBe(22_500_000);
    expect(values[3]).toBe(16_875_000);
    expect(values[4]).toBeCloseTo(12_656_250, 0);

    // All indices 1..10 should be depreciation
    expect(depreciationIndices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

// ─── Test 5: Mid-gap carry-forward ──────────────────────────────────────────

describe('mid-gap carry-forward', () => {
  it('carries forward when a later valuation exists', () => {
    // Valuation at year 0, gap at year 1-2, valuation at year 3.
    // Years 1-2 carry forward from year 0.
    // Year 3 uses real valuation.
    // Years 4-10: no later valuation → depreciate from year 3.
    const draftSeason = 2014;
    const draftCost = 20_000_000;
    const valuations = [
      { date: '2014-09-01', value: 20_000_000 }, // year 0 (draft season)
      { date: '2017-09-01', value: 25_000_000 }, // year 3
    ];

    const { values, depreciationIndices, carryForwardIndices } = buildYearlyValues(
      draftSeason,
      draftCost,
      valuations,
    );

    expect(values).toHaveLength(11);
    expect(values[0]).toBe(20_000_000); // draft cost
    expect(values[1]).toBe(20_000_000); // carry forward (later val exists at year 3)
    expect(values[2]).toBe(20_000_000); // carry forward (later val exists at year 3)
    expect(values[3]).toBe(25_000_000); // real valuation
    expect(values[4]).toBe(25_000_000 * 0.75); // depreciate
    expect(values[5]).toBeCloseTo(25_000_000 * 0.75 * 0.75, 0); // depreciate chain

    expect(carryForwardIndices).toEqual([1, 2]);
    expect(depreciationIndices).toEqual([4, 5, 6, 7, 8, 9, 10]);
  });
});

// ─── Test 6: Position mapping ───────────────────────────────────────────────

describe('position mapping', () => {
  it('maps all known sub_positions correctly', () => {
    expect(POSITION_MAP['Goalkeeper']).toBe('GK');
    expect(POSITION_MAP['Centre-Back']).toBe('DEF');
    expect(POSITION_MAP['Left-Back']).toBe('DEF');
    expect(POSITION_MAP['Right-Back']).toBe('DEF');
    expect(POSITION_MAP['Defensive Midfield']).toBe('MID');
    expect(POSITION_MAP['Central Midfield']).toBe('MID');
    expect(POSITION_MAP['Attacking Midfield']).toBe('MID');
    expect(POSITION_MAP['Left Midfield']).toBe('MID');
    expect(POSITION_MAP['Right Midfield']).toBe('MID');
    expect(POSITION_MAP['Left Winger']).toBe('ATT');
    expect(POSITION_MAP['Right Winger']).toBe('ATT');
    expect(POSITION_MAP['Centre-Forward']).toBe('ATT');
    expect(POSITION_MAP['Second Striker']).toBe('ATT');
  });

  it('returns undefined for unmapped positions', () => {
    expect(POSITION_MAP['Unknown Position']).toBeUndefined();
    expect(POSITION_MAP['']).toBeUndefined();
  });
});

// ─── Test 7: Deterministic output ───────────────────────────────────────────

describe('deterministic output', () => {
  it('two consecutive runs produce byte-identical JSON', () => {
    const draftSeason = 2015;
    const draftCost = 30_000_000;
    const valuations = [
      { date: '2015-09-01', value: 30_000_000 },
      { date: '2016-09-01', value: 28_000_000 },
    ];

    const run1 = buildYearlyValues(draftSeason, draftCost, valuations);
    const run2 = buildYearlyValues(draftSeason, draftCost, valuations);

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));

    // Also verify the actual values match
    expect(run1.values).toEqual(run2.values);
    expect(run1.depreciationIndices).toEqual(run2.depreciationIndices);
    expect(run1.carryForwardIndices).toEqual(run2.carryForwardIndices);
  });
});

// ─── Test 8: Age calculation ────────────────────────────────────────────────

describe('age calculation', () => {
  it('computes correct age when birthday is before Aug 1', () => {
    // Born 1990-06-15, ref date 1 Aug 2015 → 25 years old (birthday already passed)
    expect(computeAge('1990-06-15 00:00:00', 2015)).toBe(25);
  });

  it('computes correct age when birthday is after Aug 1', () => {
    // Born 1990-09-20, ref date 1 Aug 2015 → 24 years old (birthday hasn't passed)
    expect(computeAge('1990-09-20 00:00:00', 2015)).toBe(24);
  });

  it('handles birthday on exactly Aug 1 (birthday has occurred)', () => {
    // Born 1990-08-01, ref date 1 Aug 2015 → 25 years old
    // refMonth === birthMonth (8 === 8) and refDay >= birthDay (1 >= 1), so no subtraction
    expect(computeAge('1990-08-01 00:00:00', 2015)).toBe(25);
  });

  it('handles birthday on Aug 2 (birthday has NOT occurred yet)', () => {
    // Born 1990-08-02, ref date 1 Aug 2015 → 24 years old
    // refMonth === birthMonth (8 === 8) but refDay < birthDay (1 < 2), so subtract 1
    expect(computeAge('1990-08-02 00:00:00', 2015)).toBe(24);
  });

  it('handles birthday exactly on Dec 31 (far after ref date)', () => {
    // Born 1990-12-31, ref date 1 Aug 2015 → 24 years old
    expect(computeAge('1990-12-31', 2015)).toBe(24);
  });

  it('handles birthday on Jan 1 (before ref date)', () => {
    // Born 1990-01-01, ref date 1 Aug 2015 → 25 years old
    expect(computeAge('1990-01-01', 2015)).toBe(25);
  });
});
