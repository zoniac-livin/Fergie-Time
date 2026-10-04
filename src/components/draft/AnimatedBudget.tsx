'use client';

import React, { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'framer-motion';
import { formatEuros } from '../../lib/ui/format';

interface AnimatedBudgetProps {
  budget: number;
}

/**
 * Animated budget counter that tweens between values.
 * - Uses framer-motion `animate()` on a ref (no React state for intermediate frames)
 * - The displayed number always settles to the exact store value
 * - aria-live announces only the final value, not intermediate frames
 * - Reduced motion: shows the final value immediately, no animation
 */
export const AnimatedBudget: React.FC<AnimatedBudgetProps> = ({ budget }) => {
  const prefersReduced = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevBudgetRef = useRef(budget);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const from = prevBudgetRef.current;
    const to = budget;
    prevBudgetRef.current = to;

    if (prefersReduced || from === to) {
      el.textContent = formatEuros(to);
      return;
    }

    const controls = animate(from, to, {
      duration: 0.5,
      ease: 'easeOut',
      onUpdate: (latest) => {
        el.textContent = formatEuros(Math.round(latest));
      },
      onComplete: () => {
        // Guarantee exact final value
        el.textContent = formatEuros(to);
      },
    });

    return () => controls.stop();
  }, [budget, prefersReduced]);

  return (
    <>
      <span
        ref={spanRef}
        className="font-[family-name:var(--font-mono)] text-xl font-bold tracking-tight text-[var(--color-text-white)] tabular-nums sm:text-2xl"
        data-testid="budget-display"
      >
        {formatEuros(budget)}
      </span>
      {/* Screen reader only: announces final budget value */}
      <span aria-live="polite" className="sr-only" data-testid="budget-aria">
        Remaining budget: {formatEuros(budget)}
      </span>
    </>
  );
};
