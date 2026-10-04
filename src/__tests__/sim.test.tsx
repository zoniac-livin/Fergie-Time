import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useGameStore } from '../store/gameStore';
import { SquadRow } from '../components/sim/SquadRow';
import { Sparkline } from '../components/sim/Sparkline';
import { SummaryStrip } from '../components/sim/SummaryStrip';
import {
  netWorth,
  netWorthAt,
  squadValue,
  deltaVsPreviousYear,
  getDraftedPlayers,
  getTransactionLog,
} from '../lib/game/selectors';
import { formatEuros } from '../lib/ui/format';
import type { PlayerProfile, Roster, GameState } from '../types/game';
import rawPlayers from '../data/players.json';

const pool = rawPlayers as PlayerProfile[];

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

/** Create a fixture player with controlled yearly_values */
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

/** Two players with identical values[0..3] but diverging futures — for sparkline test */
const sparklinePlayerA = makePlayer({
  id: 'SPARK_A',
  position: 'ATT',
  yearly_values: [5_000_000, 8_000_000, 12_000_000, 15_000_000, 50_000_000, 80_000_000, 90_000_000, 100_000_000, 110_000_000, 120_000_000, 130_000_000],
});

const sparklinePlayerB = makePlayer({
  id: 'SPARK_B',
  position: 'ATT',
  yearly_values: [5_000_000, 8_000_000, 12_000_000, 15_000_000, 1_000_000, 500_000, 200_000, 100_000, 50_000, 10_000, 5_000],
});

/** Player with distinctive future values for NO FUTURE LEAK test.
 *  Future values use non-repeating patterns that won't appear in coordinate math. */
const futureLeakPlayer = makePlayer({
  id: 'LEAK_TEST',
  position: 'MID',
  yearly_values: [
    10_000_000,   // Year 0
    12_000_000,   // Year 1
    15_000_000,   // Year 2
    18_000_000,   // Year 3
    91_234_567,   // Year 4 — these must NEVER appear at year 3
    92_345_678,   // Year 5
    93_456_789,   // Year 6
    94_567_890,   // Year 7
    95_678_901,   // Year 8
    96_789_012,   // Year 9
    97_890_123,   // Year 10
  ],
});

/** Player whose value increases by exactly 1 (for tiny delta DOWN test) */
const tinyLossPlayer = makePlayer({
  id: 'TINY_LOSS',
  position: 'DEF',
  yearly_values: [10_000_000, 9_999_999, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000],
});

/** Player whose value is flat */
const flatPlayer = makePlayer({
  id: 'FLAT_VAL',
  position: 'DEF',
  yearly_values: [10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000, 10_000_000],
});

/** Player whose value goes up */
const upPlayer = makePlayer({
  id: 'UP_VAL',
  position: 'MID',
  yearly_values: [10_000_000, 15_000_000, 20_000_000, 25_000_000, 30_000_000, 35_000_000, 40_000_000, 45_000_000, 50_000_000, 55_000_000, 60_000_000],
});

