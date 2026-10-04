/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import type { PlayerProfile } from '../../types/game';
import { formatEuros } from '../../lib/ui/format';
import { SilhouetteAvatar } from './SilhouetteAvatar';

interface RevealCardProps {
  player: PlayerProfile;
  index: number;
  isRevealed: boolean;
  isTarget?: boolean;
}

export const RevealCard: React.FC<RevealCardProps> = ({
  player,
  index,
  isRevealed,
  isTarget = false,
}) => {
  const [imgError, setImgError] = useState(false);

  // CRITICAL: Face-down cards must render ZERO identity data in the DOM.
  // No name, no image_url, no id, no draft_season, no <img> element, no preloads.
  // Only position, cost, and card index are permitted.
  if (!isRevealed) {
    return (
      <div
        data-testid={`reveal-card-${index}`}
        data-card-state="face-down"
        aria-label={`Card ${index + 1} face down: ${player.position}, cost ${formatEuros(player.draft_cost)}`}
        className={`relative flex flex-col items-center justify-center p-4 border rounded-[var(--radius-sm)] min-h-[250px] text-center select-none transition-colors ${
          isTarget
            ? 'border-[var(--color-accent-primary)] bg-[var(--color-bg-elevated)] ring-1 ring-[var(--color-accent-primary)] shadow-[0_0_12px_var(--color-accent-glow)]'
            : 'border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-card)]'
        }`}
      >
        {/* Mystery card badge */}
        <div className="h-10 w-10 rounded-[var(--radius-full)] border border-[var(--color-border-muted)] bg-[var(--color-bg-surface)] flex items-center justify-center mb-3 text-[var(--color-text-muted)] font-[family-name:var(--font-mono)] text-xs font-bold">
          #{index + 1}
        </div>

        {/* Position badge */}
        <div className="border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-2 py-0.5 rounded-[var(--radius-xs)] font-[family-name:var(--font-mono)] text-xs font-bold text-[var(--color-accent-primary)] tracking-wider mb-2">
          {player.position}
        </div>

        {/* Cost */}
        <div className="font-[family-name:var(--font-mono)] text-sm font-bold text-[var(--color-text-white)] tabular-nums mb-2">
          {formatEuros(player.draft_cost)}
        </div>

        <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          LOCKED CANDIDATE
        </span>
      </div>
    );
  }

  // Revealed card:
  // Shows name, photo, position, age, cost, and draft-season stats.
  // Strictly NEVER shows id or draft_season year, and NEVER clubs/nations/badges.
  const hasValidPhoto = Boolean(player.image_url) && !imgError;

  return (
    <div
      data-testid={`reveal-card-${index}`}
      data-card-state="revealed"
      aria-label={`Card ${index + 1} revealed: ${player.name}, ${player.position}, cost ${formatEuros(player.draft_cost)}`}
      className={`relative flex flex-col p-4 border rounded-[var(--radius-sm)] min-h-[250px] select-none bg-[var(--color-bg-card)] transition-colors ${
        isTarget
          ? 'border-[var(--color-accent-primary)] shadow-[0_0_16px_var(--color-accent-glow)] ring-1 ring-[var(--color-accent-primary)]'
          : 'border-[var(--color-border-default)] hover:border-[var(--color-border-focus)]'
      }`}
    >
      {/* Top Header: Position, Age, Cost */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-2 py-0.5 rounded-[var(--radius-xs)] font-[family-name:var(--font-mono)] text-xs font-bold text-[var(--color-accent-primary)] tracking-wider">
            {player.position}
          </span>
          <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-secondary)] font-medium">
            AGE {player.age_at_draft}
          </span>
        </div>
        <span className="font-[family-name:var(--font-mono)] text-xs font-bold text-[var(--color-accent-primary)] tabular-nums">
          {formatEuros(player.draft_cost)}
        </span>
      </div>

      {/* Identity: Photo & Name ONLY (No club, nation, or badge) */}
      <div className="flex items-center gap-3 mb-3">
        {hasValidPhoto ? (
          <img
            src={player.image_url}
            alt={player.name}
            referrerPolicy="no-referrer"
            loading="eager"
            onError={() => setImgError(true)}
            className="w-14 h-14 shrink-0 object-cover rounded-[var(--radius-xs)] border border-[var(--color-border-default)] bg-[var(--color-bg-avatar)]"
          />
        ) : (
          <SilhouetteAvatar className="w-14 h-14" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-[family-name:var(--font-mono)] text-sm font-bold text-[var(--color-text-primary)] truncate">
            {player.name}
          </h3>
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] block">
            DRAFT STATS
          </span>
        </div>
      </div>

      {/* Draft-season stats breakdown (No draft_season year is shown) */}
      <div className="grid grid-cols-3 gap-1.5 text-center mt-auto border-t border-[var(--color-border-subtle)] pt-2.5 font-[family-name:var(--font-mono)] text-[10px]">
        <div className="bg-[var(--color-bg-surface)] p-1 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-text-muted)] block text-[9px] uppercase">APPS</span>
          <span className="font-bold text-[var(--color-text-primary)] tabular-nums">{player.draft_stats.appearances}</span>
        </div>
        <div className="bg-[var(--color-bg-surface)] p-1 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-text-muted)] block text-[9px] uppercase">MINS</span>
          <span className="font-bold text-[var(--color-text-primary)] tabular-nums">{player.draft_stats.minutes}</span>
        </div>
        <div className="bg-[var(--color-bg-surface)] p-1 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-text-muted)] block text-[9px] uppercase">GOALS</span>
          <span className="font-bold text-[var(--color-text-primary)] tabular-nums">{player.draft_stats.goals}</span>
        </div>
        <div className="bg-[var(--color-bg-surface)] p-1 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-text-muted)] block text-[9px] uppercase">AST</span>
          <span className="font-bold text-[var(--color-text-primary)] tabular-nums">{player.draft_stats.assists}</span>
        </div>
        <div className="bg-[var(--color-bg-surface)] p-1 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-text-muted)] block text-[9px] uppercase">YC</span>
          <span className="font-bold text-[var(--color-warning)] tabular-nums">{player.draft_stats.yellow_cards}</span>
        </div>
        <div className="bg-[var(--color-bg-surface)] p-1 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-text-muted)] block text-[9px] uppercase">RC</span>
          <span className="font-bold text-[var(--color-danger)] tabular-nums">{player.draft_stats.red_cards}</span>
        </div>
      </div>
    </div>
  );
};
