'use client';

import React from 'react';
import { formatEuros } from '../../lib/ui/format';

interface ClubValuePanelProps {
  netWorth: number;
  budget: number;
  squadValue: number;
  onStartSimulation: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}

export const ClubValuePanel: React.FC<ClubValuePanelProps> = ({
  netWorth,
  budget,
  squadValue,
  onStartSimulation,
  buttonRef,
}) => {
  return (
    <div
      data-testid="club-value-panel"
      className="w-full max-w-xl border border-[var(--color-border-default)] bg-[var(--color-bg-card)] rounded-[var(--radius-sm)] p-5 sm:p-6 text-center select-none"
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <span className="h-2 w-2 rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] animate-pulse" />
        <span className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">
          YOUR CLUB VALUATION
        </span>
      </div>

      <div className="font-[family-name:var(--font-mono)] text-2xl sm:text-3xl font-black text-[var(--color-accent-primary)] tracking-tight tabular-nums mb-1">
        {formatEuros(netWorth)}
      </div>

      <p className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-muted)] tracking-wider mb-5">
        Valued at Year 0 prices
      </p>

      {/* Financial Breakdown */}
      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-6 text-left font-[family-name:var(--font-mono)] text-xs border-y border-[var(--color-border-subtle)] py-3">
        <div className="bg-[var(--color-bg-surface)] p-2.5 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-text-muted)] text-[11px] block uppercase">Remaining budget</span>
          <span className="text-[var(--color-text-primary)] font-bold text-sm tabular-nums">
            {formatEuros(budget)}
          </span>
        </div>
        <div className="bg-[var(--color-bg-surface)] p-2.5 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-text-muted)] text-[11px] block uppercase">Squad market value</span>
          <span className="text-[var(--color-text-primary)] font-bold text-sm tabular-nums">
            {formatEuros(squadValue)}
          </span>
        </div>
      </div>

      {/* Start Simulation Action */}
      <button
        ref={buttonRef}
        type="button"
        onClick={onStartSimulation}
        data-testid="start-simulation-btn"
        className="w-full sm:w-auto px-8 py-3 bg-[var(--color-accent-primary)] text-[var(--color-accent-contrast)] hover:bg-[var(--color-accent-hover)] font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-widest rounded-[var(--radius-xs)] cursor-pointer transition-colors shadow-[0_0_15px_var(--color-accent-glow)]"
      >
        START SIMULATION →
      </button>
    </div>
  );
};