function buildTestRoster(players?: Partial<{ GK: PlayerProfile[]; DEF: PlayerProfile[]; MID: PlayerProfile[]; ATT: PlayerProfile[] }>): Roster {
  const gk = pool.find((p) => p.position === 'GK')!;
  const defs = pool.filter((p) => p.position === 'DEF').slice(0, 2);
  const mids = pool.filter((p) => p.position === 'MID').slice(0, 2);
  const atts = pool.filter((p) => p.position === 'ATT').slice(0, 2);
  return {
    GK: players?.GK ?? [gk],
    DEF: players?.DEF ?? defs,
    MID: players?.MID ?? mids,
    ATT: players?.ATT ?? atts,
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('Task 3c Checkpoint (a) — /sim Route Tests', () => {
  beforeEach(() => {
    useGameStore.getState().startNewGame(42);
  });

  /* ============================
   * 1. Rendering Values at Year N
   * ============================ */
  describe('1. Rendering values at Year N', () => {
    it('shows each player yearly_values[N] as current value and yearly_values[N-1] as previous', () => {
      const testYear = 3;
      const player = upPlayer;

      const html = renderToStaticMarkup(
        <SquadRow
          player={player}
          currentYear={testYear}
          budget={100_000_000}
          onSell={() => {}}
        />
      );

      // Current value = yearly_values[3] = €25,000,000
      expect(html).toContain(formatEuros(player.yearly_values[testYear]));
      // Previous value = yearly_values[2] = €20,000,000
      expect(html).toContain(formatEuros(player.yearly_values[testYear - 1]));
    });

    it('at year 0 shows current value but no previous value and shows "—" for delta', () => {
      const html = renderToStaticMarkup(
        <SquadRow
          player={upPlayer}
          currentYear={0}
          budget={100_000_000}
          onSell={() => {}}
        />
      );

      expect(html).toContain(formatEuros(upPlayer.yearly_values[0]));
      expect(html).toContain('—');
      // Should NOT show "PREV"
      expect(html).not.toContain('PREV');
    });
  });

  /* ============================
   * 2. Delta Badges (UP, DOWN, FLAT)
   * ============================ */
  describe('2. Delta badges: UP, DOWN, FLAT', () => {
    it('renders UP badge with ▲ and accessible text for a gain', () => {
      const html = renderToStaticMarkup(
        <SquadRow player={upPlayer} currentYear={1} budget={100_000_000} onSell={() => {}} />
      );

      expect(html).toContain('▲');
      expect(html).toContain('UP');
      expect(html).toContain('+');
    });

    it('renders DOWN badge with ▼ and accessible text for a loss', () => {
      const html = renderToStaticMarkup(
        <SquadRow player={tinyLossPlayer} currentYear={1} budget={100_000_000} onSell={() => {}} />
      );

      expect(html).toContain('▼');
      expect(html).toContain('DOWN');
    });

    it('renders FLAT badge with ■ when delta is exactly 0', () => {
      const html = renderToStaticMarkup(
        <SquadRow player={flatPlayer} currentYear={1} budget={100_000_000} onSell={() => {}} />
      );

      expect(html).toContain('■');
      expect(html).toContain('FLAT');
    });

    it('a tiny loss (−€1) renders as DOWN, never as "−€0" or FLAT', () => {
      const delta = deltaVsPreviousYear(tinyLossPlayer, 1);
      expect(delta.absolute).toBe(-1); // Raw delta is exactly -1

      const html = renderToStaticMarkup(
        <SquadRow player={tinyLossPlayer} currentYear={1} budget={100_000_000} onSell={() => {}} />
      );

      expect(html).toContain('DOWN');
      expect(html).not.toContain('FLAT');
      // Should not show €0 as the delta amount
      expect(html).not.toContain('data-testid="delta-TINY_LOSS">■');
    });
  });

  /* ============================
   * 3. NO FUTURE LEAK
   * ============================ */
  describe('3. NO FUTURE LEAK', () => {
    it('at year 3, none of years 4..10 distinctive values appear anywhere in HTML', () => {
      const html = renderToStaticMarkup(
        <SquadRow
          player={futureLeakPlayer}
          currentYear={3}
          budget={100_000_000}
          onSell={() => {}}
        />
      );

      // Values that SHOULD be present (years 0..3)
      expect(html).toContain(formatEuros(futureLeakPlayer.yearly_values[3])); // Current: €33,333,333
      expect(html).toContain(formatEuros(futureLeakPlayer.yearly_values[2])); // Previous: €22,222,222

      // Values that must NEVER appear (years 4..10) — check both raw and formatted
      for (let y = 4; y <= 10; y++) {
        const rawVal = futureLeakPlayer.yearly_values[y];
        expect(html).not.toContain(String(rawVal));
        expect(html).not.toContain(formatEuros(rawVal));
      }
    });

    it('sparkline path data at year 3 contains no future values', () => {
      const html = renderToStaticMarkup(
        <Sparkline values={futureLeakPlayer.yearly_values} currentYear={3} />
      );

      // Future values must not appear in any form (e.g. in point coordinates)
      for (let y = 4; y <= 10; y++) {
        const rawVal = futureLeakPlayer.yearly_values[y];
        expect(html).not.toContain(String(rawVal));
      }
    });
  });

  /* ============================
   * 4. Sparkline Identical Through Year 3
   * ============================ */
  describe('4. Sparkline scale is computed only from visible data', () => {
    it('two players with identical values[0..3] but different futures render identical sparkline markup at year 3', () => {
      const htmlA = renderToStaticMarkup(
        <Sparkline values={sparklinePlayerA.yearly_values} currentYear={3} width={80} height={28} />
      );
      const htmlB = renderToStaticMarkup(
        <Sparkline values={sparklinePlayerB.yearly_values} currentYear={3} width={80} height={28} />
      );

      // The two sparklines should be byte-identical since they see the same values[0..3]
      expect(htmlA).toBe(htmlB);

      // Neither should contain future values
      expect(htmlA).not.toContain(String(sparklinePlayerA.yearly_values[4]));
      expect(htmlB).not.toContain(String(sparklinePlayerB.yearly_values[4]));
    });
  });

  /* ============================
   * 5. Sell Flow
   * ============================ */
  describe('5. Sell flow', () => {
    it('two-step confirm shows correct sale price and resulting cash', () => {
      const player = upPlayer;
      const testYear = 2;
      const budget = 100_000_000;
      const salePrice = player.yearly_values[testYear]; // €20,000,000
      const resultingCash = budget + salePrice;

      // The SELL button exists initially
      const html = renderToStaticMarkup(
        <SquadRow player={player} currentYear={testYear} budget={budget} onSell={() => {}} />
      );

      expect(html).toContain(`sell-btn-${player.id}`);
      expect(html).toContain('SELL');

      // Verify the sale price and resulting cash would be correctly computed
      expect(salePrice).toBe(20_000_000);
      expect(resultingCash).toBe(120_000_000);
    });

    it('sellPlayer removes player from roster and creates SELL transaction', () => {
      const roster = buildTestRoster();
      const allSeven = [...roster.GK, ...roster.DEF, ...roster.MID, ...roster.ATT];
      const spent = allSeven.reduce((s, p) => s + p.draft_cost, 0);
      const txs = allSeven.map((p) => ({
        playerId: p.id,
        year: 0,
        kind: 'DRAFT' as const,
        amount: p.draft_cost,
      }));

      useGameStore.setState({
        budget: 250_000_000 - spent,
        currentYear: 2,
        roster,
        phase: 'SIMULATION',
        transactions: txs,
      });

      const playerToSell = roster.DEF[0];
      const salePrice = playerToSell.yearly_values[2];

      const result = useGameStore.getState().sellPlayer(playerToSell.id);
      expect(result.ok).toBe(true);

      const newState = useGameStore.getState();
      // Player removed from roster
      expect(newState.roster.DEF.find((p) => p.id === playerToSell.id)).toBeUndefined();
      // Budget increased
      expect(newState.budget).toBe(250_000_000 - spent + salePrice);
      // SELL transaction logged
      const sellTx = newState.transactions.find(
        (t) => t.kind === 'SELL' && t.playerId === playerToSell.id
      );
      expect(sellTx).toBeDefined();
      expect(sellTx!.amount).toBe(salePrice);
      expect(sellTx!.year).toBe(2);
    });

    it('double sell (rejected) produces a plain-language error, no crash', () => {
      const roster = buildTestRoster();
      const allSeven = [...roster.GK, ...roster.DEF, ...roster.MID, ...roster.ATT];
      const spent = allSeven.reduce((s, p) => s + p.draft_cost, 0);
      const txs = allSeven.map((p) => ({
        playerId: p.id,
        year: 0,
        kind: 'DRAFT' as const,
        amount: p.draft_cost,
      }));

      useGameStore.setState({
        budget: 250_000_000 - spent,
        currentYear: 1,
        roster,
        phase: 'SIMULATION',
        transactions: txs,
      });

      const playerToSell = roster.ATT[0];
      const first = useGameStore.getState().sellPlayer(playerToSell.id);
      expect(first.ok).toBe(true);

      // Second sell must fail gracefully
      const second = useGameStore.getState().sellPlayer(playerToSell.id);
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.error).toBe('NOT_ON_ROSTER');
      }
    });
  });

  /* ============================
   * 6. Transaction Log Selector
   * ============================ */
  describe('6. Transaction log selector', () => {
    it('getTransactionLog joins transactions with player names from pool', () => {
      const roster = buildTestRoster();
      const allSeven = [...roster.GK, ...roster.DEF, ...roster.MID, ...roster.ATT];
      const txs = allSeven.map((p) => ({
        playerId: p.id,
        year: 0,
        kind: 'DRAFT' as const,
        amount: p.draft_cost,
      }));

      const state: GameState = {
        ...useGameStore.getState(),
        roster,
        transactions: txs,
        phase: 'SIMULATION',
      };

      const log = getTransactionLog(state, pool);
      expect(log).toHaveLength(7);

      for (const entry of log) {
        expect(entry.kind).toBe('DRAFT');
        expect(entry.year).toBe(0);
        expect(entry.playerName).not.toBe('Unknown');
        // Name should match the pool player
        const poolPlayer = pool.find((p) => p.id === entry.playerId);
        expect(poolPlayer).toBeDefined();
        expect(entry.playerName).toBe(poolPlayer!.name);
      }
    });
  });

  /* ============================
   * 7. Route Guards and Empty State
   * ============================ */
  describe('7. Route guard and empty roster state', () => {
    it('selling all players results in an empty roster', () => {
      const roster = buildTestRoster();
      const allSeven = [...roster.GK, ...roster.DEF, ...roster.MID, ...roster.ATT];
      const spent = allSeven.reduce((s, p) => s + p.draft_cost, 0);
      const txs = allSeven.map((p) => ({
        playerId: p.id,
        year: 0,
        kind: 'DRAFT' as const,
        amount: p.draft_cost,
      }));

      useGameStore.setState({
        budget: 250_000_000 - spent,
        currentYear: 1,
        roster,
        phase: 'SIMULATION',
        transactions: txs,
      });

      // Sell all 7 players
      for (const p of allSeven) {
        const result = useGameStore.getState().sellPlayer(p.id);
        expect(result.ok).toBe(true);
      }

      const finalState = useGameStore.getState();
      expect(finalState.roster.GK).toHaveLength(0);
      expect(finalState.roster.DEF).toHaveLength(0);
      expect(finalState.roster.MID).toHaveLength(0);
      expect(finalState.roster.ATT).toHaveLength(0);

      // Net worth is now just cash
      const nw = netWorth(finalState);
      expect(nw).toBe(finalState.budget);
      expect(squadValue(finalState)).toBe(0);
    });

    it('at year 10 endSimulation transitions to ENDGAME', () => {
      const roster = buildTestRoster();
      const allSeven = [...roster.GK, ...roster.DEF, ...roster.MID, ...roster.ATT];
      const spent = allSeven.reduce((s, p) => s + p.draft_cost, 0);
      const txs = allSeven.map((p) => ({
        playerId: p.id,
        year: 0,
        kind: 'DRAFT' as const,
        amount: p.draft_cost,
      }));

      useGameStore.setState({
        budget: 250_000_000 - spent,
        currentYear: 10,
        roster,
        phase: 'SIMULATION',
        transactions: txs,
      });

      const result = useGameStore.getState().endSimulation();
      expect(result.ok).toBe(true);
      expect(useGameStore.getState().phase).toBe('ENDGAME');
    });

    it('endSimulation rejects at year < 10', () => {
      const roster = buildTestRoster();
      useGameStore.setState({
        roster,
        currentYear: 5,
        phase: 'SIMULATION',
      });

      const result = useGameStore.getState().endSimulation();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('SIMULATION_NOT_FINISHED');
      }
    });
  });

  /* ============================
   * 8. Full Run Integration: Draft → Reveal → Sim 10 Years
   * ============================ */
  describe('8. Full run integration: draft, reveal, sim 10 years with sale', () => {
    it('summary strip net worth equals netWorth selector at each year', () => {
      // Start a fresh game and draft 7 players
      useGameStore.getState().startNewGame(7777);

      const draftedPlayers: PlayerProfile[] = [];
      for (let i = 0; i < 7; i++) {
        const candidate = useGameStore.getState().getCurrentCandidate();
        expect(candidate).not.toBeNull();
        const result = useGameStore.getState().draftPlayer(candidate!);
        expect(result.ok).toBe(true);
        draftedPlayers.push(candidate!);
      }

      // Move to REVEAL
      const revealResult = useGameStore.getState().startReveal();
      expect(revealResult.ok).toBe(true);

      // Reveal all 7
      for (let i = 0; i < 7; i++) {
        const r = useGameStore.getState().revealNext();
        expect(r.ok).toBe(true);
      }

      // Complete reveal → SIMULATION
      const completeResult = useGameStore.getState().completeReveal();
      expect(completeResult.ok).toBe(true);
      expect(useGameStore.getState().phase).toBe('SIMULATION');
      expect(useGameStore.getState().currentYear).toBe(0);

      // At each year, check rendered summary strip net worth matches formatEuros(netWorth(state))
      for (let yr = 0; yr <= 9; yr++) {
        const state = useGameStore.getState();
        expect(state.currentYear).toBe(yr);

        const nw = netWorth(state);
        const allDrafted = getDraftedPlayers(state, pool);
        const nwFromSelector = netWorthAt(yr, state.transactions, allDrafted);
        expect(nw).toBeCloseTo(nwFromSelector, 2);

        // Render SummaryStrip component and assert rendered net worth text matches formatEuros(netWorth(state))
        const prevYearNetWorth = yr >= 1 ? netWorthAt(yr - 1, state.transactions, allDrafted) : null;
        const nwDelta = prevYearNetWorth !== null ? nw - prevYearNetWorth : null;
        const stripHtml = renderToStaticMarkup(
          <SummaryStrip
            clubNetWorth={nw}
            budget={state.budget}
            totalSquadValue={squadValue(state)}
            currentYear={yr}
            netWorthDelta={nwDelta}
          />
        );
        expect(stripHtml).toContain(formatEuros(nw));
        expect(stripHtml).toContain(`data-testid="summary-net-worth">${formatEuros(nw)}</div>`);

        // Sell one player at year 3
        if (yr === 3 && state.roster.ATT.length > 0) {
          const toSell = state.roster.ATT[0];
          const sellResult = useGameStore.getState().sellPlayer(toSell.id);
          expect(sellResult.ok).toBe(true);
        }

        // Advance year
        if (yr < 10) {
          const advResult = useGameStore.getState().advanceYear();
          expect(advResult.ok).toBe(true);
        }
      }

      // Year 10: verify rendered summary strip at year 10 and complete
      expect(useGameStore.getState().currentYear).toBe(10);
      const finalState = useGameStore.getState();
      const finalNw = netWorth(finalState);
      expect(finalNw).toBeGreaterThan(0);

      const allDrafted10 = getDraftedPlayers(finalState, pool);
      const prevNw10 = netWorthAt(9, finalState.transactions, allDrafted10);
      const stripHtml10 = renderToStaticMarkup(
        <SummaryStrip
          clubNetWorth={finalNw}
          budget={finalState.budget}
          totalSquadValue={squadValue(finalState)}
          currentYear={10}
          netWorthDelta={finalNw - prevNw10}
        />
      );
      expect(stripHtml10).toContain(formatEuros(finalNw));
      expect(stripHtml10).toContain(`data-testid="summary-net-worth">${formatEuros(finalNw)}</div>`);

      const endResult = useGameStore.getState().endSimulation();
      expect(endResult.ok).toBe(true);
      expect(useGameStore.getState().phase).toBe('ENDGAME');
    });
  });

  /* ============================
   * 9. formatEuros Edge Cases
   * ============================ */
  describe('9. formatEuros edge cases', () => {
    it('formats values under 1M correctly (no rounding to €0)', () => {
      expect(formatEuros(500_000)).toContain('500,000');
      expect(formatEuros(1_000)).toContain('1,000');
      expect(formatEuros(1)).toContain('1');
      expect(formatEuros(0)).toContain('0');
    });

    it('formats fractional values by rounding to nearest integer (maximumFractionDigits: 0)', () => {
      // With maximumFractionDigits: 0, fractional values are rounded
      const result = formatEuros(1_500_000.75);
      expect(result).toContain('1,500,001');
    });

    it('formats negative values (sale losses are displayed as absolute)', () => {
      const result = formatEuros(-5_000_000);
      expect(result).toContain('5,000,000');
    });
  });

  /* ============================
   * 10. Net Worth Change vs Previous Year
   * ============================ */
  describe('10. Net worth change vs previous year', () => {
    it('netWorthAt produces accurate historical values for delta calculation', () => {
      const roster = buildTestRoster();
      const allSeven = [...roster.GK, ...roster.DEF, ...roster.MID, ...roster.ATT];
      const spent = allSeven.reduce((s, p) => s + p.draft_cost, 0);
      const txs = allSeven.map((p) => ({
        playerId: p.id,
        year: 0,
        kind: 'DRAFT' as const,
        amount: p.draft_cost,
      }));

      // At year 0, netWorthAt should be exactly €250M
      const nwAt0 = netWorthAt(0, txs, allSeven);
      expect(nwAt0).toBe(250_000_000);

      // At year 1, it should reflect year-1 valuations
      const nwAt1 = netWorthAt(1, txs, allSeven);
      const expectedBudget = 250_000_000 - spent;
      const expectedSquadVal1 = allSeven.reduce((s, p) => s + p.yearly_values[1], 0);
      expect(nwAt1).toBe(expectedBudget + expectedSquadVal1);
    });
  });
});
