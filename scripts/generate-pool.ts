/**
 * ETL pipeline: generate src/data/players.json from raw CSV data.
 *
 * Run with: pnpm generate-pool
 *
 * Input files (from /Data):
 *   players.csv.gz, appearances.csv.gz, games.csv.gz, player_valuations.csv.gz
 *
 * Output: src/data/players.json — array of PlayerProfile objects.
 */
import { createReadStream } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { parse } from 'csv-parse';
import path from 'node:path';
import type { PlayerProfile } from '../src/types/game';

// ─── Constants ───────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(import.meta.dirname, '..', 'Data');
const OUTPUT_DIR = path.resolve(import.meta.dirname, '..', 'src', 'data');
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'players.json');

const DRAFT_SEASONS = [2014, 2015, 2016, 2017, 2018] as const;
const MIN_SEASON = 2014;
const MAX_SEASON = 2018;
const YEARLY_VALUES_LENGTH = 11; // indices 0..10
const MIN_SEASON_MINUTES = 400;
const MIN_PEAK_VALUE = 10_000_000;
const DEPRECIATION_FACTOR = 0.75;

const TOP_10_LEAGUES = new Set([
  'GB1', 'ES1', 'IT1', 'L1', 'FR1', 'PO1', 'NL1', 'BE1', 'TR1', 'SC1',
]);

// ─── Position mapping ────────────────────────────────────────────────────────

export const POSITION_MAP: Record<string, PlayerProfile['position'] | undefined> = {
  'Goalkeeper': 'GK',
  'Centre-Back': 'DEF',
  'Left-Back': 'DEF',
  'Right-Back': 'DEF',
  'Defensive Midfield': 'MID',
  'Central Midfield': 'MID',
  'Attacking Midfield': 'MID',
  'Left Midfield': 'MID',
  'Right Midfield': 'MID',
  'Left Winger': 'ATT',
  'Right Winger': 'ATT',
  'Centre-Forward': 'ATT',
  'Second Striker': 'ATT',
};

// ─── Types for internal processing ───────────────────────────────────────────

interface PlayerRaw {
  player_id: number;
  name: string;
  image_url: string;
  sub_position: string;
  date_of_birth: string; // "YYYY-MM-DD HH:MM:SS" or ""
  highest_market_value_in_eur: number;
}

/** Aggregated appearance stats per (player_id, season). */
export interface SeasonAppearanceAgg {
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
}

interface Valuation {
  date: string; // "YYYY-MM-DD"
  value: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createCsvParser(filename: string) {
  const filepath = path.join(DATA_DIR, filename);
  return createReadStream(filepath)
    .pipe(createGunzip())
    .pipe(parse({ columns: true, skip_empty_lines: true }));
}

/** Parse an integer, returning NaN for empty/non-numeric strings. */
function safeInt(val: string | undefined): number {
  if (val === undefined || val === '') return NaN;
  return parseInt(val, 10);
}

/**
 * Exact age calculation: year difference minus 1 if the birthday hasn't
 * occurred by the reference date.
 */
export function computeAge(dateOfBirth: string, refYear: number): number {
  // date_of_birth format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD"
  const dob = dateOfBirth.slice(0, 10); // "YYYY-MM-DD"
  const [birthYear, birthMonth, birthDay] = dob.split('-').map(Number);

  const refMonth = 8; // August
  const refDay = 1;

  let age = refYear - birthYear;
  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age -= 1;
  }
  return age;
}

/**
 * Determine the season valuation: the latest valuation dated from
 * 1 Aug S to 31 Jul S+1 inclusive.
 */
export function getSeasonValuation(
  valuations: Valuation[],
  season: number,
): number | null {
  // Window: [S-08-01, (S+1)-07-31]
  const windowStart = `${season}-08-01`;
  const windowEnd = `${season + 1}-07-31`;

  let latest: Valuation | null = null;
  for (const v of valuations) {
    if (v.date >= windowStart && v.date <= windowEnd) {
      if (latest === null || v.date > latest.date) {
        latest = v;
      }
    }
  }
  return latest?.value ?? null;
}

/**
 * Find the earliest valid draft season.
 * A season is valid if:
 *   - S is in [2014..2018]
 *   - season minutes >= 400
 *   - a season valuation exists
 */
