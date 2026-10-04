'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore, rehydrateGameStore } from '../../store/gameStore';
import { INITIAL_BUDGET } from '../../lib/game/engine';
import {
  netWorth as selectNetWorth,
  squadValue as selectSquadValue,
  totalSpent as selectTotalSpent,
  netWorthAt,
  getDraftedPlayers,
  bestInvestment,
  worstFlop,
  getPlayerExitStatus,
  getExitValue,
} from '../../lib/game/selectors';
import { getRank } from '../../lib/game/rank';
import { formatEuros } from '../../lib/ui/format';
import { getGuardRedirect } from '../../lib/ui/routes';
import { NetWorthChart } from '../../components/results/NetWorthChart';
import { BestInvestmentCard, WorstFlopCard } from '../../components/results/BestWorstCard';
import { PlayerHistoryCard } from '../../components/results/PlayerHistoryCard';
import type { PlayerProfile } from '../../types/game';
import rawPlayers from '../../data/players.json';

const playerPool: PlayerProfile[] = rawPlayers as PlayerProfile[];

/** Fixed positional sort order: GK, DEF, MID, ATT */
function sortPlayersByPosition(players: readonly PlayerProfile[]): PlayerProfile[] {
  const order: Record<PlayerProfile['position'], number> = {
    GK: 0,
    DEF: 1,
    MID: 2,
    ATT: 3,
  };
  return [...players].sort((a, b) => {
    if (order[a.position] !== order[b.position]) {
      return order[a.position] - order[b.position];
    }
    return Number(a.id) - Number(b.id);
  });
}

