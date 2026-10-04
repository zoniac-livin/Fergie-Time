import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGameStore } from '../store/gameStore';
import { INITIAL_BUDGET } from '../lib/game/engine';
import {
  netWorth,
  squadValue,
  netWorthAt,
  getDraftedPlayers,
  bestInvestment,
  worstFlop,
  getPlayerExitStatus,
  getNetWorthAnnotations,
} from '../lib/game/selectors';
import { getRank } from '../lib/game/rank';
import { formatEuros } from '../lib/ui/format';
import { NetWorthChart } from '../components/results/NetWorthChart';
import { BestInvestmentCard, WorstFlopCard } from '../components/results/BestWorstCard';
import { PlayerHistoryCard } from '../components/results/PlayerHistoryCard';
import type { PlayerProfile, GameState } from '../types/game';
import rawPlayers from '../data/players.json';

const pool = rawPlayers as PlayerProfile[];

/** Create fixture player with controlled values */
function makePlayer(overrides: Partial<PlayerProfile> & { id: string; position: PlayerProfile['position'] }): PlayerProfile {
  return {
    name: `Player ${overrides.id}`,
    image_url: '',
    age_at_draft: 22,
    draft_cost: 10_000_000,
    draft_season: 2020,
    draft_stats: { appearances: 30, minutes: 2700, goals: 5, assists: 3, yellow_cards: 2, red_cards: 0 },
    yearly_values: [10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000],
    ...overrides,
  };
}