export function findDraftSeason(
  seasonMinutes: Map<number, number>,
  valuations: Valuation[],
): { draftSeason: number; draftCost: number } | null {
  for (const s of DRAFT_SEASONS) {
    const mins = seasonMinutes.get(s) ?? 0;
    if (mins < MIN_SEASON_MINUTES) continue;
    const val = getSeasonValuation(valuations, s);
    if (val === null) continue;
    return { draftSeason: s, draftCost: val };
  }
  return null;
}

/**
 * Build yearly_values array (length 11).
 *
 * - yearly_values[0] = draftCost (= season valuation for draft_season)
 * - For k = 1..10:
 *   - If season valuation exists → use it.
 *   - If no valuation but a LATER season (up to draft_season + 10) does → carry forward.
 *   - If no valuation and NO later season has one → depreciate: value *= 0.75, chaining.
 *
 * Returns both the values and tracking info for the data quality report.
 */
export function buildYearlyValues(
  draftSeason: number,
  draftCost: number,
  valuations: Valuation[],
): { values: number[]; depreciationIndices: number[]; carryForwardIndices: number[] } {
  const values: number[] = [draftCost];
  const depreciationIndices: number[] = [];
  const carryForwardIndices: number[] = [];

  // Pre-compute season valuations for k = 1..10
  const seasonVals: (number | null)[] = [];
  for (let k = 1; k <= 10; k++) {
    seasonVals.push(getSeasonValuation(valuations, draftSeason + k));
  }

  for (let k = 1; k <= 10; k++) {
    const realVal = seasonVals[k - 1]; // index k-1 because seasonVals starts at k=1
    if (realVal !== null) {
      values.push(realVal);
      continue;
    }

    // Check if any LATER season (from k+1..10) has a valuation
    let hasLaterValuation = false;
    for (let j = k + 1; j <= 10; j++) {
      if (seasonVals[j - 1] !== null) {
        hasLaterValuation = true;
        break;
      }
    }

    const previousValue = values[k - 1];
    if (hasLaterValuation) {
      // Mid-gap: carry forward
      values.push(previousValue);
      carryForwardIndices.push(k);
    } else {
      // No later valuation: depreciate
      values.push(previousValue * DEPRECIATION_FACTOR);
      depreciationIndices.push(k);
    }
  }

  return { values, depreciationIndices, carryForwardIndices };
}

// ─── Stage 1: Load games → Map<game_id, season> ─────────────────────────────

async function loadGames(): Promise<Map<string, number>> {
  console.log('\n── Stage 1: Loading games ──');
  const gameSeasons = new Map<string, number>();
  const parser = createCsvParser('games.csv.gz');
  let rowCount = 0;

  for await (const record of parser) {
    rowCount++;
    const rec = record as Record<string, string>;
    const season = safeInt(rec['season']);
    if (isNaN(season) || season < 2000 || season > 2030) {
      console.error(`FATAL: games.season value "${rec['season']}" is not an integer in [2000, 2030]. Aborting.`);
      process.exit(1);
    }
    gameSeasons.set(rec['game_id'], season);
  }

  console.log(`  Games loaded: ${rowCount}`);
  console.log(`  Unique game_ids: ${gameSeasons.size}`);
  return gameSeasons;
}

// ─── Stage 2: Load players → Map<player_id, PlayerRaw> ──────────────────────

