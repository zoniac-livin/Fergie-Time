import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { AnimatedBudget } from './AnimatedBudget';

export const DraftHUD: React.FC = () => {
  const budget = useGameStore((s) => s.budget);
  const roster = useGameStore((s) => s.roster);
  const skipsRemaining = useGameStore((s) => s.skipsRemaining);

  const gkCount = roster.GK.length;
  const defCount = roster.DEF.length;
  const midCount = roster.MID.length;
  const attCount = roster.ATT.length;
  const totalDrafted = gkCount + defCount + midCount + attCount;

  // 7 slots in order: 1 GK, 2 DEF, 2 MID, 2 ATT
  const slotPips = [
    { pos: 'GK', filled: gkCount >= 1 },
    { pos: 'DEF', filled: defCount >= 1 },
    { pos: 'DEF', filled: defCount >= 2 },
    { pos: 'MID', filled: midCount >= 1 },
    { pos: 'MID', filled: midCount >= 2 },
    { pos: 'ATT', filled: attCount >= 1 },
    { pos: 'ATT', filled: attCount >= 2 },
  ];

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--color-border-default)] bg-[var(--color-bg-hud)]/95 backdrop-blur-md px-4 py-3 text-[var(--color-text-primary)]"
      aria-label="Draft Status HUD"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        {/* Screen Reader Live Region announcing roster updates (budget announced by AnimatedBudget) */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {totalDrafted} of 7 roster slots filled.
        </div>

        {/* Budget Section */}
        <div className="flex flex-col">
          <span className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-widest text-[var(--color-text-muted)]">
            REMAINING BUDGET
          </span>
          <AnimatedBudget budget={budget} />
        </div>

        {/* Squad Composition Pips */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2 text-xs font-[family-name:var(--font-mono)] text-[var(--color-text-muted)]">
            <span className="font-bold text-[var(--color-text-primary)] tabular-nums">{totalDrafted} / 7</span>
            <span>PLAYERS DRAFTED</span>
          </div>

          <div className="flex items-center gap-1.5" role="group" aria-label="Roster Slots">
            {slotPips.map((pip, idx) => (
              <div
                key={idx}
                className={`flex h-6 w-9 items-center justify-center border text-[10px] font-[family-name:var(--font-mono)] font-bold transition-colors rounded-[var(--radius-xs)] ${
                  pip.filled
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-pips)] text-[var(--color-accent-primary)]'
                    : 'border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-faint)]'
                }`}
                title={`${pip.pos} slot ${pip.filled ? 'filled' : 'empty'}`}
              >
                {pip.pos}
              </div>
            ))}
          </div>
        </div>

        {/* Skips Remaining Section */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-widest text-[var(--color-text-muted)]">
            SKIPS AVAILABLE
          </span>
          <div className="flex items-center gap-1 font-[family-name:var(--font-mono)] text-base font-bold text-[var(--color-text-primary)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-[var(--radius-full)] border ${
                  i < skipsRemaining
                    ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]'
                    : 'border-[var(--color-border-default)] bg-transparent'
                }`}
              />
            ))}
            <span className="ml-1 text-xs text-[var(--color-text-muted)] tabular-nums">({skipsRemaining})</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
