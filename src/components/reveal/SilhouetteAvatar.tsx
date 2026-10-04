import React from 'react';

interface SilhouetteAvatarProps {
  className?: string;
}

export const SilhouetteAvatar: React.FC<SilhouetteAvatarProps> = ({ className = 'w-14 h-14' }) => {
  return (
    <div
      data-testid="silhouette-fallback"
      className={`flex items-center justify-center bg-[var(--color-bg-avatar)] text-[var(--color-text-muted)] border border-[var(--color-border-subtle)] rounded-[var(--radius-xs)] shrink-0 ${className}`}
      aria-label="Player photo placeholder"
    >
      <svg
        className="w-2/3 h-2/3 opacity-40"
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    </div>
  );
};