async function loadPlayers(): Promise<{
  players: Map<number, PlayerRaw>;
  totalLoaded: number;
  missingName: number;
  missingDob: number;
  unmappedPosition: Map<string, number>;
  belowValueThreshold: number;
}> {
  console.log('\n── Stage 2: Loading players ──');
  const players = new Map<number, PlayerRaw>();
  let totalLoaded = 0;
  let missingName = 0;
  let missingDob = 0;
  let belowValueThreshold = 0;
  const unmappedPosition = new Map<string, number>();

  const parser = createCsvParser('players.csv.gz');

  for await (const record of parser) {
    totalLoaded++;
    const rec = record as Record<string, string>;

    // Check name
    const name = rec['name']?.trim();
    if (!name) {
      missingName++;
      continue;
    }

    // Check date_of_birth
    const dob = rec['date_of_birth']?.trim();
    if (!dob) {
      missingDob++;
      continue;
    }

    // Check position
    const subPos = rec['sub_position']?.trim() ?? '';
    const position = POSITION_MAP[subPos];
    if (position === undefined) {
      unmappedPosition.set(subPos || '(empty)', (unmappedPosition.get(subPos || '(empty)') ?? 0) + 1);
      continue;
    }

    // Check value eligibility
    const peakValue = safeInt(rec['highest_market_value_in_eur']);
    if (isNaN(peakValue) || peakValue < MIN_PEAK_VALUE) {
      belowValueThreshold++;
      continue;
    }

    const playerId = safeInt(rec['player_id']);
    if (isNaN(playerId)) continue;

    players.set(playerId, {
      player_id: playerId,
      name,
      image_url: rec['image_url']?.trim() ?? '',
      sub_position: subPos,
      date_of_birth: dob,
      highest_market_value_in_eur: peakValue,
    });
  }

  console.log(`  Players loaded: ${totalLoaded}`);
  console.log(`  Excluded - missing name: ${missingName}`);
  console.log(`  Excluded - missing date_of_birth: ${missingDob}`);
  console.log(`  Excluded - unmapped position: ${[...unmappedPosition.entries()].map(([k, v]) => `${k}(${v})`).join(', ')}`);
  console.log(`  Excluded - below value threshold: ${belowValueThreshold}`);
  console.log(`  Players after value filter: ${players.size}`);
  return { players, totalLoaded, missingName, missingDob, unmappedPosition, belowValueThreshold };
}

// ─── Stage 3: Stream appearances → per-player per-season aggregates ─────────