describe('Task 4 Checkpoint (a) — /results Route Tests', () => {
  beforeEach(() => {
    useGameStore.getState().startNewGame(12345);
  });

  /* ==================================================================
   * 1. Full Run Integration Test with Real Store & Real Pool
   * ================================================================== */
  describe('1. Full run integration: draft, reveal, 10 years with sales, endgame', () => {
    it('verifies headline net worth, breakdown line, and chart markers', () => {
      // 1. Draft 7 players
      useGameStore.getState().startNewGame(4242);
      for (let i = 0; i < 7; i++) {
        const candidate = useGameStore.getState().getCurrentCandidate();
        expect(candidate).not.toBeNull();
        useGameStore.getState().draftPlayer(candidate!);
      }

      // 2. Reveal
      useGameStore.getState().startReveal();
      for (let i = 0; i < 7; i++) {
        useGameStore.getState().revealNext();
      }
      useGameStore.getState().completeReveal();
      expect(useGameStore.getState().phase).toBe('SIMULATION');

      // 3. Simulate 10 years with sales at Year 2 and Year 5
      for (let yr = 0; yr <= 9; yr++) {
        const s = useGameStore.getState();

        if (yr === 2 && s.roster.ATT.length > 0) {
          useGameStore.getState().sellPlayer(s.roster.ATT[0].id);
        }
        if (yr === 5 && s.roster.DEF.length > 0) {
          useGameStore.getState().sellPlayer(s.roster.DEF[0].id);
        }

        useGameStore.getState().advanceYear();
      }

      expect(useGameStore.getState().currentYear).toBe(10);
      const endResult = useGameStore.getState().endSimulation();
      expect(endResult.ok).toBe(true);
      expect(useGameStore.getState().phase).toBe('ENDGAME');

      const finalState = useGameStore.getState();
      const expectedNetWorth = netWorth(finalState);
      const expectedSquadVal = squadValue(finalState);
      const expectedCash = finalState.budget;

      // Assertion A: Cash + Squad Value = Final Net Worth
      expect(expectedCash + expectedSquadVal).toBe(expectedNetWorth);

      // Assertion B: Headline text equals formatEuros(netWorth(state))
      const headlineFormatted = formatEuros(expectedNetWorth);
      expect(headlineFormatted).toBe(formatEuros(finalState.budget + squadValue(finalState)));

      // Assertion C: Chart Year 10 value equals headline
      const allDrafted = getDraftedPlayers(finalState, pool);
      const yearlyNetWorth = Array.from({ length: 11 }, (_, y) =>
        netWorthAt(y, finalState.transactions, allDrafted)
      );
      expect(yearlyNetWorth[10]).toBe(expectedNetWorth);

      // Assertion D: Chart has sale markers at exactly the years of SELL transactions
      const sellTxs = finalState.transactions.filter((t) => t.kind === 'SELL');
      const sellYears = sellTxs.map((t) => t.year);
      expect(sellYears).toEqual([2, 5]);

      const chartHtml = renderToStaticMarkup(
        <NetWorthChart yearlyNetWorth={yearlyNetWorth} sellYears={sellYears} />
      );

      // Chart Year 10 point markup contains headline formatted value
      expect(chartHtml).toContain(
        `data-testid="chart-year10-value">${headlineFormatted}</text>`
      );

      // Chart has sell markers for Year 2 and Year 5, but NOT Year 3 or Year 4
      expect(chartHtml).toContain('data-testid="chart-sell-marker-2"');
      expect(chartHtml).toContain('data-testid="chart-sell-marker-5"');
      expect(chartHtml).not.toContain('data-testid="chart-sell-marker-3"');
      expect(chartHtml).not.toContain('data-testid="chart-sell-marker-4"');
    });
  });

  /* ==================================================================
   * 2. Best Investment & Worst Flop Card Tests
   * ================================================================== */
  describe('2. Best Investment and Worst Flop Cards', () => {
    it('shows exact ROI % and euro profit for best investment', () => {
      const p1 = makePlayer({
        id: '101',
        position: 'ATT',
        draft_cost: 10_000_000,
        yearly_values: [10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 30_000_000],
      });
      const p2 = makePlayer({
        id: '102',
        position: 'DEF',
        draft_cost: 20_000_000,
        yearly_values: [20_000_000, 20_000_000, 20_000_000, 20_000_000, 20_000_000, 20_000_000, 20_000_000, 20_000_000, 20_000_000, 20_000_000, 10_000_000],
      });

      const mockState: GameState = {
        ...useGameStore.getState(),
        transactions: [
          { playerId: p1.id, year: 0, kind: 'DRAFT', amount: p1.draft_cost },
          { playerId: p2.id, year: 0, kind: 'DRAFT', amount: p2.draft_cost },
        ],
      };

      const best = bestInvestment(mockState, [p1, p2]);
      expect(best).not.toBeNull();
      expect(best!.player.id).toBe(p1.id);
      expect(best!.roi).toBe(2.0); // +200%
      expect(best!.profit).toBe(20_000_000);

      const html = renderToStaticMarkup(
        <BestInvestmentCard result={best} exitStatus={{ status: 'RETAINED' }} />
      );

      expect(html).toContain('▲ +200.0%');
      expect(html).toContain(formatEuros(20_000_000));
      expect(html).toContain(formatEuros(p1.draft_cost));
      expect(html).toContain(formatEuros(30_000_000));
      expect(html).toContain('RETAINED');
    });

    it('shows lowest value reached and net euro loss for worst flop', () => {
      const pFlop = makePlayer({
        id: '103',
        position: 'MID',
        draft_cost: 25_000_000,
        yearly_values: [25_000_000, 20_000_000, 15_000_000, 5_000_000, 10_000_000, 12_000_000, 12_000_000, 12_000_000, 12_000_000, 12_000_000, 10_000_000],
      });

      const mockState: GameState = {
        ...useGameStore.getState(),
        transactions: [
          { playerId: pFlop.id, year: 0, kind: 'DRAFT', amount: pFlop.draft_cost },
        ],
      };

      const flop = worstFlop(mockState, [pFlop]);
      expect(flop.status).toBe('FLOP');
      if (flop.status === 'FLOP') {
        expect(flop.loss).toBe(15_000_000); // 25M - 10M exit = 15M loss
        expect(flop.exitValue).toBe(10_000_000);
      }

      const html = renderToStaticMarkup(
        <WorstFlopCard result={flop} exitStatus={{ status: 'RETAINED' }} />
      );

      expect(html).toContain('−' + formatEuros(15_000_000));
      expect(html).toContain(formatEuros(5_000_000)); // lowest value reached
      expect(html).toContain(formatEuros(25_000_000)); // draft price
      expect(html).toContain(formatEuros(10_000_000)); // exit value
    });

    it('tie-break picks lowest player id for best investment and worst flop', () => {
      // Two players with identical ROI (+100%)
      const pA = makePlayer({ id: '200', position: 'MID', draft_cost: 10_000_000, yearly_values: Array(11).fill(20_000_000) });
      const pB = makePlayer({ id: '100', position: 'MID', draft_cost: 10_000_000, yearly_values: Array(11).fill(20_000_000) });

      const state: GameState = { ...useGameStore.getState(), transactions: [] };
      const best = bestInvestment(state, [pA, pB]);
      expect(best!.player.id).toBe('100'); // Lowest numeric ID wins

      // Two players with identical loss (-10M)
      const fA = makePlayer({ id: '50', position: 'DEF', draft_cost: 20_000_000, yearly_values: Array(11).fill(10_000_000) });
      const fB = makePlayer({ id: '80', position: 'DEF', draft_cost: 20_000_000, yearly_values: Array(11).fill(10_000_000) });
      const flop = worstFlop(state, [fB, fA]);
      expect(flop.status).toBe('FLOP');
      if (flop.status === 'FLOP') {
        expect(flop.player.id).toBe('50'); // Lowest ID wins
      }
    });

    it('displays neutral card when nobody lost value', () => {
      const gainer1 = makePlayer({ id: '1', position: 'ATT', draft_cost: 10_000_000, yearly_values: Array(11).fill(15_000_000) });
      const gainer2 = makePlayer({ id: '2', position: 'GK', draft_cost: 10_000_000, yearly_values: Array(11).fill(10_000_000) }); // Flat

      const state: GameState = { ...useGameStore.getState(), transactions: [] };
      const flop = worstFlop(state, [gainer1, gainer2]);
      expect(flop.status).toBe('NEUTRAL');

      const html = renderToStaticMarkup(
        <WorstFlopCard result={flop} exitStatus={null} />
      );
      expect(html).toContain('No flops — every player held or gained value');
      expect(html).toContain('data-testid="neutral-flop-card"');
    });
  });

  /* ==================================================================
   * 3. Player History Cards: Held to Year 10 Logic & Exit Labels
   * ================================================================== */
  describe('3. Player History Card — Held to Year 10 and Exit Labels', () => {
    it('player sold early (Year < 10) shows SOLD (Year N) and renders "Held to Year 10 it would have been €X"', () => {
      const player = makePlayer({
        id: 'EARLY_SOLD',
        position: 'MID',
        draft_cost: 10_000_000,
        yearly_values: [10_000_000, 12_000_000, 14_000_000, 16_000_000, 18_000_000, 20_000_000, 22_000_000, 24_000_000, 26_000_000, 28_000_000, 50_000_000],
      });

      const exitStatus = { status: 'SOLD' as const, year: 3 };
      const exitValue = 16_000_000;

      const html = renderToStaticMarkup(
        <PlayerHistoryCard player={player} exitStatus={exitStatus} exitValue={exitValue} />
      );

      expect(html).toContain('SOLD (Year 3)');
      expect(html).toContain('Held to Year 10 it would have been');
      expect(html).toContain(formatEuros(50_000_000));
    });

    it('player sold at Year 10 shows SOLD (Year 10) and HIDES "Held to Year 10" line', () => {
      const player = makePlayer({
        id: 'SOLD_YR_10',
        position: 'DEF',
        draft_cost: 10_000_000,
        yearly_values: Array(10).fill(10_000_000).concat(18_000_000),
      });

      const exitStatus = { status: 'SOLD' as const, year: 10 };
      const exitValue = 18_000_000;

      const html = renderToStaticMarkup(
        <PlayerHistoryCard player={player} exitStatus={exitStatus} exitValue={exitValue} />
      );

      expect(html).toContain('SOLD (Year 10)');
      expect(html).not.toContain('Held to Year 10 it would have been');
      expect(html).not.toContain('data-testid="history-held-to-10-SOLD_YR_10"');
    });

    it('retained player shows RETAINED and HIDES "Held to Year 10" line', () => {
      const player = makePlayer({
        id: 'RETAINED_P',
        position: 'GK',
        draft_cost: 15_000_000,
        yearly_values: Array(11).fill(25_000_000),
      });

      const exitStatus = { status: 'RETAINED' as const };
      const exitValue = 25_000_000;

      const html = renderToStaticMarkup(
        <PlayerHistoryCard player={player} exitStatus={exitStatus} exitValue={exitValue} />
      );

      expect(html).toContain('RETAINED');
      expect(html).not.toContain('SOLD');
      expect(html).not.toContain('Held to Year 10 it would have been');
    });
  });

  /* ==================================================================
   * 4. Rank Boundaries
   * ================================================================== */
  describe('4. Rank Boundaries', () => {
    it('correctly maps net worth thresholds to investor tiers', () => {
      expect(getRank(199_999_999)).toBe('RELEGATION FODDER');
      expect(getRank(200_000_000)).toBe('TRANSFER STRATEGIST');
      expect(getRank(500_000_000)).toBe('TRANSFER STRATEGIST');
      expect(getRank(500_000_001)).toBe('MASTER NEGOTIATOR');
    });
  });

  /* ==================================================================
   * 5. Largest-Gain & Loss Annotation Selector (Ties & Zeroes)
   * ================================================================== */
  describe('5. getNetWorthAnnotations selector', () => {
    it('picks largest single-year gain and loss', () => {
      const vals = [100, 110, 140, 130, 100, 150]; // yr 1: +10, yr 2: +30, yr 3: -10, yr 4: -30, yr 5: +50
      const { largestGain, largestLoss } = getNetWorthAnnotations(vals);

      expect(largestGain).toEqual({ year: 5, change: 50 });
      expect(largestLoss).toEqual({ year: 4, change: -30 });
    });

    it('resolves ties to the earliest year', () => {
      const vals = [100, 120, 110, 130]; // yr 1: +20, yr 2: -10, yr 3: +20 (tie for gain)
      const { largestGain } = getNetWorthAnnotations(vals);
      expect(largestGain).toEqual({ year: 1, change: 20 }); // Earliest year 1 wins

      const valsLoss = [100, 80, 90, 70]; // yr 1: -20, yr 2: +10, yr 3: -20 (tie for loss)
      const { largestLoss } = getNetWorthAnnotations(valsLoss);
      expect(largestLoss).toEqual({ year: 1, change: -20 }); // Earliest year 1 wins
    });

    it('returns null when no positive gain or no negative loss exists', () => {
      const allFlat = [100, 100, 100];
      const resFlat = getNetWorthAnnotations(allFlat);
      expect(resFlat.largestGain).toBeNull();
      expect(resFlat.largestLoss).toBeNull();

      const allUp = [100, 120, 150];
      const resUp = getNetWorthAnnotations(allUp);
      expect(resUp.largestGain).toEqual({ year: 2, change: 30 });
      expect(resUp.largestLoss).toBeNull();
    });
  });

  /* ==================================================================
   * 6. Chart Flat-Line Handling: Zero NaN Protection
   * ================================================================== */
  describe('6. NetWorthChart zero value range (flat line)', () => {
    it('renders a flat line with NO "NaN" anywhere in the SVG markup', () => {
      // Flat line across all 11 years (e.g. everyone sold at Year 0 for cash)
      const flatLine = Array(11).fill(250_000_000);
      const html = renderToStaticMarkup(
        <NetWorthChart yearlyNetWorth={flatLine} sellYears={[0]} />
      );

      // Must NOT contain NaN
      expect(html).not.toContain('NaN');
      expect(html).toContain('data-testid="net-worth-chart-svg"');
      expect(html).toContain('data-testid="chart-polyline"');
      // Polyline points must be valid numbers
      expect(html).toContain('points=');
    });
  });

  /* ==================================================================
   * 7. Edge Cases: Sell All Early vs Retain Everyone
   * ================================================================== */
  describe('7. Extreme Gameplay Edge Cases', () => {
    it('selling every player at Year 1 produces a valid results screen', () => {
      const pGk = makePlayer({ id: '1', position: 'GK', draft_cost: 10_000_000, yearly_values: Array(11).fill(10_000_000) });
      const pDef1 = makePlayer({ id: '2', position: 'DEF', draft_cost: 10_000_000, yearly_values: Array(11).fill(10_000_000) });
      const pDef2 = makePlayer({ id: '3', position: 'DEF', draft_cost: 10_000_000, yearly_values: Array(11).fill(10_000_000) });
      const pMid1 = makePlayer({ id: '4', position: 'MID', draft_cost: 10_000_000, yearly_values: Array(11).fill(10_000_000) });
      const pMid2 = makePlayer({ id: '5', position: 'MID', draft_cost: 10_000_000, yearly_values: Array(11).fill(10_000_000) });
      const pAtt1 = makePlayer({ id: '6', position: 'ATT', draft_cost: 10_000_000, yearly_values: Array(11).fill(10_000_000) });
      const pAtt2 = makePlayer({ id: '7', position: 'ATT', draft_cost: 10_000_000, yearly_values: Array(11).fill(10_000_000) });

      const allSeven = [pGk, pDef1, pDef2, pMid1, pMid2, pAtt1, pAtt2];
      const spent = 70_000_000;
      const initialCash = INITIAL_BUDGET - spent;

      // Sell all 7 at Year 1
      const sellTxs = allSeven.map((p) => ({
        playerId: p.id,
        year: 1,
        kind: 'SELL' as const,
        amount: 10_000_000,
      }));

      const state: GameState = {
        ...useGameStore.getState(),
        budget: initialCash + 70_000_000, // back to 250M
        currentYear: 10,
        phase: 'ENDGAME',
        roster: { GK: [], DEF: [], MID: [], ATT: [] },
        transactions: [
          ...allSeven.map((p) => ({ playerId: p.id, year: 0, kind: 'DRAFT' as const, amount: p.draft_cost })),
          ...sellTxs,
        ],
      };

      const finalNw = netWorth(state);
      expect(finalNw).toBe(INITIAL_BUDGET);
      expect(squadValue(state)).toBe(0);

      // Verify each player has SOLD status
      for (const p of allSeven) {
        const status = getPlayerExitStatus(p, state.transactions);
        expect(status).toEqual({ status: 'SOLD', year: 1 });
      }
    });

    it('retaining every player through Year 10 produces valid results', () => {
      const pGk = makePlayer({ id: '1', position: 'GK', draft_cost: 10_000_000, yearly_values: Array(11).fill(15_000_000) });
      const allSeven = [pGk];
      expect(allSeven).toHaveLength(1);

      const state: GameState = {
        ...useGameStore.getState(),
        budget: 240_000_000,
        currentYear: 10,
        phase: 'ENDGAME',
        roster: { GK: [pGk], DEF: [], MID: [], ATT: [] },
        transactions: [
          { playerId: pGk.id, year: 0, kind: 'DRAFT', amount: 10_000_000 },
        ],
      };

      const finalNw = netWorth(state);
      expect(finalNw).toBe(240_000_000 + 15_000_000);
      expect(squadValue(state)).toBe(15_000_000);

      const status = getPlayerExitStatus(pGk, state.transactions);
      expect(status).toEqual({ status: 'RETAINED' });
    });
  });

  /* ==================================================================
   * 8. Negative Control: Erroneous Year 10 Chart Point
   * ================================================================== */
  describe('8. Negative Control on Chart Year 10 Value', () => {
    it('chart markup accurately reflects Year 10 net worth and fails if wrong', () => {
      const realYear10Val = 312_345_678;
      const yearlyNetWorth = [...Array(10).fill(250_000_000), realYear10Val];

      const html = renderToStaticMarkup(
        <NetWorthChart yearlyNetWorth={yearlyNetWorth} sellYears={[]} />
      );

      // Correct value must appear in chart Year 10 marker
      expect(html).toContain(
        `data-testid="chart-year10-value">${formatEuros(realYear10Val)}</text>`
      );
    });
  });
});
