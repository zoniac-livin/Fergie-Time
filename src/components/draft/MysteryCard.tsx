'use client';

import React, { useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import type { MysteryCandidateView } from '../../types/ui';
import { formatEuros } from '../../lib/ui/format';

interface MysteryCardProps {
  candidate: MysteryCandidateView;
}

/**
 * Mystery card with pointer-based tilt effect.
 * - Tilt only for fine pointers (no touch) and no reduced motion
 * - Pointer position stored in motion values (ref-based), not React state
 * - Animates only transform and opacity
 */
export const MysteryCard: React.FC<MysteryCardProps> = ({ candidate }) => {
  const isGK = candidate.position === 'GK';
  const prefersReduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  // Pointer-based tilt: motion values, never React state
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const rotateX = useTransform(mouseY, [0, 1], [6, -6]);
  const rotateY = useTransform(mouseX, [0, 1], [-6, 6]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only respond to fine pointers (mouse/trackpad) and when reduced motion is off
      if (prefersReduced || e.pointerType === 'touch') return;
      if (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        !window.matchMedia('(hover: hover) and (pointer: fine)').matches
      ) {
        return;
      }
      const el = cardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      mouseX.set((e.clientX - rect.left) / rect.width);
      mouseY.set((e.clientY - rect.top) / rect.height);
    },
    [prefersReduced, mouseX, mouseY],
  );

  const handlePointerLeave = useCallback(() => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  }, [mouseX, mouseY]);

  // CSS media query (hover: hover) and (pointer: fine) is handled via the tilt-card class
  // We apply the tilt style only on the motion.div; CSS @media handles the rest
  const tiltEnabled = !prefersReduced;

  return (
    <motion.div
      ref={cardRef}
      className="mystery-card-tilt relative w-full max-w-sm overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] rounded-[var(--radius-sm)] shadow-xl"
      aria-label="Mystery Draft Candidate"
      style={
        tiltEnabled
          ? { rotateX, rotateY, transformPerspective: 600 }
          : undefined
      }
      onPointerMove={tiltEnabled ? handlePointerMove : undefined}
      onPointerLeave={tiltEnabled ? handlePointerLeave : undefined}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] bg-[var(--color-bg-hud)] px-4 py-2 text-xs font-[family-name:var(--font-mono)] tracking-wider">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-[var(--radius-full)] bg-[var(--color-accent-primary)]" />
          <span className="text-[var(--color-text-muted)]">SCOUT PROFILE</span>
        </span>
        <span className="rounded-[var(--radius-xs)] bg-[var(--color-bg-badge)] px-2 py-0.5 font-bold text-[var(--color-text-secondary)]">
          AGE {candidate.age_at_draft}
        </span>
      </div>

      {/* Silhouette & Position Section */}
      <div className="relative flex flex-col items-center justify-center p-6 pb-2">
        {/* Pitch line watermark graphic */}
        <svg
          className="absolute inset-0 h-full w-full opacity-10 pointer-events-none"
          viewBox="0 0 200 200"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="100" cy="100" r="40" strokeWidth="1" />
          <line x1="0" y1="100" x2="200" y2="100" strokeWidth="1" />
        </svg>

        {/* Silhouette graphic */}
        <div className="relative mb-3 flex h-28 w-28 items-center justify-center rounded-[var(--radius-full)] border border-[var(--color-border-default)] bg-[var(--color-bg-avatar)]">
          <svg
            className="h-16 w-16 text-[var(--color-text-faint)]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>

        {/* Position Badge */}
        <div className="mb-2">
          <span className="inline-block border border-[var(--color-accent-border-focus)] bg-[var(--color-accent-subtle)] px-3 py-1 font-[family-name:var(--font-mono)] text-sm font-bold tracking-widest text-[var(--color-accent-primary)] rounded-[var(--radius-xs)]">
            {candidate.position}
          </span>
        </div>

        {/* Draft Cost */}
        <div className="text-center">
          <div className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-widest text-[var(--color-text-muted)]">
            DRAFT VALUATION
          </div>
          <div className="font-[family-name:var(--font-mono)] text-2xl font-bold tracking-tight text-[var(--color-text-white)] tabular-nums sm:text-3xl">
            {formatEuros(candidate.draft_cost)}
          </div>
        </div>
      </div>

      {/* Draft-Season Performance Stats Grid */}
      <div className="p-4 pt-2">
        <div className="mb-2 border-b border-[var(--color-border-default)] pb-1 text-[11px] font-[family-name:var(--font-mono)] uppercase tracking-wider text-[var(--color-text-muted)]">
          SEASON PRODUCTION METRICS
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-[family-name:var(--font-mono)]">
          <div className="border border-[var(--color-border-subtle)] bg-[var(--color-bg-card-subtle)] p-2 rounded-[var(--radius-xs)]">
            <span className="block text-[10px] text-[var(--color-text-muted)]">APPEARANCES</span>
            <span className="text-base font-semibold text-[var(--color-text-primary)] tabular-nums">
              {candidate.stats.appearances}
            </span>
          </div>

          <div className="border border-[var(--color-border-subtle)] bg-[var(--color-bg-card-subtle)] p-2 rounded-[var(--radius-xs)]">
            <span className="block text-[10px] text-[var(--color-text-muted)]">MINUTES PLAYED</span>
            <span className="text-base font-semibold text-[var(--color-text-primary)] tabular-nums">
              {candidate.stats.minutes.toLocaleString('en-US')}
            </span>
          </div>

          {!isGK && (
            <>
              <div className="border border-[var(--color-border-subtle)] bg-[var(--color-bg-card-subtle)] p-2 rounded-[var(--radius-xs)]">
                <span className="block text-[10px] text-[var(--color-text-muted)]">GOALS / 90</span>
                <span className="text-base font-semibold text-[var(--color-text-accent)] tabular-nums">
                  {candidate.stats.goalsPer90 ?? '0.00'}
                </span>
              </div>

              <div className="border border-[var(--color-border-subtle)] bg-[var(--color-bg-card-subtle)] p-2 rounded-[var(--radius-xs)]">
                <span className="block text-[10px] text-[var(--color-text-muted)]">ASSISTS / 90</span>
                <span className="text-base font-semibold text-[var(--color-text-accent)] tabular-nums">
                  {candidate.stats.assistsPer90 ?? '0.00'}
                </span>
              </div>
            </>
          )}

          <div className="border border-[var(--color-border-subtle)] bg-[var(--color-bg-card-subtle)] p-2 rounded-[var(--radius-xs)]">
            <span className="block text-[10px] text-[var(--color-text-muted)]">YELLOW CARDS</span>
            <span className="text-base font-semibold text-[var(--color-warning)] tabular-nums">
              {candidate.stats.yellow_cards}
            </span>
          </div>

          <div className="border border-[var(--color-border-subtle)] bg-[var(--color-bg-card-subtle)] p-2 rounded-[var(--radius-xs)]">
            <span className="block text-[10px] text-[var(--color-text-muted)]">RED CARDS</span>
            <span className="text-base font-semibold text-[var(--color-danger)] tabular-nums">
              {candidate.stats.red_cards}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
