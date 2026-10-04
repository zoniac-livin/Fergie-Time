/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import type { PlayerProfile } from '../../types/game';
import type { PlayerExitStatus } from '../../lib/game/selectors';
import {
  playerPeakValue,
  playerLowestValue,
} from '../../lib/game/selectors';
import { formatEuros } from '../../lib/ui/format';
import { SilhouetteAvatar } from '../reveal/SilhouetteAvatar';

interface PlayerHistoryCardProps {
  player: PlayerProfile;
  exitStatus: PlayerExitStatus;
  exitValue: number;
}

/**
 * Historical card for one drafted player.
 * - Shows draft price, Year 0 value, peak, lowest, exit value, and net profit/loss.
 * - Label: RETAINED or SOLD (Year N).
 * - "Held to Year 10 it would have been €X" is shown ONLY when sold early (year < 10).
 * - Hidden if retained or sold at Year 10.
 */
export const PlayerHistoryCard: React.FC<PlayerHistoryCardProps> = ({
  player,
  exitStatus,
  exitValue,
}) => {
  const [imgError, setImgError] = useState(false);

  const hasPhoto = Boolean(player.image_url) && !imgError;
  const year0Val = player.yearly_values[0];
  const peakVal = playerPeakValue(player);
  const lowestVal = playerLowestValue(player);
  const netProfit = exitValue - player.draft_cost;
  const isSoldEarly = exitStatus.status === 'SOLD' && exitStatus.year < 10;
  const year10Val = player.yearly_values[10];

  return (
    <div
      className="flex flex-col gap-3 p-4 border border-[var(--color-border-default)] bg-[var(--color-bg-card)] rounded-[var(--radius-sm)]"
      data-testid={`player-history-${player.id}`}
    >
      {/* Header: Photo + Name + Position + Exit Status Badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {hasPhoto ? (
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

          <div className="min-w-0">
            <h4 className="font-bold text-sm text-[var(--color-text-primary)] truncate" data-testid={`history-name-${player.id}`}>
              {player.name}
            </h4>
            <span className="inline-block border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-xs)] text-[10px] font-bold text-[var(--color-accent-primary)] tracking-wider">
              {player.position}
            </span>
          </div>
        </div>

        {/* Exit Status Badge */}
        <span
          className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-[var(--radius-xs)] uppercase tracking-wider ${
            exitStatus.status === 'RETAINED'
              ? 'border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-primary)]'
              : 'border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]'
          }`}
          data-testid={`history-status-${player.id}`}
        >
          {exitStatus.status === 'RETAINED' ? 'RETAINED' : `SOLD (Year ${exitStatus.year})`}
        </span>
      </div>

      {/* Financial Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-[family-name:var(--font-mono)] pt-2 border-t border-[var(--color-border-subtle)]">
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Draft Price</span>
          <span className="tabular-nums text-[var(--color-text-secondary)]" data-testid={`history-draft-${player.id}`}>
            {formatEuros(player.draft_cost)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Year 0 Val</span>
          <span className="tabular-nums text-[var(--color-text-secondary)]" data-testid={`history-yr0-${player.id}`}>
            {formatEuros(year0Val)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Peak Val</span>
          <span className="tabular-nums text-[var(--color-text-white)]" data-testid={`history-peak-${player.id}`}>
            {formatEuros(peakVal)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Lowest Val</span>
          <span className="tabular-nums text-[var(--color-text-muted)]" data-testid={`history-lowest-${player.id}`}>
            {formatEuros(lowestVal)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Exit Val</span>
          <span className="tabular-nums font-bold text-[var(--color-text-white)]" data-testid={`history-exit-${player.id}`}>
            {formatEuros(exitValue)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Net Profit/Loss</span>
          <span
            className={`tabular-nums font-bold ${
              netProfit > 0
                ? 'text-[var(--color-accent-primary)]'
                : netProfit < 0
                  ? 'text-[var(--color-warning)]'
                  : 'text-[var(--color-text-muted)]'
            }`}
            data-testid={`history-profit-${player.id}`}
          >
            {netProfit > 0 && `▲ +${formatEuros(netProfit)} UP`}
            {netProfit < 0 && `▼ −${formatEuros(Math.abs(netProfit))} DOWN`}
            {netProfit === 0 && `■ ${formatEuros(0)} FLAT`}
          </span>
        </div>
      </div>

      {/* Held to Year 10 line — ONLY rendered if sold early (< Year 10) */}
      {isSoldEarly && (
        <div
          className="text-xs text-[var(--color-text-muted)] font-[family-name:var(--font-mono)] pt-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2 rounded-[var(--radius-xs)]"
          data-testid={`history-held-to-10-${player.id}`}
        >
          <span>Held to Year 10 it would have been </span>
          <span className="font-bold text-[var(--color-text-secondary)] tabular-nums">
            {formatEuros(year10Val)}
          </span>
        </div>
      )}
    </div>
  );
};
