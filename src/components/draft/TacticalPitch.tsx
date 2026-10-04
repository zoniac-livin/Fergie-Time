'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { formatEuros } from '../../lib/ui/format';
import type { Roster, Position, PlayerProfile } from '../../types/game';

interface TacticalPitchProps {
  roster?: Roster;
  className?: string;
}

interface SlotConfig {
  key: string;
  position: Position;
  positionLabel: string;
  slotIndex: number;
}

const FORMATION_SLOTS: { row: string; slots: SlotConfig[] }[] = [
  {
    row: 'ATT',
    slots: [
      { key: 'ATT-0', position: 'ATT', positionLabel: 'Attacker', slotIndex: 0 },
      { key: 'ATT-1', position: 'ATT', positionLabel: 'Attacker', slotIndex: 1 },
    ],
  },
  {
    row: 'MID',
    slots: [
      { key: 'MID-0', position: 'MID', positionLabel: 'Midfielder', slotIndex: 0 },
      { key: 'MID-1', position: 'MID', positionLabel: 'Midfielder', slotIndex: 1 },
    ],
  },
  {
    row: 'DEF',
    slots: [
      { key: 'DEF-0', position: 'DEF', positionLabel: 'Defender', slotIndex: 0 },
      { key: 'DEF-1', position: 'DEF', positionLabel: 'Defender', slotIndex: 1 },
    ],
  },
  {
    row: 'GK',
    slots: [
      { key: 'GK-0', position: 'GK', positionLabel: 'Goalkeeper', slotIndex: 0 },
    ],
  },
];

export const TacticalPitch: React.FC<TacticalPitchProps> = ({ roster: rosterProp, className = '' }) => {
  const storeRoster = useGameStore((s) => s.roster);
  const roster = rosterProp ?? storeRoster;
  const prefersReduced = useReducedMotion();

  const renderSlot = (slot: SlotConfig) => {
    const player: PlayerProfile | undefined = roster[slot.position]?.[slot.slotIndex];
    const isFilled = Boolean(player);

    const ariaLabel = isFilled && player
      ? `${slot.positionLabel} slot ${slot.slotIndex + 1} filled, cost ${formatEuros(player.draft_cost)}`
      : `${slot.positionLabel} slot ${slot.slotIndex + 1} empty`;

    return (
      <motion.div
        key={`${slot.key}-${isFilled ? 'filled' : 'empty'}`}
        data-slot-key={slot.key}
        aria-label={ariaLabel}
        className={`relative flex flex-col items-center justify-center w-28 sm:w-32 min-h-[64px] sm:min-h-[72px] px-2 py-1.5 rounded-[var(--radius-xs)] select-none ${
          isFilled && player
            ? 'border border-[var(--color-accent-primary)] bg-[var(--color-accent-subtle)] shadow-[0_0_12px_var(--color-accent-glow)]'
            : 'border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface)]/70 backdrop-blur-xs'
        }`}
        initial={isFilled && !prefersReduced ? { opacity: 0, scale: 0.85 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={prefersReduced ? { duration: 0 } : { duration: 0.35, ease: 'easeOut' }}
      >
        {isFilled && player ? (
          <>
            {/* Position badge & Age - strictly anonymous */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="border border-[var(--color-accent-border)] bg-[var(--color-accent-border)] px-1.5 py-0.2 rounded-[var(--radius-xs)] font-[family-name:var(--font-mono)] text-[10px] font-bold text-[var(--color-accent-primary)] tracking-wider">
                {slot.position}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-text-secondary)]">
                AGE {player.age_at_draft}
              </span>
            </div>

            {/* Cost ONLY - zero identifying info */}
            <span className="font-[family-name:var(--font-mono)] text-xs sm:text-sm font-bold text-[var(--color-text-white)] tabular-nums">
              {formatEuros(player.draft_cost)}
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <span className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-wider text-[var(--color-text-faint)]">
              {slot.position}
            </span>
            <span className="font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] opacity-60">
              SLOT {slot.slotIndex + 1}
            </span>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <div
      className={`relative w-full max-w-sm sm:max-w-md border border-[var(--color-border-default)] bg-[var(--color-bg-card)] rounded-[var(--radius-sm)] p-4 sm:p-5 overflow-hidden ${className}`}
      aria-label="Tactical Pitch Formation 1-2-2-2"
    >
      {/* Pitch Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-2.5 mb-3 text-xs font-[family-name:var(--font-mono)]">
        <span className="flex items-center gap-2 text-[var(--color-text-muted)] uppercase tracking-wider text-[11px]">
          <span className="h-1.5 w-1.5 rounded-[var(--radius-full)] bg-[var(--color-accent-primary)]" />
          TACTICAL FORMATION
        </span>
        <span className="border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-2 py-0.5 rounded-[var(--radius-xs)] text-[var(--color-accent-primary)] font-bold text-[10px] tracking-widest">
          1-2-2-2
        </span>
      </div>

      {/* Pitch Field Canvas with SVG Geometry */}
      <div className="relative w-full aspect-[3/4] flex flex-col justify-between py-4 px-2">
        {/* Subtle Pitch Geometry Overlay */}
        <svg
          className="absolute inset-0 h-full w-full pointer-events-none opacity-20"
          viewBox="0 0 360 480"
          fill="none"
          stroke="var(--color-border-default)"
          strokeWidth="1.2"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Outer Boundary */}
          <rect x="12" y="12" width="336" height="456" rx="4" />
          
          {/* Halfway Line */}
          <line x1="12" y1="240" x2="348" y2="240" />

          {/* Center Circle & Spot */}
          <circle cx="180" cy="240" r="48" />
          <circle cx="180" cy="240" r="3" fill="var(--color-border-default)" />

          {/* Attacking Penalty Box (Top) */}
          <rect x="80" y="12" width="200" height="74" />
          <rect x="126" y="12" width="108" height="26" />
          <path d="M 136 86 A 44 44 0 0 0 224 86" />

          {/* Defensive Penalty Box (Bottom / GK) */}
          <rect x="80" y="394" width="200" height="74" />
          <rect x="126" y="442" width="108" height="26" />
          <path d="M 136 394 A 44 44 0 0 1 224 394" />

          {/* Corner Arcs */}
          <path d="M 12 28 A 16 16 0 0 0 28 12" />
          <path d="M 332 12 A 16 16 0 0 0 348 28" />
          <path d="M 12 452 A 16 16 0 0 1 28 468" />
          <path d="M 332 468 A 16 16 0 0 1 348 452" />
        </svg>

        {/* Tactical Rows (Top: ATT -> MID -> DEF -> GK: Bottom) */}
        {FORMATION_SLOTS.map((line) => (
          <div
            key={line.row}
            className={`relative z-10 flex items-center justify-around w-full ${
              line.slots.length === 1 ? 'justify-center' : 'justify-around'
            }`}
          >
            {line.slots.map((slot) => renderSlot(slot))}
          </div>
        ))}
      </div>
    </div>
  );
};
