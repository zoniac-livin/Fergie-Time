/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import type { InvestmentResult, FlopResult, PlayerExitStatus } from '../../lib/game/selectors';
import { playerLowestValue } from '../../lib/game/selectors';
import { formatEuros } from '../../lib/ui/format';
import { SilhouetteAvatar } from '../reveal/SilhouetteAvatar';

interface BestInvestmentCardProps {
  result: InvestmentResult | null;
  exitStatus: PlayerExitStatus | null;
}

export const BestInvestmentCard: React.FC<BestInvestmentCardProps> = ({ result, exitStatus }) => {
  const [imgError, setImgError] = useState(false);

  if (!result) return null;

  const { player, roi, exitValue, profit } = result;
  const hasPhoto = Boolean(player.image_url) && !imgError;
  const roiPct = `${(roi * 100).toFixed(1)}%`;

  return (
    <div
      className="flex flex-col gap-3 p-4 border border-[var(--color-accent-border)] bg-[var(--color-bg-card)] rounded-[var(--radius-sm)] flex-1 shadow-[0_0_12px_var(--color-accent-glow)]"
      data-testid="best-investment-card"
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
        <span className="text-[10px] uppercase tracking-widest text-[var(--color-accent-primary)] font-bold">
          ★ BEST INVESTMENT
        </span>
        {exitStatus && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] tracking-wider"
            data-testid="best-exit-status"
          >
            {exitStatus.status === 'RETAINED' ? 'RETAINED' : `SOLD (Year ${exitStatus.year})`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {hasPhoto ? (
          <img
            src={player.image_url}
            alt={player.name}
            referrerPolicy="no-referrer"
            loading="eager"
            onError={() => setImgError(true)}
            className="w-12 h-12 shrink-0 object-cover rounded-[var(--radius-xs)] border border-[var(--color-border-default)] bg-[var(--color-bg-avatar)]"
          />
        ) : (
          <SilhouetteAvatar className="w-12 h-12" />
        )}

        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm text-[var(--color-text-primary)] truncate" data-testid="best-player-name">
            {player.name}
          </h3>
          <span className="inline-block border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-1.5 py-0.5 rounded-[var(--radius-xs)] text-[10px] font-bold text-[var(--color-accent-primary)] tracking-wider">
            {player.position}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-[family-name:var(--font-mono)] pt-1 border-t border-[var(--color-border-subtle)]">
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Draft Price</span>
          <span className="font-bold text-[var(--color-text-secondary)] tabular-nums" data-testid="best-draft-price">
            {formatEuros(player.draft_cost)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Exit Value</span>
          <span className="font-bold text-[var(--color-text-white)] tabular-nums" data-testid="best-exit-value">
            {formatEuros(exitValue)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">ROI</span>
          <span className="font-bold text-[var(--color-accent-primary)] tabular-nums" data-testid="best-roi">
            ▲ +{roiPct}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Profit</span>
          <span className="font-bold text-[var(--color-accent-primary)] tabular-nums" data-testid="best-profit">
            +{formatEuros(profit)}
          </span>
        </div>
      </div>
    </div>
  );
};

interface WorstFlopCardProps {
  result: FlopResult;
  exitStatus: PlayerExitStatus | null;
}

export const WorstFlopCard: React.FC<WorstFlopCardProps> = ({ result, exitStatus }) => {
  const [imgError, setImgError] = useState(false);

  if (result.status === 'NEUTRAL') {
    return (
      <div
        className="flex flex-col items-center justify-center p-6 border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-card)] rounded-[var(--radius-sm)] flex-1 text-center"
        data-testid="neutral-flop-card"
      >
        <span className="text-xs uppercase tracking-widest text-[var(--color-accent-primary)] font-bold mb-1">
          NO FLOPS
        </span>
        <p className="text-xs text-[var(--color-text-muted)]">
          No flops — every player held or gained value
        </p>
      </div>
    );
  }

  const { player, loss, exitValue } = result;
  const lowestVal = playerLowestValue(player);
  const hasPhoto = Boolean(player.image_url) && !imgError;

  return (
    <div
      className="flex flex-col gap-3 p-4 border border-[var(--color-error-border)] bg-[var(--color-bg-card)] rounded-[var(--radius-sm)] flex-1 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
      data-testid="worst-flop-card"
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
        <span className="text-[10px] uppercase tracking-widest text-[var(--color-warning)] font-bold">
          ▼ WORST FLOP
        </span>
        {exitStatus && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] tracking-wider"
            data-testid="flop-exit-status"
          >
            {exitStatus.status === 'RETAINED' ? 'RETAINED' : `SOLD (Year ${exitStatus.year})`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {hasPhoto ? (
          <img
            src={player.image_url}
            alt={player.name}
            referrerPolicy="no-referrer"
            loading="eager"
            onError={() => setImgError(true)}
            className="w-12 h-12 shrink-0 object-cover rounded-[var(--radius-xs)] border border-[var(--color-border-default)] bg-[var(--color-bg-avatar)]"
          />
        ) : (
          <SilhouetteAvatar className="w-12 h-12" />
        )}

        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm text-[var(--color-text-primary)] truncate" data-testid="flop-player-name">
            {player.name}
          </h3>
          <span className="inline-block border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-1.5 py-0.5 rounded-[var(--radius-xs)] text-[10px] font-bold text-[var(--color-text-secondary)] tracking-wider">
            {player.position}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-[family-name:var(--font-mono)] pt-1 border-t border-[var(--color-border-subtle)]">
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Draft Price</span>
          <span className="font-bold text-[var(--color-text-secondary)] tabular-nums" data-testid="flop-draft-price">
            {formatEuros(player.draft_cost)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Exit Value</span>
          <span className="font-bold text-[var(--color-text-white)] tabular-nums" data-testid="flop-exit-value">
            {formatEuros(exitValue)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Lowest Value</span>
          <span className="font-bold text-[var(--color-warning)] tabular-nums" data-testid="flop-lowest-value">
            {formatEuros(lowestVal)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase block">Net Loss</span>
          <span className="font-bold text-[var(--color-warning)] tabular-nums" data-testid="flop-net-loss">
            −{formatEuros(loss)}
          </span>
        </div>
      </div>
    </div>
  );
};
