'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore, rehydrateGameStore } from '../../store/gameStore';
import {
  netWorth as selectNetWorth,
  squadValue as selectSquadValue,
  netWorthAt,
  getDraftedPlayers,
  getTransactionLog,
} from '../../lib/game/selectors';
import { formatEuros, formatActionError } from '../../lib/ui/format';
import { getOrderedRosterPlayers, getNextFocusTargetAfterSale } from '../../lib/ui/sim';
import { getGuardRedirect } from '../../lib/ui/routes';
import { SquadRow } from '../../components/sim/SquadRow';
import { SummaryStrip } from '../../components/sim/SummaryStrip';
import type { PlayerProfile } from '../../types/game';
import rawPlayers from '../../data/players.json';

const playerPool: PlayerProfile[] = rawPlayers as PlayerProfile[];

export default function SimPage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [sellErrors, setSellErrors] = useState<Record<string, string>>({});

  const nextYearBtnRef = useRef<HTMLButtonElement | null>(null);

  // Store state and actions
  const phase = useGameStore((s) => s.phase);
  const roster = useGameStore((s) => s.roster);
  const budget = useGameStore((s) => s.budget);
  const currentYear = useGameStore((s) => s.currentYear);
  const transactions = useGameStore((s) => s.transactions);
  const sellPlayerAction = useGameStore((s) => s.sellPlayer);
  const advanceYearAction = useGameStore((s) => s.advanceYear);
  const endSimulationAction = useGameStore((s) => s.endSimulation);

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
    const redirect = getGuardRedirect(phase, 'SIMULATION');
    if (redirect) {
      router.replace(redirect);
    }
  }, [isHydrated, phase, router]);

  // Derived values (pure selectors, no mutation)
  const state = useGameStore.getState();
  const clubNetWorth = selectNetWorth(state);
  const totalSquadValue = selectSquadValue(state);
  const allDrafted = getDraftedPlayers(state, playerPool);
  const transactionLog = getTransactionLog(state, playerPool);

  // Net worth change vs previous year (only at year >= 1)
  const prevYearNetWorth =
    currentYear >= 1
      ? netWorthAt(currentYear - 1, transactions, allDrafted)
      : null;
  const netWorthDelta = prevYearNetWorth !== null ? clubNetWorth - prevYearNetWorth : null;

  // Squad list in fixed order
  const rosterPlayers = getOrderedRosterPlayers(roster);
  const isEmptyRoster = rosterPlayers.length === 0;
  const isAtYear10 = currentYear === 10;

  // SELL handler
  const handleSell = useCallback(
    (playerId: string) => {
      const player = rosterPlayers.find((p) => p.id === playerId);
      const result = sellPlayerAction(playerId);
      if (result.ok && player) {
        const saleAmount = player.yearly_values[currentYear];
        setLiveAnnouncement(`Sold ${player.name} for ${formatEuros(saleAmount)}`);
        // Clear any previous error for this player
        setSellErrors((prev) => {
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
        // Focus management: move to the next sell button or NEXT YEAR
        const target = getNextFocusTargetAfterSale(rosterPlayers, playerId);
        setTimeout(() => {
          if (target.kind === 'SELL') {
            const btn = document.querySelector<HTMLButtonElement>(
              `[data-testid="sell-btn-${target.playerId}"]`
            );
            btn?.focus();
          } else {
            nextYearBtnRef.current?.focus();
          }
        }, 50);
      } else if (!result.ok) {
        const { message } = formatActionError(result.error);
        setSellErrors((prev) => ({ ...prev, [playerId]: message }));
      }
    },
    [rosterPlayers, sellPlayerAction, currentYear]
  );

  // NEXT YEAR handler
  const handleNextYear = useCallback(() => {
    const result = advanceYearAction();
    if (result.ok) {
      const newState = useGameStore.getState();
      const newNetWorth = selectNetWorth(newState);
      setLiveAnnouncement(
        `Year ${String(newState.currentYear).padStart(2, '0')} — Club net worth: ${formatEuros(newNetWorth)}`
      );
      // Clear all sell errors on year change
      setSellErrors({});
    }
  }, [advanceYearAction]);

  // COMPLETE SIMULATION handler
  const handleCompleteSimulation = useCallback(() => {
    const result = endSimulationAction();
    if (result.ok) {
      router.push('/results');
    }
  }, [endSimulationAction, router]);

  // Loading skeleton
  if (!isHydrated || phase !== 'SIMULATION') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-page)] text-[var(--color-text-muted)] font-[family-name:var(--font-mono)] p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-[var(--radius-full)] animate-spin" />
          <span className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">
            Loading Simulation...
          </span>
        </div>
      </div>
    );
  }

  const yearPadded = String(currentYear).padStart(2, '0');

  return (
    <main className="min-h-screen bg-[var(--color-bg-page)] text-[var(--color-text-primary)] font-[family-name:var(--font-mono)] p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      {/* Accessible Live Region — fires ONLY on user actions */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="sim-live-region"
      >
        {liveAnnouncement}
      </div>

      {/* Header */}
      <header className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[var(--color-border-default)] pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] animate-pulse" />
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-widest uppercase text-[var(--color-text-primary)]">
              SIMULATION PHASE
            </h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              Manage your squad across 10 years. Sell players to lock in value.
            </p>
          </div>
        </div>
      </header>

      {/* Year Indicator */}
      <section className="w-full max-w-5xl mb-6" aria-label="Year indicator">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl sm:text-3xl font-bold tracking-widest text-[var(--color-text-white)]" data-testid="year-display">
            YEAR {yearPadded}
          </span>
          <span className="text-lg sm:text-xl font-bold text-[var(--color-text-muted)]">
            / 10
          </span>
        </div>

        {/* 11-tick Timeline */}
        <div className="flex gap-1 items-center" data-testid="year-timeline" role="img" aria-label={`Year ${currentYear} of 10`}>
          {Array.from({ length: 11 }, (_, i) => (
            <div
              key={i}
              data-testid={`timeline-tick-${i}`}
              className={`flex-1 h-2 rounded-[var(--radius-xs)] transition-colors ${i <= currentYear
                  ? 'bg-[var(--color-accent-primary)]'
                  : 'bg-[var(--color-bg-elevated)]'
                } ${i === currentYear ? 'ring-1 ring-[var(--color-accent-primary)] shadow-[0_0_8px_var(--color-accent-glow)]' : ''}`}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-[var(--color-text-faint)] tracking-wider">
          <span>0</span>
          <span>5</span>
          <span>10</span>
        </div>
      </section>

      {/* Summary Strip */}
      <SummaryStrip
        clubNetWorth={clubNetWorth}
        budget={budget}
        totalSquadValue={totalSquadValue}
        currentYear={currentYear}
        netWorthDelta={netWorthDelta}
      />

      {/* Main content: Squad List + Transaction Log */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Squad List */}
        <section className="lg:col-span-2 flex flex-col gap-3" aria-label="Squad list">
          <h2 className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] font-bold border-b border-[var(--color-border-subtle)] pb-2">
            YOUR SQUAD ({rosterPlayers.length})
          </h2>

          {isEmptyRoster ? (
            <div
              className="flex flex-col items-center justify-center p-8 border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-card)] rounded-[var(--radius-sm)] text-center"
              data-testid="empty-roster-state"
            >
              <span className="text-sm text-[var(--color-text-muted)] mb-1">
                No players left — holding cash
              </span>
              <span className="text-lg font-bold text-[var(--color-text-white)] tabular-nums">
                {formatEuros(budget)}
              </span>
            </div>
          ) : (
            rosterPlayers.map((player) => (
              <SquadRow
                key={player.id}
                player={player}
                currentYear={currentYear}
                budget={budget}
                onSell={handleSell}
                sellError={sellErrors[player.id] ?? null}
              />
            ))
          )}
        </section>

        {/* Transaction Log */}
        <aside className="flex flex-col gap-3" aria-label="Transaction log">
          <h2 className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] font-bold border-b border-[var(--color-border-subtle)] pb-2">
            TRANSACTION LOG
          </h2>

          <div
            className="border border-[var(--color-border-default)] bg-[var(--color-bg-card)] rounded-[var(--radius-sm)] overflow-hidden"
            data-testid="transaction-log"
          >
            {transactionLog.length === 0 ? (
              <div className="p-4 text-xs text-[var(--color-text-muted)] text-center">
                No transactions yet
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-subtle)]">
                {transactionLog.map((entry, i) => (
                  <div
                    key={`tx-${i}`}
                    className="flex items-center justify-between p-2.5 text-xs font-[family-name:var(--font-mono)]"
                    data-testid={`tx-entry-${i}`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded-[var(--radius-xs)] text-[10px] font-bold uppercase tracking-wider ${entry.kind === 'DRAFT'
                            ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] border border-[var(--color-accent-border)]'
                            : 'bg-[var(--color-error-bg)] text-[var(--color-warning)] border border-[var(--color-error-border)]'
                          }`}
                      >
                        {entry.kind}
                      </span>
                      <span className="truncate text-[var(--color-text-secondary)]">
                        {entry.playerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[var(--color-text-faint)]">
                        YR {String(entry.year).padStart(2, '0')}
                      </span>
                      <span className="tabular-nums font-bold text-[var(--color-text-white)]">
                        {formatEuros(entry.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* NEXT YEAR / COMPLETE SIMULATION button */}
      <div className="w-full max-w-5xl mt-8 flex justify-center">
        {isAtYear10 ? (
          <button
            ref={nextYearBtnRef}
            type="button"
            onClick={handleCompleteSimulation}
            data-testid="complete-sim-btn"
            className="px-6 py-3 border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)] hover:text-[var(--color-accent-contrast)] text-sm font-bold uppercase tracking-wider rounded-[var(--radius-sm)] cursor-pointer transition-colors shadow-[0_0_12px_var(--color-accent-glow)] min-h-[44px]"
          >
            COMPLETE SIMULATION
          </button>
        ) : (
          <button
            ref={nextYearBtnRef}
            type="button"
            onClick={handleNextYear}
            data-testid="next-year-btn"
            className="px-6 py-3 border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)] hover:text-[var(--color-accent-contrast)] text-sm font-bold uppercase tracking-wider rounded-[var(--radius-sm)] cursor-pointer transition-colors shadow-[0_0_12px_var(--color-accent-glow)] min-h-[44px]"
          >
            NEXT YEAR →
          </button>
        )}
      </div>
    </main>
  );
}
