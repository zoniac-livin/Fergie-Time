/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { PlayerProfile } from '../../types/game';
import { deltaVsPreviousYear } from '../../lib/game/selectors';
import { formatEuros } from '../../lib/ui/format';
import { shouldResetConfirm } from '../../lib/ui/sim';
import { SilhouetteAvatar } from '../reveal/SilhouetteAvatar';
import { Sparkline } from './Sparkline';

interface SquadRowProps {
  player: PlayerProfile;
  currentYear: number;
  budget: number;
  onSell: (playerId: string) => void;
  /** Ref for the SELL button (used for focus management) */
  sellButtonRef?: React.RefObject<HTMLButtonElement | null>;
  /** Error message from a rejected sell attempt */
  sellError?: string | null;
}

type DeltaDirection = 'UP' | 'DOWN' | 'FLAT';

function classifyDelta(absoluteDelta: number): DeltaDirection {
  if (absoluteDelta > 0) return 'UP';
  if (absoluteDelta < 0) return 'DOWN';
  return 'FLAT';
}

/**
 * One row in the squad list during simulation.
 * - Shows photo, name, position, current value, previous value, delta.
 * - Delta direction is classified from raw delta (FLAT only when delta === 0).
 * - SELL is a two-step inline confirm flow.
 * - NO FUTURE LEAKS: only yearly_values[0..currentYear] are ever read.
 */
export const SquadRow: React.FC<SquadRowProps> = ({
  player,
  currentYear,
  budget,
  onSell,
  sellButtonRef,
  sellError,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // Close confirm when year changes
  const yearRef = useRef(currentYear);
  useEffect(() => {
    if (shouldResetConfirm(yearRef.current, currentYear)) {
      yearRef.current = currentYear;
      setConfirmOpen(false);
    }
  }, [currentYear]);

  const currentValue = player.yearly_values[currentYear];
  const previousValue = currentYear > 0 ? player.yearly_values[currentYear - 1] : null;
  const delta = deltaVsPreviousYear(player, currentYear);
  const direction = currentYear === 0 ? null : classifyDelta(delta.absolute);
  const salePrice = currentValue;
  const resultingCash = budget + salePrice;

  const hasValidPhoto = Boolean(player.image_url) && !imgError;

  // Focus the confirm button when confirm opens
  useEffect(() => {
    if (confirmOpen && confirmBtnRef.current) {
      confirmBtnRef.current.focus();
    }
  }, [confirmOpen]);

  const deltaDisplay = () => {
    if (currentYear === 0 || direction === null) {
      return (
        <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-muted)] tabular-nums">
          —
        </span>
      );
    }

    const absFormatted = formatEuros(Math.abs(delta.absolute));
    const pctFormatted = `${Math.abs(delta.percent * 100).toFixed(1)}%`;

    if (direction === 'UP') {
      return (
        <span
          className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-accent-primary)] tabular-nums"
          data-testid={`delta-${player.id}`}
        >
          <span aria-hidden="true">▲</span> +{absFormatted} (+{pctFormatted})
          <span className="sr-only"> UP</span>
        </span>
      );
    }

    if (direction === 'DOWN') {
      return (
        <span
          className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-warning)] tabular-nums"
          data-testid={`delta-${player.id}`}
        >
          <span aria-hidden="true">▼</span> −{absFormatted} (−{pctFormatted})
          <span className="sr-only"> DOWN</span>
        </span>
      );
    }

    // FLAT
    return (
      <span
        className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-muted)] tabular-nums"
        data-testid={`delta-${player.id}`}
      >
        <span aria-hidden="true">■</span> {formatEuros(0)}
        <span className="sr-only"> FLAT</span>
      </span>
    );
  };

  return (
    <div
      data-testid={`squad-row-${player.id}`}
      className="flex flex-col gap-2 p-3 border border-[var(--color-border-default)] bg-[var(--color-bg-card)] rounded-[var(--radius-sm)]"
    >
      {/* Top: Player info */}
      <div className="flex items-center gap-3">
        {/* Photo */}
        {hasValidPhoto ? (
          <img
            src={player.image_url}
            alt={player.name}
            referrerPolicy="no-referrer"
            loading="eager"
            onError={() => setImgError(true)}
            className="w-10 h-10 shrink-0 object-cover rounded-[var(--radius-xs)] border border-[var(--color-border-default)] bg-[var(--color-bg-avatar)]"
          />
        ) : (
          <SilhouetteAvatar className="w-10 h-10" />
        )}

        {/* Name + Position */}
        <div className="min-w-0 flex-1">
          <h3 className="font-[family-name:var(--font-mono)] text-sm font-bold text-[var(--color-text-primary)] truncate">
            {player.name}
          </h3>
          <div className="flex items-center gap-1.5">
            <span className="border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-xs)] font-[family-name:var(--font-mono)] text-[10px] font-bold text-[var(--color-accent-primary)] tracking-wider">
              {player.position}
            </span>
            <span className="px-1.5 py-0.5 rounded-[var(--radius-xs)] font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
              HOLDING
            </span>
          </div>
        </div>

        {/* Sparkline */}
        <Sparkline
          values={player.yearly_values}
          currentYear={currentYear}
          width={72}
          height={24}
          className="hidden sm:block shrink-0"
        />
      </div>

      {/* Values + Delta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-[family-name:var(--font-mono)]">
        <div className="text-xs text-[var(--color-text-secondary)]">
          CURRENT{' '}
          <span className="font-bold text-[var(--color-text-white)] tabular-nums" data-testid={`current-value-${player.id}`}>
            {formatEuros(currentValue)}
          </span>
        </div>
        {previousValue !== null && (
          <div className="text-xs text-[var(--color-text-muted)]">
            PREV{' '}
            <span className="tabular-nums" data-testid={`prev-value-${player.id}`}>
              {formatEuros(previousValue)}
            </span>
          </div>
        )}
        {deltaDisplay()}
      </div>

      {/* SELL flow */}
      <div className="flex items-center gap-2 mt-1">
        {!confirmOpen ? (
          <button
            ref={sellButtonRef}
            type="button"
            onClick={() => setConfirmOpen(true)}
            data-testid={`sell-btn-${player.id}`}
            className="px-3 py-1.5 border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] font-[family-name:var(--font-mono)] text-xs uppercase tracking-wider rounded-[var(--radius-xs)] hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors min-h-[44px] min-w-[44px]"
          >
            SELL
          </button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap" data-testid={`sell-confirm-${player.id}`}>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={() => {
                onSell(player.id);
                setConfirmOpen(false);
              }}
              data-testid={`sell-confirm-btn-${player.id}`}
              className="px-3 py-1.5 border border-[var(--color-warning)] bg-[var(--color-bg-elevated)] text-[var(--color-warning)] font-[family-name:var(--font-mono)] text-xs uppercase tracking-wider rounded-[var(--radius-xs)] hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors min-h-[44px]"
            >
              CONFIRM SELL {formatEuros(salePrice)} — cash becomes {formatEuros(resultingCash)}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              data-testid={`sell-cancel-btn-${player.id}`}
              className="px-3 py-1.5 border border-[var(--color-border-default)] bg-[var(--color-bg-card)] text-[var(--color-text-muted)] font-[family-name:var(--font-mono)] text-xs uppercase tracking-wider rounded-[var(--radius-xs)] hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors min-h-[44px]"
            >
              CANCEL
            </button>
          </div>
        )}
        {sellError && (
          <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-error-text-muted)]" data-testid={`sell-error-${player.id}`}>
            {sellError}
          </span>
        )}
      </div>
    </div>
  );
};
