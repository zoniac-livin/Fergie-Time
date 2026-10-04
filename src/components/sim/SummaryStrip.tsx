import React from 'react';
import { formatEuros } from '../../lib/ui/format';

export interface SummaryStripProps {
  clubNetWorth: number;
  budget: number;
  totalSquadValue: number;
  currentYear: number;
  netWorthDelta: number | null;
}

/**
 * Summary financial strip for the simulation page.
 * Displays Club Net Worth, Cash, Squad Value, and year-over-year delta.
 * Pure presentational component with no internal state or mutation.
 */
export const SummaryStrip: React.FC<SummaryStripProps> = ({
  clubNetWorth,
  budget,
  totalSquadValue,
  currentYear,
  netWorthDelta,
}) => {
  return (
    <section
      className="w-full max-w-5xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6"
      aria-label="Financial summary"
      data-testid="summary-strip"
    >
      <div className="border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-3 rounded-[var(--radius-sm)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
          CLUB NET WORTH
        </div>
        <div
          className="text-sm sm:text-base font-bold text-[var(--color-text-white)] tabular-nums"
          data-testid="summary-net-worth"
        >
          {formatEuros(clubNetWorth)}
        </div>
      </div>

      <div className="border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-3 rounded-[var(--radius-sm)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
          CASH
        </div>
        <div
          className="text-sm sm:text-base font-bold text-[var(--color-text-white)] tabular-nums"
          data-testid="summary-cash"
        >
          {formatEuros(budget)}
        </div>
      </div>

      <div className="border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-3 rounded-[var(--radius-sm)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
          SQUAD VALUE
        </div>
        <div
          className="text-sm sm:text-base font-bold text-[var(--color-text-white)] tabular-nums"
          data-testid="summary-squad-value"
        >
          {formatEuros(totalSquadValue)}
        </div>
      </div>

      {netWorthDelta !== null && (
        <div className="border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-3 rounded-[var(--radius-sm)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            VS YEAR {String(currentYear - 1).padStart(2, '0')}
          </div>
          <div
            className={`text-sm sm:text-base font-bold tabular-nums ${
              netWorthDelta > 0
                ? 'text-[var(--color-accent-primary)]'
                : netWorthDelta < 0
                  ? 'text-[var(--color-warning)]'
                  : 'text-[var(--color-text-muted)]'
            }`}
            data-testid="summary-nw-delta"
          >
            {netWorthDelta > 0 && '▲ +'}
            {netWorthDelta < 0 && '▼ '}
            {netWorthDelta === 0 && '■ '}
            {netWorthDelta < 0
              ? `−${formatEuros(Math.abs(netWorthDelta))}`
              : formatEuros(Math.abs(netWorthDelta))}
          </div>
        </div>
      )}
    </section>
  );
};
