'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useGameStore, rehydrateGameStore } from '../../store/gameStore';
import {
  PLACEHOLDER_SEED,
  INITIAL_BUDGET,
} from '../../lib/game/engine';
import {
  rosterComplete,
  totalSpent as selectTotalSpent,
} from '../../lib/game/selectors';
import { createMysteryCandidateView } from '../../lib/ui/mystery';
import { formatEuros } from '../../lib/ui/format';
import { MysteryCard } from '../../components/draft/MysteryCard';
import { DraftActions } from '../../components/draft/DraftActions';
import { DraftHUD } from '../../components/draft/DraftHUD';
import { TacticalPitch } from '../../components/draft/TacticalPitch';
import { getGuardRedirect } from '../../lib/ui/routes';
import type { ActionErrorCode, Position } from '../../types/game';

/** Represents a card travel animation in flight */
interface TravelingCard {
  id: string; // slot key like "DEF-0", never player id
  position: Position;
  age: number;
  cost: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export default function DraftPage() {
  const router = useRouter();
  const prefersReduced = useReducedMotion();

  const [isHydrated, setIsHydrated] = useState(false);
  const [lastError, setLastError] = useState<ActionErrorCode | null>(null);
  const [travelingCards, setTravelingCards] = useState<TravelingCard[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  // Store state, selectors, and actions
  const phase = useGameStore((s) => s.phase);
  const roster = useGameStore((s) => s.roster);
  const budget = useGameStore((s) => s.budget);
  const skipsRemaining = useGameStore((s) => s.skipsRemaining);
  const rosterIsComplete = useGameStore(rosterComplete);
  const totalSpent = useGameStore(selectTotalSpent);
  const draftPlayerAction = useGameStore((s) => s.draftPlayer);
  const skipCandidateAction = useGameStore((s) => s.skipCandidate);
  const startRevealAction = useGameStore((s) => s.startReveal);
  const getCurrentCandidate = useGameStore((s) => s.getCurrentCandidate);

  // Step 3: Mount effect with getState() check to prevent double game creation in StrictMode
  useEffect(() => {
    let isMounted = true;
    async function initStore() {
      await rehydrateGameStore();
      const current = useGameStore.getState();

      const hasGameInProgress =
        current.transactions.length > 0 ||
        current.phase !== 'DRAFT' ||
        current.seed !== PLACEHOLDER_SEED ||
        current.roster.GK.length > 0 ||
        current.roster.DEF.length > 0 ||
        current.roster.MID.length > 0 ||
        current.roster.ATT.length > 0;

      if (!hasGameInProgress) {
        current.startNewGame();
      }

      if (isMounted) {
        setIsHydrated(true);
      }
    }

    initStore();
    return () => {
      isMounted = false;
    };
  }, []);

  // Route guard: if phase is not DRAFT, redirect to current phase route
  useEffect(() => {
    if (!isHydrated) return;
    const redirect = getGuardRedirect(phase, 'DRAFT');
    if (redirect) {
      router.replace(redirect);
    }
  }, [isHydrated, phase, router]);

  const showSquadLocked = isHydrated && phase === 'DRAFT' && rosterIsComplete;

  const handleContinueToReveal = useCallback(() => {
    const res = startRevealAction();
    if (res.ok) {
      router.push('/reveal');
    }
  }, [startRevealAction, router]);

  // Squad locked auto-transition after 3 seconds
  useEffect(() => {
    if (showSquadLocked) {
      const timer = setTimeout(() => {
        handleContinueToReveal();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showSquadLocked, handleContinueToReveal]);

  // Candidate evaluation
  const candidate = getCurrentCandidate();
  const mysteryView = candidate ? createMysteryCandidateView(candidate) : null;

  const handleDraft = () => {
    if (!candidate) return;
    setLastError(null);

    // Capture info for travel animation BEFORE draft (using position-based slot key)
    const position = candidate.position;
    const slotIndex = roster[position].length; // The slot this player will fill
    const slotKey = `${position}-${slotIndex}`;

    const result = draftPlayerAction(candidate);
    if (!result.ok) {
      setLastError(result.error);
      return;
    }

    // Launch card travel animation (state update was immediate above)
    if (!prefersReduced) {
      const cardRect = cardRef.current?.getBoundingClientRect();
      const slotEl =
        typeof document !== 'undefined'
          ? document.querySelector(`[data-slot-key="${slotKey}"]`)
          : null;
      const slotRect = slotEl?.getBoundingClientRect();

      const startX = cardRect ? cardRect.left + cardRect.width / 2 - 48 : 160;
      const startY = cardRect ? cardRect.top + 80 : 200;
      const endX = slotRect ? slotRect.left + slotRect.width / 2 - 48 : startX + 240;
      const endY = slotRect ? slotRect.top + slotRect.height / 2 - 28 : startY;

      const travel: TravelingCard = {
        id: slotKey,
        position,
        age: candidate.age_at_draft,
        cost: candidate.draft_cost,
        startX,
        startY,
        endX,
        endY,
      };
      setTravelingCards((prev) => [...prev.filter((c) => c.id !== slotKey), travel]);

      // Auto-remove after animation completes
      setTimeout(() => {
        setTravelingCards((prev) => prev.filter((c) => c.id !== slotKey));
      }, 500);
    }
  };

  const handleSkip = () => {
    setLastError(null);
    const result = skipCandidateAction();
    if (!result.ok) {
      setLastError(result.error);
    }
  };

  // Render terminal skeleton until rehydration completes
  if (!isHydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg-page)] p-6 text-[var(--color-text-muted)] font-[family-name:var(--font-mono)]">
        <div className="w-full max-w-sm space-y-4 border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-6 rounded-[var(--radius-sm)] animate-pulse">
          <div className="h-4 w-32 bg-[var(--color-bg-skeleton)] rounded-[var(--radius-xs)]" />
          <div className="h-28 w-28 mx-auto rounded-[var(--radius-full)] bg-[var(--color-bg-skeleton)]" />
          <div className="h-6 w-20 mx-auto bg-[var(--color-bg-skeleton)] rounded-[var(--radius-xs)]" />
          <div className="h-8 w-48 mx-auto bg-[var(--color-bg-skeleton)] rounded-[var(--radius-xs)]" />
          <div className="grid grid-cols-2 gap-2 pt-4">
            <div className="h-12 bg-[var(--color-bg-skeleton)] rounded-[var(--radius-xs)]" />
            <div className="h-12 bg-[var(--color-bg-skeleton)] rounded-[var(--radius-xs)]" />
            <div className="h-12 bg-[var(--color-bg-skeleton)] rounded-[var(--radius-xs)]" />
            <div className="h-12 bg-[var(--color-bg-skeleton)] rounded-[var(--radius-xs)]" />
          </div>
        </div>
        <span className="mt-4 text-xs tracking-widest uppercase text-[var(--color-text-faint)]">
          INITIALIZING TERMINAL...
        </span>
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between bg-[var(--color-bg-page)] text-[var(--color-text-primary)] pb-28 pt-6 px-4">
      {/* Top Terminal Branding Bar */}
      <header className="w-full max-w-5xl flex items-center justify-between border-b border-[var(--color-border-default)] pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-widest text-[var(--color-accent-primary)] border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-2.5 py-1 rounded-[var(--radius-xs)]">
            TERMINAL // DRAFT PHASE
          </span>
          <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-text-faint)] hidden sm:inline">
            SCOUTING BLIND POOL
          </span>
        </div>
        <div className="text-xs font-[family-name:var(--font-mono)] text-[var(--color-text-muted)]">
          CAP: <span className="text-[var(--color-text-primary)] font-semibold">{formatEuros(INITIAL_BUDGET)}</span>
        </div>
      </header>

      {/* Main Content: Mystery Card & Actions alongside Tactical Pitch */}
      <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 my-auto">
        {/* Left Column: Mystery Card & Actions */}
        <div ref={cardRef} className="flex flex-col items-center gap-6 w-full max-w-sm">
          {mysteryView ? (
            <>
              <MysteryCard candidate={mysteryView} />
              <DraftActions
                onDraft={handleDraft}
                onSkip={handleSkip}
                skipsRemaining={skipsRemaining}
                disabled={showSquadLocked}
                lastError={lastError}
              />
            </>
          ) : (
            <div className="border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-8 text-center text-[var(--color-text-muted)] font-[family-name:var(--font-mono)] rounded-[var(--radius-sm)] w-full">
              <p className="text-sm">No candidate available in queue.</p>
            </div>
          )}
        </div>

        {/* Right Column: Tactical Formation Pitch */}
        <div className="flex flex-col items-center w-full max-w-sm sm:max-w-md">
          <TacticalPitch roster={roster} />
        </div>
      </div>

      {/* Card Travel Animation Overlay */}
      <AnimatePresence>
        {travelingCards.map((card) => (
          <motion.div
            key={card.id}
            className="fixed top-0 left-0 z-40 flex flex-col items-center justify-center w-24 min-h-[56px] px-2 py-1.5 border border-[var(--color-accent-primary)] bg-[var(--color-accent-subtle)] rounded-[var(--radius-xs)] pointer-events-none shadow-[0_0_20px_var(--color-accent-glow)]"
            initial={{
              opacity: 1,
              scale: 1,
              x: card.startX,
              y: card.startY,
            }}
            animate={{
              opacity: 0,
              scale: 0.75,
              x: card.endX,
              y: card.endY,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <span className="font-[family-name:var(--font-mono)] text-[10px] font-bold text-[var(--color-accent-primary)] tracking-wider">
              {card.position}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[9px] text-[var(--color-text-secondary)]">
              AGE {card.age}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-xs font-bold text-[var(--color-text-white)] tabular-nums">
              {formatEuros(card.cost)}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Squad-Locked Modal Overlay */}
      <AnimatePresence>
        {showSquadLocked && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg-overlay)] backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="squad-locked-title"
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.3 }}
          >
            <motion.div
              className="w-full max-w-md border border-[var(--color-accent-border-strong)] bg-[var(--color-bg-hud)] p-8 text-center text-[var(--color-text-primary)] shadow-[0_0_50px_var(--color-accent-glow-modal)] font-[family-name:var(--font-mono)] rounded-[var(--radius-sm)]"
              initial={prefersReduced ? false : { scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={prefersReduced ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
            >
              <div
                className={`h-3 w-3 rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] mx-auto mb-4 ${
                  prefersReduced ? '' : 'animate-ping'
                }`}
              />
              <h2
                id="squad-locked-title"
                className="text-2xl font-bold tracking-widest text-[var(--color-text-white)] uppercase mb-2"
              >
                SQUAD LOCKED
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mb-6 tracking-wide">
                All 7 roster slots filled (1 GK, 2 DEF, 2 MID, 2 ATT). Ready for identity reveal.
              </p>

              {/* Staged reveal of financial summary */}
              <motion.div
                className="grid grid-cols-2 gap-3 border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 mb-6 text-left rounded-[var(--radius-xs)]"
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReduced ? { duration: 0 } : { delay: 0.2, duration: 0.4 }}
              >
                <motion.div
                  initial={prefersReduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={prefersReduced ? { duration: 0 } : { delay: 0.35, duration: 0.3 }}
                >
                  <span className="block text-[10px] text-[var(--color-text-muted)] uppercase">TOTAL CAPITAL DEPLOYED</span>
                  <span className="text-lg font-bold text-[var(--color-text-white)] tabular-nums" data-testid="squad-locked-spent">
                    {formatEuros(totalSpent)}
                  </span>
                </motion.div>
                <motion.div
                  initial={prefersReduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={prefersReduced ? { duration: 0 } : { delay: 0.5, duration: 0.3 }}
                >
                  <span className="block text-[10px] text-[var(--color-text-muted)] uppercase">REMAINING CASH</span>
                  <span className="text-lg font-bold text-[var(--color-text-accent)] tabular-nums" data-testid="squad-locked-remaining">
                    {formatEuros(budget)}
                  </span>
                </motion.div>
              </motion.div>

              {/* CONTINUE TO REVEAL button - always visible immediately, never gated by animation */}
              <button
                type="button"
                onClick={handleContinueToReveal}
                className="w-full min-h-[48px] border border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] py-3 text-sm font-bold uppercase tracking-wider text-[var(--color-accent-contrast)] rounded-[var(--radius-xs)] transition-all hover:bg-[var(--color-accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-hud)]"
              >
                CONTINUE TO REVEAL
              </button>
              <span className="block text-[10px] text-[var(--color-text-faint)] mt-3">
                Auto-advancing in 3 seconds...
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Bottom HUD */}
      <DraftHUD />
    </main>
  );
}
