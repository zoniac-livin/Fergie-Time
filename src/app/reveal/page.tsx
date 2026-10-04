'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore, rehydrateGameStore } from '../../store/gameStore';
import {
  getRevealOrder,
  netWorth as selectNetWorth,
  squadValue as selectSquadValue,
} from '../../lib/game/selectors';
import { formatEuros } from '../../lib/ui/format';
import { RevealCard } from '../../components/reveal/RevealCard';
import { RevealPitch } from '../../components/reveal/RevealPitch';
import { ClubValuePanel } from '../../components/reveal/ClubValuePanel';
import { getGuardRedirect } from '../../lib/ui/routes';

export default function RevealPage() {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [lastRevealedIndex, setLastRevealedIndex] = useState<number | null>(null);

  const startSimButtonRef = useRef<HTMLButtonElement | null>(null);
  const revealNextButtonRef = useRef<HTMLButtonElement | null>(null);

  // Store state and actions
  const phase = useGameStore((s) => s.phase);
  const roster = useGameStore((s) => s.roster);
  const budget = useGameStore((s) => s.budget);
  const revealedCount = useGameStore((s) => s.revealedCount);
  const revealNextAction = useGameStore((s) => s.revealNext);
  const completeRevealAction = useGameStore((s) => s.completeReveal);

  // Hydration effect: rehydrates store and marks hydrated
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

  // Route guard: redirects if phase is not REVEAL
  useEffect(() => {
    if (!isHydrated) return;
    const redirect = getGuardRedirect(phase, 'REVEAL');
    if (redirect) {
      router.replace(redirect);
    }
  }, [isHydrated, phase, router]);

  // Derived selector calculations
  const state = useGameStore.getState();
  const revealOrder = getRevealOrder(state);
  const clubNetWorth = selectNetWorth(state);
  const totalSquadValue = selectSquadValue(state);

  const isAllRevealed = revealedCount >= 7;

  // Focus management: when all 7 are revealed, move focus to START SIMULATION
  useEffect(() => {
    if (isAllRevealed && startSimButtonRef.current) {
      startSimButtonRef.current.focus();
    }
  }, [isAllRevealed]);

  // REVEAL NEXT action handler
  const handleRevealNext = useCallback(() => {
    if (revealedCount >= 7) return;

    const targetIndex = revealedCount;
    const targetPlayer = revealOrder[targetIndex];

    const result = revealNextAction();
    if (result.ok && targetPlayer) {
      setLastRevealedIndex(targetIndex);
      // Fires ONLY on user click, announcing revealed card details
      setLiveAnnouncement(
        `Revealed: ${targetPlayer.name}, ${targetPlayer.position}, cost ${formatEuros(targetPlayer.draft_cost)}`
      );
    }
  }, [revealedCount, revealOrder, revealNextAction]);

  // START SIMULATION action handler
  const handleStartSimulation = useCallback(() => {
    const result = completeRevealAction();
    if (result.ok) {
      router.push('/sim');
    }
  }, [completeRevealAction, router]);

  // Skeleton loading state until rehydration is complete
  if (!isHydrated || phase !== 'REVEAL') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-page)] text-[var(--color-text-muted)] font-[family-name:var(--font-mono)] p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-[var(--radius-full)] animate-spin" />
          <span className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">
            Loading Reveal Phase...
          </span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg-page)] text-[var(--color-text-primary)] font-[family-name:var(--font-mono)] p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      {/* Accessible Live Region for Screen Readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="reveal-live-region"
      >
        {liveAnnouncement}
      </div>

      {/* Header Bar */}
      <header className="w-full max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[var(--color-border-default)] pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] animate-pulse" />
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-widest uppercase text-[var(--color-text-primary)]">
              REVEAL PHASE
            </h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              Unmask your 7 mystery signings and uncover their career identities.
            </p>
          </div>
        </div>

        {/* Reveal Progress Badge & Action */}
        <div className="flex items-center gap-3">
          <div className="border border-[var(--color-border-default)] bg-[var(--color-bg-card)] px-3 py-1.5 rounded-[var(--radius-xs)] text-xs text-[var(--color-text-secondary)]">
            PROGRESS:{' '}
            <span className="text-[var(--color-accent-primary)] font-bold tabular-nums">
              {revealedCount} / 7
            </span>
          </div>

          {!isAllRevealed && (
            <button
              ref={revealNextButtonRef}
              type="button"
              onClick={handleRevealNext}
              data-testid="reveal-next-btn"
              className="px-4 py-2 border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)] hover:text-[var(--color-accent-contrast)] text-xs font-bold uppercase tracking-wider rounded-[var(--radius-xs)] cursor-pointer transition-colors shadow-[0_0_12px_var(--color-accent-glow)]"
            >
              REVEAL NEXT ({7 - revealedCount} REMAINING)
            </button>
          )}
        </div>
      </header>

      {/* Main Content Layout: Cards Grid + Tactics Board */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: 7 Cards Grid */}
        <section
          aria-label="Squad Cards"
          className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5"
        >
          {revealOrder.map((player, index) => {
            const isRevealed = index < revealedCount;
            const isTarget = isRevealed
              ? index === lastRevealedIndex
              : index === revealedCount;

            return (
              <RevealCard
                key={`reveal-card-${index}`}
                player={player}
                index={index}
                isRevealed={isRevealed}
                isTarget={isTarget}
              />
            );
          })}
        </section>

        {/* Right Col: Tactics Pitch & Valuation (when complete) */}
        <aside
          aria-label="Tactics Board & Squad Overview"
          className="flex flex-col items-center gap-5 w-full"
        >
          <RevealPitch roster={roster} revealedCount={revealedCount} />

          {/* Club Valuation Panel - Appears only at revealedCount === 7 */}
          {isAllRevealed && (
            <ClubValuePanel
              netWorth={clubNetWorth}
              budget={budget}
              squadValue={totalSquadValue}
              onStartSimulation={handleStartSimulation}
              buttonRef={startSimButtonRef}
            />
          )}
        </aside>
      </div>
    </main>
  );
}