export default function ResultsPage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);

  // Store state and actions
  const phase = useGameStore((s) => s.phase);
  const budget = useGameStore((s) => s.budget);
  const transactions = useGameStore((s) => s.transactions);
  const resetGame = useGameStore((s) => s.resetGame);

  // Hydration
  useEffect(() => {
    let isMounted = true;
    async function initStore() {
      await rehydrateGameStore();
      if (isMounted) {
        setIsHydrated(true);
      }
    }
    initStore();
    return () => {
      isMounted = false;
    };
  }, []);

  // Route guard
  useEffect(() => {
    if (!isHydrated) return;
    const redirect = getGuardRedirect(phase, 'ENDGAME');
    if (redirect) {
      router.replace(redirect);
    }
  }, [isHydrated, phase, router]);

  // Derived financial calculations (pure selectors, no mutations)
  const state = useGameStore.getState();
  const finalNetWorth = selectNetWorth(state);
  const finalSquadValue = selectSquadValue(state);
  const draftSpent = selectTotalSpent(state);
  const investorRank = getRank(finalNetWorth);

  const deltaVsStart = finalNetWorth - INITIAL_BUDGET;
  const deltaVsStartPct = (deltaVsStart / INITIAL_BUDGET) * 100;

  const allDrafted = getDraftedPlayers(state, playerPool);
  const orderedDrafted = sortPlayersByPosition(allDrafted);

  // Yearly progression for chart
  const yearlyNetWorth = Array.from({ length: 11 }, (_, yr) =>
    netWorthAt(yr, transactions, allDrafted)
  );
  const sellYears = transactions
    .filter((t) => t.kind === 'SELL')
    .map((t) => t.year);

  // Best & worst
  const best = bestInvestment(state, allDrafted);
  const flop = worstFlop(state, allDrafted);

  const handlePlayAgain = () => {
    resetGame();
    router.push('/draft');
  };

  // Loading skeleton
  if (!isHydrated || phase !== 'ENDGAME') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-page)] text-[var(--color-text-muted)] font-[family-name:var(--font-mono)] p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-[var(--radius-full)] animate-spin" />
          <span className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">
            Loading Career Results...
          </span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg-page)] text-[var(--color-text-primary)] font-[family-name:var(--font-mono)] p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl flex flex-col gap-8">
        {/* Header */}
        <header className="border-b border-[var(--color-border-default)] pb-6">
          <div className="flex items-center gap-2 mb-2 text-xs text-[var(--color-text-muted)] uppercase tracking-widest">
            <span className="h-2 w-2 rounded-[var(--radius-full)] bg-[var(--color-accent-primary)]" />
            CAREER COMPLETED · 10-YEAR REPORT
          </div>

          {/* Headline + Rank Badge */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider block mb-1">
                FINAL CLUB NET WORTH
              </span>
              <div
                className="text-3xl sm:text-4xl lg:text-5xl font-black text-[var(--color-text-white)] tracking-tight tabular-nums"
                data-testid="final-net-worth-headline"
              >
                {formatEuros(finalNetWorth)}
              </div>
            </div>

            {/* Rank Badge */}
            <div className="self-start md:self-auto">
              <span
                className={`inline-block px-3 py-1.5 rounded-[var(--radius-xs)] font-bold text-xs sm:text-sm uppercase tracking-wider border ${
                  investorRank === 'MASTER NEGOTIATOR'
                    ? 'border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] shadow-[0_0_12px_var(--color-accent-glow)]'
                    : investorRank === 'TRANSFER STRATEGIST'
                      ? 'border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]'
                      : 'border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-warning)]'
                }`}
                data-testid="rank-badge"
              >
                {investorRank}
              </span>
            </div>
          </div>

          {/* Delta vs Initial Budget */}
          <div className="mt-3 flex items-center gap-2 text-sm tabular-nums">
            <span className="text-xs text-[var(--color-text-muted)] uppercase">
              VS STARTING €250M:
            </span>
            <span
              className={`font-bold ${
                deltaVsStart > 0
                  ? 'text-[var(--color-accent-primary)]'
                  : deltaVsStart < 0
                    ? 'text-[var(--color-warning)]'
                    : 'text-[var(--color-text-muted)]'
              }`}
              data-testid="delta-vs-start"
            >
              {deltaVsStart > 0 && `▲ +${formatEuros(deltaVsStart)} (+${deltaVsStartPct.toFixed(1)}%) UP`}
              {deltaVsStart < 0 && `▼ −${formatEuros(Math.abs(deltaVsStart))} (${deltaVsStartPct.toFixed(1)}%) DOWN`}
              {deltaVsStart === 0 && `■ ${formatEuros(0)} (0.0%) FLAT`}
            </span>
          </div>

          {/* Financial Breakdown Line */}
          <div
            className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-3 bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] text-xs text-[var(--color-text-secondary)] tabular-nums"
            data-testid="breakdown-line"
          >
            <div>
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase mr-1">CASH</span>
              <span className="font-bold text-[var(--color-text-white)]" data-testid="breakdown-cash">
                {formatEuros(budget)}
              </span>
            </div>
            <span className="text-[var(--color-text-muted)]" aria-hidden="true">+</span>
            <div>
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase mr-1">SQUAD VAL (YR 10)</span>
              <span className="font-bold text-[var(--color-text-white)]" data-testid="breakdown-squad-value">
                {formatEuros(finalSquadValue)}
              </span>
            </div>
            <span className="text-[var(--color-text-muted)]" aria-hidden="true">=</span>
            <div>
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase mr-1">NET WORTH</span>
              <span className="font-bold text-[var(--color-accent-primary)]" data-testid="breakdown-net-worth">
                {formatEuros(finalNetWorth)}
              </span>
            </div>
            <div className="ml-auto text-[10px] text-[var(--color-text-muted)]">
              TOTAL SPENT AT DRAFT:{' '}
              <span className="font-bold text-[var(--color-text-secondary)]" data-testid="breakdown-total-spent">
                {formatEuros(draftSpent)}
              </span>
            </div>
          </div>
        </header>

        {/* Best Investment & Worst Flop */}
        <section aria-label="Key investments" className="flex flex-col sm:flex-row gap-4">
          <BestInvestmentCard
            result={best}
            exitStatus={best ? getPlayerExitStatus(best.player, transactions) : null}
          />
          <WorstFlopCard
            result={flop}
            exitStatus={flop.status === 'FLOP' ? getPlayerExitStatus(flop.player, transactions) : null}
          />
        </section>

        {/* Net Worth Chart */}
        <section
          aria-label="10-year net worth progression chart"
          className="p-4 border border-[var(--color-border-default)] bg-[var(--color-bg-card)] rounded-[var(--radius-sm)] flex flex-col gap-3"
        >
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
            <h2 className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] font-bold">
              10-YEAR CLUB NET WORTH PROGRESSION
            </h2>
            <span className="text-[10px] text-[var(--color-text-faint)]">
              YEAR 0 → YEAR 10
            </span>
          </div>

          <NetWorthChart
            yearlyNetWorth={yearlyNetWorth}
            sellYears={sellYears}
          />
        </section>

        {/* Player History Cards */}
        <section aria-label="Drafted player histories" className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
            <h2 className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] font-bold">
              PLAYER INVESTMENT HISTORIES ({orderedDrafted.length})
            </h2>
            <span className="text-[10px] text-[var(--color-text-faint)]">
              SORTED BY POSITION (GK → DEF → MID → ATT)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="player-history-grid">
            {orderedDrafted.map((player) => (
              <PlayerHistoryCard
                key={player.id}
                player={player}
                exitStatus={getPlayerExitStatus(player, transactions)}
                exitValue={getExitValue(player, transactions)}
              />
            ))}
          </div>
        </section>

        {/* PLAY AGAIN */}
        <div className="flex justify-center pt-4 pb-12">
          <button
            type="button"
            onClick={handlePlayAgain}
            data-testid="play-again-btn"
            className="px-8 py-3.5 border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)] hover:text-[var(--color-accent-contrast)] text-sm font-bold uppercase tracking-wider rounded-[var(--radius-sm)] cursor-pointer transition-colors shadow-[0_0_12px_var(--color-accent-glow)] min-h-[44px] min-w-[44px]"
          >
            PLAY AGAIN
          </button>
        </div>
      </div>
    </main>
  );
}
