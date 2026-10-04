'use client';

import React from 'react';

interface SparklineProps {
  /** Full yearly_values array */
  values: readonly number[];
  /** Current year (inclusive upper bound for visible data) */
  currentYear: number;
  /** Width of the SVG viewport */
  width?: number;
  /** Height of the SVG viewport */
  height?: number;
  className?: string;
}

/**
 * Compact sparkline showing yearly_values[0..currentYear] only.
 * - NO FUTURE LEAK: indices > currentYear are never read or rendered.
 * - The y-axis scale (min/max) is computed ONLY from visible values.
 * - The current point is marked with a filled circle.
 * - Uses design token colors via CSS variables.
 */
export const Sparkline: React.FC<SparklineProps> = ({
  values,
  currentYear,
  width = 80,
  height = 28,
  className = '',
}) => {
  // Clamp to available data; never read past currentYear
  const endIndex = Math.min(currentYear, values.length - 1);
  const visibleValues: number[] = [];
  for (let i = 0; i <= endIndex; i++) {
    visibleValues.push(values[i]);
  }

  if (visibleValues.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        role="img"
        aria-label="No data"
        data-testid="sparkline-svg"
      >
        {/* Empty sparkline */}
      </svg>
    );
  }

  // Single-point: just render a dot
  if (visibleValues.length === 1) {
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        role="img"
        aria-label={`Value: ${visibleValues[0]}`}
        data-testid="sparkline-svg"
      >
        <circle
          cx={cx}
          cy={cy}
          r={2.5}
          fill="var(--color-accent-primary)"
          data-testid="sparkline-current-dot"
        />
      </svg>
    );
  }

  // Compute scale from visible values ONLY
  const minVal = Math.min(...visibleValues);
  const maxVal = Math.max(...visibleValues);
  const range = maxVal - minVal || 1; // Avoid division by zero for flat lines

  const padX = 4;
  const padY = 4;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padY * 2;

  // Build points
  const points: Array<{ x: number; y: number }> = visibleValues.map((v, i) => ({
    x: padX + (i / (visibleValues.length - 1)) * plotWidth,
    y: padY + plotHeight - ((v - minVal) / range) * plotHeight,
  }));

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const lastPoint = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Sparkline from year 0 to year ${endIndex}`}
      data-testid="sparkline-svg"
    >
      <polyline
        points={polylinePoints}
        fill="none"
        stroke="var(--color-text-muted)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        data-testid="sparkline-line"
      />
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r={2.5}
        fill="var(--color-accent-primary)"
        data-testid="sparkline-current-dot"
      />
    </svg>
  );
};
