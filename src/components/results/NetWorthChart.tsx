'use client';

import React from 'react';
import { formatEuros } from '../../lib/ui/format';
import { getNetWorthAnnotations } from '../../lib/game/selectors';

export interface NetWorthChartProps {
  /** Array of net worth from Year 0 to Year 10 (length 11) */
  yearlyNetWorth: readonly number[];
  /** Array of years where SELL transactions occurred */
  sellYears: readonly number[];
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Hand-built SVG line chart showing club net worth progression from Year 0 to Year 10.
 * - Flat line handling (range === 0): centers line with zero NaNs.
 * - Year 0 draft marker and Year 10 final net worth marker.
 * - Distinct markers for every year a SELL occurred.
 * - Annotations for largest single-year gain and loss (only when non-zero).
 * - Accessible text alternative (<details>/<table>) and aria-label summary.
 */
export const NetWorthChart: React.FC<NetWorthChartProps> = ({
  yearlyNetWorth,
  sellYears,
  width = 680,
  height = 260,
  className = '',
}) => {
  const padLeft = 40;
  const padRight = 40;
  const padTop = 32;
  const padBottom = 36;

  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const numPoints = yearlyNetWorth.length;
  const minVal = numPoints > 0 ? Math.min(...yearlyNetWorth) : 0;
  const maxVal = numPoints > 0 ? Math.max(...yearlyNetWorth) : 0;
  const range = maxVal - minVal;

  // Build points safely (zero division protection prevents NaN)
  const points = yearlyNetWorth.map((val, idx) => {
    const x = padLeft + (idx / Math.max(1, numPoints - 1)) * plotWidth;
    const y =
      range === 0
        ? padTop + plotHeight / 2
        : padTop + plotHeight - ((val - minVal) / range) * plotHeight;
    return { x, y, val, year: idx };
  });

  const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Annotations
  const { largestGain, largestLoss } = getNetWorthAnnotations(yearlyNetWorth);

  const sellYearSet = new Set(sellYears);
  const finalPoint = points[points.length - 1];
  const draftPoint = points[0];

  const ariaSummary = `Club net worth progression from Year 0 (${formatEuros(
    yearlyNetWorth[0] ?? 0
  )}) to Year 10 (${formatEuros(yearlyNetWorth[10] ?? 0)}).`;

  return (
    <div className={`w-full flex flex-col gap-2 ${className}`} data-testid="net-worth-chart-container">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none font-[family-name:var(--font-mono)]"
        role="img"
        aria-label={ariaSummary}
        data-testid="net-worth-chart-svg"
      >
        {/* Horizontal gridlines */}
        <line
          x1={padLeft}
          y1={padTop}
          x2={width - padRight}
          y2={padTop}
          stroke="var(--color-border-subtle)"
          strokeDasharray="2 3"
          strokeWidth={1}
        />
        <line
          x1={padLeft}
          y1={padTop + plotHeight / 2}
          x2={width - padRight}
          y2={padTop + plotHeight / 2}
          stroke="var(--color-border-subtle)"
          strokeDasharray="2 3"
          strokeWidth={1}
        />
        <line
          x1={padLeft}
          y1={padTop + plotHeight}
          x2={width - padRight}
          y2={padTop + plotHeight}
          stroke="var(--color-border-subtle)"
          strokeWidth={1}
        />

        {/* Year tick marks and labels */}
        {points.map((p) => (
          <g key={`tick-${p.year}`}>
            <line
              x1={p.x}
              y1={padTop + plotHeight}
              x2={p.x}
              y2={padTop + plotHeight + 5}
              stroke="var(--color-border-default)"
              strokeWidth={1}
            />
            <text
              x={p.x}
              y={padTop + plotHeight + 18}
              textAnchor="middle"
              fill="var(--color-text-muted)"
              fontSize={10}
              className="tabular-nums"
              data-testid={`chart-tick-year-${p.year}`}
            >
              Y{p.year}
            </text>
          </g>
        ))}

        {/* The line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="var(--color-accent-primary)"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          data-testid="chart-polyline"
        />

        {/* Year 0 Draft Marker */}
        {draftPoint && (
          <g data-testid="chart-draft-marker">
            <circle
              cx={draftPoint.x}
              cy={draftPoint.y}
              r={4}
              fill="var(--color-bg-page)"
              stroke="var(--color-accent-primary)"
              strokeWidth={2}
            />
            <text
              x={draftPoint.x}
              y={draftPoint.y - 8}
              textAnchor="start"
              fill="var(--color-text-muted)"
              fontSize={9}
              className="hidden sm:inline"
            >
              DRAFT
            </text>
          </g>
        )}

        {/* SELL Markers */}
        {points
          .filter((p) => sellYearSet.has(p.year))
          .map((p) => (
            <g key={`sell-marker-${p.year}`} data-testid={`chart-sell-marker-${p.year}`}>
              {/* Diamond marker */}
              <polygon
                points={`${p.x},${p.y - 5} ${p.x + 5},${p.y} ${p.x},${p.y + 5} ${p.x - 5},${p.y}`}
                fill="var(--color-warning)"
                stroke="var(--color-bg-page)"
                strokeWidth={1.5}
              />
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                fill="var(--color-warning)"
                fontSize={9}
                fontWeight="bold"
                className="hidden sm:inline"
              >
                SELL
              </text>
            </g>
          ))}

        {/* Year 10 Final Marker */}
        {finalPoint && (
          <g data-testid="chart-final-marker">
            <circle
              cx={finalPoint.x}
              cy={finalPoint.y}
              r={5}
              fill="var(--color-accent-primary)"
              stroke="var(--color-bg-page)"
              strokeWidth={2}
            />
            {/* Final Net Worth value label at Year 10 point */}
            <text
              x={finalPoint.x}
              y={finalPoint.y - 10}
              textAnchor="end"
              fill="var(--color-text-white)"
              fontSize={10}
              fontWeight="bold"
              className="tabular-nums"
              data-testid="chart-year10-value"
            >
              {formatEuros(finalPoint.val)}
            </text>
          </g>
        )}

        {/* Largest Single-Year Gain Annotation (only if non-zero) */}
        {largestGain && points[largestGain.year] && (
          <g
            data-testid="chart-annotation-gain"
            className="hidden sm:inline"
          >
            <rect
              x={points[largestGain.year].x - 42}
              y={points[largestGain.year].y + 12}
              width={84}
              height={16}
              rx={2}
              fill="var(--color-bg-elevated)"
              stroke="var(--color-accent-border)"
              strokeWidth={1}
            />
            <text
              x={points[largestGain.year].x}
              y={points[largestGain.year].y + 24}
              textAnchor="middle"
              fill="var(--color-accent-primary)"
              fontSize={8.5}
              fontWeight="bold"
              className="tabular-nums"
            >
              ▲ +{formatEuros(largestGain.change)}
            </text>
          </g>
        )}

        {/* Largest Single-Year Loss Annotation (only if non-zero) */}
        {largestLoss && points[largestLoss.year] && (
          <g
            data-testid="chart-annotation-loss"
            className="hidden sm:inline"
          >
            <rect
              x={points[largestLoss.year].x - 42}
              y={points[largestLoss.year].y + 12}
              width={84}
              height={16}
              rx={2}
              fill="var(--color-bg-elevated)"
              stroke="var(--color-error-border)"
              strokeWidth={1}
            />
            <text
              x={points[largestLoss.year].x}
              y={points[largestLoss.year].y + 24}
              textAnchor="middle"
              fill="var(--color-warning)"
              fontSize={8.5}
              fontWeight="bold"
              className="tabular-nums"
            >
              ▼ −{formatEuros(Math.abs(largestLoss.change))}
            </text>
          </g>
        )}
      </svg>

      {/* Accessible Text Alternative */}
      <details className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-card)] p-3 border border-[var(--color-border-subtle)] rounded-[var(--radius-xs)]">
        <summary className="cursor-pointer hover:text-[var(--color-text-primary)] font-bold tracking-wider uppercase text-[10px]">
          View Tabular Data (Year 0 to 10)
        </summary>
        <table className="w-full mt-2 text-left tabular-nums" data-testid="chart-accessible-table">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-secondary)]">
              <th className="py-1">Year</th>
              <th className="py-1">Club Net Worth</th>
              <th className="py-1">Events</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={`row-${p.year}`} className="border-b border-[var(--color-border-subtle)]">
                <td className="py-1">Year {p.year}</td>
                <td className="py-1 font-bold">{formatEuros(p.val)}</td>
                <td className="py-1 text-[10px]">
                  {p.year === 0 && 'Draft Completed'}
                  {sellYearSet.has(p.year) && 'Player Sold'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
};