async function loadAppearances(
  gameSeasons: Map<string, number>,
  eligiblePlayerIds: Set<number>,
): Promise<{
  seasonAggs: Map<number, Map<number, SeasonAppearanceAgg>>;
  leagueEligible: Set<number>;
  totalRows: number;
  noMatchingGame: number;
  missingStatCount: number;
}> {
  console.log('\n── Stage 3: Loading appearances ──');

  // Map<player_id, Map<season, SeasonAppearanceAgg>>
  const seasonAggs = new Map<number, Map<number, SeasonAppearanceAgg>>();
  const leagueEligible = new Set<number>();
  let totalRows = 0;
  let noMatchingGame = 0;
  let missingStatCount = 0;

  const parser = createCsvParser('appearances.csv.gz');

  for await (const record of parser) {
    totalRows++;
    const rec = record as Record<string, string>;
    const playerId = safeInt(rec['player_id']);
    if (isNaN(playerId)) continue;

    // Only process rows for value-eligible players
    if (!eligiblePlayerIds.has(playerId)) continue;

    const gameId = rec['game_id'];
    const season = gameSeasons.get(gameId);
    if (season === undefined) {
      noMatchingGame++;
      continue;
    }

    // Check league eligibility
    const competitionId = rec['competition_id']?.trim() ?? '';
    if (TOP_10_LEAGUES.has(competitionId)) {
      leagueEligible.add(playerId);
    }

    // Aggregate stats for this (player_id, season) — across ALL competitions
    let playerSeasons = seasonAggs.get(playerId);
    if (!playerSeasons) {
      playerSeasons = new Map();
      seasonAggs.set(playerId, playerSeasons);
    }

    let agg = playerSeasons.get(season);
    if (!agg) {
      agg = { appearances: 0, minutes: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
      playerSeasons.set(season, agg);
    }

    agg.appearances += 1;

    // Parse stats, treating empty as 0 and logging
    const statFields = ['minutes_played', 'goals', 'assists', 'yellow_cards', 'red_cards'] as const;
    const aggFields = ['minutes', 'goals', 'assists', 'yellow_cards', 'red_cards'] as const;

    for (let i = 0; i < statFields.length; i++) {
      const raw = rec[statFields[i]];
      if (raw === undefined || raw === '') {
        missingStatCount++;
        // treat as 0
      } else {
        const val = parseInt(raw, 10);
        if (!isNaN(val)) {
          agg[aggFields[i]] += val;
        }
      }
    }
  }

  console.log(`  Appearance rows loaded: ${totalRows}`);
  console.log(`  Appearances with no matching game: ${noMatchingGame}`);
  console.log(`  Missing stat values treated as 0: ${missingStatCount}`);
  console.log(`  Players with league eligibility (top-10): ${leagueEligible.size}`);
  return { seasonAggs, leagueEligible, totalRows, noMatchingGame, missingStatCount };
}

// ─── Stage 4: Load valuations → Map<player_id, Valuation[]> ─────────────────

async function loadValuations(
  eligiblePlayerIds: Set<number>,
): Promise<{ valuations: Map<number, Valuation[]>; totalRows: number }> {
  console.log('\n── Stage 4: Loading valuations ──');
  const valuations = new Map<number, Valuation[]>();
  let totalRows = 0;

  const parser = createCsvParser('player_valuations.csv.gz');

  for await (const record of parser) {
    totalRows++;
    const rec = record as Record<string, string>;
    const playerId = safeInt(rec['player_id']);
    if (isNaN(playerId)) continue;

    // Only keep valuations for eligible players
    if (!eligiblePlayerIds.has(playerId)) continue;

    const date = rec['date']?.trim();
    const value = safeInt(rec['market_value_in_eur']);
    if (!date || isNaN(value)) continue;

    let playerVals = valuations.get(playerId);
    if (!playerVals) {
      playerVals = [];
      valuations.set(playerId, playerVals);
    }
    playerVals.push({ date, value });
  }

  console.log(`  Valuation rows loaded: ${totalRows}`);
  console.log(`  Players with valuations: ${valuations.size}`);
  return { valuations, totalRows };
}

// ─── Stage 5: Assemble PlayerProfile records ─────────────────────────────────

interface AssemblyResult {
  players: PlayerProfile[];
  depreciationByIndex: number[];
  carryForwardByIndex: number[];
  totalByIndex: number[];
  noValidDraftSeason: number;
  afterLeagueFilter: number;
}

function assemblePlayers(
  playerRaws: Map<number, PlayerRaw>,
  leagueEligible: Set<number>,
  seasonAggs: Map<number, Map<number, SeasonAppearanceAgg>>,
  valuationsMap: Map<number, Valuation[]>,
): AssemblyResult {
  console.log('\n── Stage 5: Assembling player profiles ──');
  const results: PlayerProfile[] = [];
  let noValidDraftSeason = 0;
  let afterLeagueFilter = 0;

  // Tracking for data quality: index 1..10
  const depreciationByIndex = new Array<number>(11).fill(0);
  const carryForwardByIndex = new Array<number>(11).fill(0);
  const totalByIndex = new Array<number>(11).fill(0);

  // Filter by league eligibility first
  const leagueFilteredIds = [...playerRaws.keys()].filter((pid) => leagueEligible.has(pid));
  afterLeagueFilter = leagueFilteredIds.length;
  console.log(`  Players after league filter: ${afterLeagueFilter}`);

  for (const playerId of leagueFilteredIds) {
    const raw = playerRaws.get(playerId)!;
    const playerSeasons = seasonAggs.get(playerId);
    const valuations = valuationsMap.get(playerId) ?? [];

    // Build season minutes map (only for DRAFT_SEASONS range)
    const seasonMinutes = new Map<number, number>();
    if (playerSeasons) {
      for (const s of DRAFT_SEASONS) {
        const agg = playerSeasons.get(s);
        if (agg) {
          seasonMinutes.set(s, agg.minutes);
        }
      }
    }

    // Find draft season
    const draftInfo = findDraftSeason(seasonMinutes, valuations);
    if (!draftInfo) {
      noValidDraftSeason++;
      continue;
    }

    const { draftSeason, draftCost } = draftInfo;
    const position = POSITION_MAP[raw.sub_position]!;

    // Compute age
    const age = computeAge(raw.date_of_birth, draftSeason);

    // Draft stats
    const draftSeasonAgg = playerSeasons?.get(draftSeason);
    const draftStats = {
      appearances: draftSeasonAgg?.appearances ?? 0,
      minutes: draftSeasonAgg?.minutes ?? 0,
      goals: draftSeasonAgg?.goals ?? 0,
      assists: draftSeasonAgg?.assists ?? 0,
      yellow_cards: draftSeasonAgg?.yellow_cards ?? 0,
      red_cards: draftSeasonAgg?.red_cards ?? 0,
    };

    // Build yearly values
    const { values, depreciationIndices, carryForwardIndices } = buildYearlyValues(
      draftSeason,
      draftCost,
      valuations,
    );

    // Track quality stats
    for (let k = 1; k <= 10; k++) {
      totalByIndex[k]++;
    }
    for (const k of depreciationIndices) {
      depreciationByIndex[k]++;
    }
    for (const k of carryForwardIndices) {
      carryForwardByIndex[k]++;
    }

    results.push({
      id: String(playerId),
      name: raw.name,
      image_url: raw.image_url,
      position,
      age_at_draft: age,
      draft_cost: draftCost,
      draft_season: draftSeason,
      draft_stats: draftStats,
      yearly_values: values,
    });
  }

  console.log(`  Players with valid draft season: ${results.length}`);
  console.log(`  Excluded - no valid draft season: ${noValidDraftSeason}`);

  return { players: results, depreciationByIndex, carryForwardByIndex, totalByIndex, noValidDraftSeason, afterLeagueFilter };
}

// ─── Stage 6: Validate ──────────────────────────────────────────────────────

function validatePlayers(players: PlayerProfile[]): PlayerProfile[] {
  console.log('\n── Stage 6: Validation ──');
  const valid: PlayerProfile[] = [];
  const reasons = new Map<string, number>();

  const addReason = (reason: string) => {
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  };

  const seenIds = new Set<string>();
  const validPositions = new Set(['GK', 'DEF', 'MID', 'ATT']);

  for (const p of players) {
    // Unique id
    if (seenIds.has(p.id)) {
      addReason('duplicate id');
      continue;
    }
    seenIds.add(p.id);

    // Non-empty name
    if (!p.name) {
      addReason('empty name');
      continue;
    }

    // Valid position
    if (!validPositions.has(p.position)) {
      addReason('invalid position');
      continue;
    }

    // Draft season in range
    if (p.draft_season < MIN_SEASON || p.draft_season > MAX_SEASON) {
      addReason('draft season out of range');
      continue;
    }

    // Draft cost valid
    if (typeof p.draft_cost !== 'number' || isNaN(p.draft_cost) || p.draft_cost <= 0) {
      addReason('invalid draft_cost');
      continue;
    }

    // Stats are numeric and non-negative
    const statKeys = ['appearances', 'minutes', 'goals', 'assists', 'yellow_cards', 'red_cards'] as const;
    let statsValid = true;
    for (const key of statKeys) {
      const val = p.draft_stats[key];
      if (typeof val !== 'number' || isNaN(val) || val < 0) {
        addReason(`invalid draft_stats.${key}`);
        statsValid = false;
        break;
      }
    }
    if (!statsValid) continue;

    // yearly_values length
    if (p.yearly_values.length !== YEARLY_VALUES_LENGTH) {
      addReason('yearly_values wrong length');
      continue;
    }

    // All yearly_values >= 0
    let valuesValid = true;
    for (let i = 0; i < p.yearly_values.length; i++) {
      if (typeof p.yearly_values[i] !== 'number' || isNaN(p.yearly_values[i]) || p.yearly_values[i] < 0) {
        addReason(`yearly_values[${i}] invalid`);
        valuesValid = false;
        break;
      }
    }
    if (!valuesValid) continue;

    // yearly_values[0] === draft_cost
    if (p.yearly_values[0] !== p.draft_cost) {
      addReason('yearly_values[0] != draft_cost');
      continue;
    }

    valid.push(p);
  }

  if (reasons.size > 0) {
    console.log('  Validation failures:');
    for (const [reason, count] of [...reasons.entries()].sort()) {
      console.log(`    ${reason}: ${count}`);
    }
  } else {
    console.log('  All records passed validation.');
  }
  console.log(`  Final validated count: ${valid.length}`);

  return valid;
}

// ─── Data Quality Report ─────────────────────────────────────────────────────

function printDataQualityReport(
  players: PlayerProfile[],
  depreciationByIndex: number[],
  carryForwardByIndex: number[],
  totalByIndex: number[],
): void {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  DATA-QUALITY REPORT');
  console.log('═'.repeat(60));

  // Players per position
  const perPosition = new Map<string, number>();
  for (const p of players) {
    perPosition.set(p.position, (perPosition.get(p.position) ?? 0) + 1);
  }
  console.log('\nPlayers per position:');
  for (const pos of ['GK', 'DEF', 'MID', 'ATT'] as const) {
    console.log(`  ${pos}: ${perPosition.get(pos) ?? 0}`);
  }

  // Min / Median / Max draft_cost per position
  console.log('\nDraft cost (€) per position:');
  console.log('  Position | Min          | Median       | Max');
  for (const pos of ['GK', 'DEF', 'MID', 'ATT'] as const) {
    const costs = players.filter((p) => p.position === pos).map((p) => p.draft_cost).sort((a, b) => a - b);
    if (costs.length === 0) {
      console.log(`  ${pos.padEnd(8)} | N/A          | N/A          | N/A`);
    } else {
      const min = costs[0];
      const max = costs[costs.length - 1];
      const mid = Math.floor(costs.length / 2);
      const median = costs.length % 2 === 1 ? costs[mid] : (costs[mid - 1] + costs[mid]) / 2;
      console.log(
        `  ${pos.padEnd(8)} | ${String(min).padEnd(12)} | ${String(median).padEnd(12)} | ${max}`,
      );
    }
  }

  // Players per draft season
  console.log('\nPlayers per draft season:');
  for (const s of DRAFT_SEASONS) {
    const count = players.filter((p) => p.draft_season === s).length;
    console.log(`  ${s}: ${count}`);
  }

  // Yearly-values sourcing
  console.log('\nYearly-values sourcing (indices 1..10):');
  console.log('  Index | Depreciation % | Carry-forward %');
  for (let k = 1; k <= 10; k++) {
    const total = totalByIndex[k];
    if (total === 0) {
      console.log(`  ${String(k).padEnd(5)} | N/A            | N/A`);
    } else {
      const depPct = ((depreciationByIndex[k] / total) * 100).toFixed(1);
      const cfPct = ((carryForwardByIndex[k] / total) * 100).toFixed(1);
      console.log(`  ${String(k).padEnd(5)} | ${depPct.padStart(13)}% | ${cfPct.padStart(14)}%`);
    }
  }

  // Exit check
  console.log('');
  let allOk = true;
  for (const pos of ['GK', 'DEF', 'MID', 'ATT'] as const) {
    const count = perPosition.get(pos) ?? 0;
    if (count < 30) {
      console.log(`  ✗ FAIL: ${pos} has only ${count} players (need >= 30)`);
      allOk = false;
    }
  }
  if (allOk) {
    console.log('  ✓ EXIT CHECK PASSED: every position has >= 30 players');
  }

  console.log('═'.repeat(60));

  if (!allOk) {
    process.exit(1);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Football Investor — ETL Pipeline');
  console.log('================================\n');

  // Stage 1: Games
  const gameSeasons = await loadGames();

  // Stage 2: Players (with value + position + name + dob filtering)
  const { players: playerRaws, totalLoaded: playersLoaded } = await loadPlayers();

  const eligiblePlayerIds = new Set(playerRaws.keys());

  // Stage 3: Appearances (only for eligible players, aggregated per season)
  const { seasonAggs, leagueEligible, totalRows: appearanceRows } = await loadAppearances(
    gameSeasons,
    eligiblePlayerIds,
  );

  // Stage 4: Valuations
  const { valuations, totalRows: valuationRows } = await loadValuations(eligiblePlayerIds);

  // Stage 5: Assemble
  const {
    players: assembled,
    depreciationByIndex,
    carryForwardByIndex,
    totalByIndex,
    afterLeagueFilter,
  } = assemblePlayers(playerRaws, leagueEligible, seasonAggs, valuations);

  // Stage 6: Validate
  const validated = validatePlayers(assembled);

  // Sort by numeric player_id ascending
  validated.sort((a, b) => Number(a.id) - Number(b.id));

  // Stage-by-stage summary
  console.log('\n── Stage-by-stage counts ──');
  console.log(`  Players loaded: ${playersLoaded}`);
  console.log(`  Players after value filter: ${eligiblePlayerIds.size}`);
  console.log(`  Appearance rows loaded: ${appearanceRows}`);
  console.log(`  Valuation rows loaded: ${valuationRows}`);
  console.log(`  Players after league filter: ${afterLeagueFilter}`);
  console.log(`  With valid draft season: ${assembled.length}`);
  console.log(`  Final validated count: ${validated.length}`);

  // Write output
  await mkdir(OUTPUT_DIR, { recursive: true });
  const json = JSON.stringify(validated, null, 2) + '\n';
  await writeFile(OUTPUT_PATH, json, 'utf-8');
  console.log(`\nOutput written to: ${OUTPUT_PATH}`);
  console.log(`Output size: ${(Buffer.byteLength(json) / 1024 / 1024).toFixed(2)} MB`);

  // Data Quality Report
  printDataQualityReport(validated, depreciationByIndex, carryForwardByIndex, totalByIndex);
}

main().catch((err) => {
  console.error('ETL FAILED:', err);
  process.exit(1);
});
