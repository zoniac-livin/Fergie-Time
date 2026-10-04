import React from 'react';
import type { ActionErrorCode } from '../../types/game';
import { formatActionError } from '../../lib/ui/format';

interface DraftActionsProps {
  onDraft: () => void;
  onSkip: () => void;
  skipsRemaining: number;
  disabled?: boolean;
  lastError: ActionErrorCode | null;
  onClearError?: () => void;
}

export const DraftActions: React.FC<DraftActionsProps> = ({
  onDraft,
  onSkip,
  skipsRemaining,
  disabled = false,
  lastError,
}) => {
  const errorInfo = lastError ? formatActionError(lastError) : null;

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-sm">
      {/* Accessible Rejection Feedback Live Region */}
      {errorInfo && (
        <div
          role="alert"
          aria-live="assertive"
          className="w-full border border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-3 text-[var(--color-error-text)] rounded-[var(--radius-xs)]"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-[family-name:var(--font-sans)]">
              <span className="font-semibold block">{errorInfo.message}</span>
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-error-text-muted)] block mt-0.5 uppercase tracking-wider">
                CODE: {errorInfo.code}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Button Controls */}
      <div className="flex w-full gap-3">
        {/* Skip Button */}
        <button
          type="button"
          onClick={onSkip}
          disabled={disabled || skipsRemaining <= 0}
          className={`flex-1 min-h-[48px] border font-[family-name:var(--font-mono)] text-xs uppercase tracking-wider transition-all rounded-[var(--radius-xs)] focus:outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-page)] ${
            skipsRemaining > 0 && !disabled
              ? 'border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] hover:border-[var(--color-border-focus)] hover:bg-[var(--color-bg-elevated)] active:scale-[0.98]'
              : 'border-[var(--color-border-muted)] bg-[var(--color-bg-hud)] text-[var(--color-text-disabled)] cursor-not-allowed opacity-50'
          }`}
          aria-label={`Skip candidate (${skipsRemaining} skips remaining)`}
        >
          SKIP ({skipsRemaining})
        </button>

        {/* Draft Button */}
        <button
          type="button"
          onClick={onDraft}
          disabled={disabled}
          className={`flex-[2] min-h-[48px] border font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider transition-all rounded-[var(--radius-xs)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-page)] ${
            !disabled
              ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)] text-[var(--color-accent-contrast)] shadow-[0_0_20px_var(--color-accent-glow)] hover:bg-[var(--color-accent-hover)] active:scale-[0.98]'
              : 'border-[var(--color-border-muted)] bg-[var(--color-bg-hud)] text-[var(--color-text-disabled)] cursor-not-allowed opacity-50'
          }`}
        >
          DRAFT PLAYER
        </button>
      </div>
    </div>
  );
};
