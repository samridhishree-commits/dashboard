/** Shared chart look — Meritto-aligned, muted CRM palette */
export const CHART = {
  grid: '#eef2f7',
  tick: { fontSize: 12, fill: '#94a3b8' } as const,
  axis: { stroke: 'transparent' },
  tooltip: {
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    fontSize: 12,
  },
  curve: 'monotone' as const,
  /** Soft top only — not pill bars */
  barRadius: [4, 4, 0, 0] as [number, number, number, number],
  barRadiusH: [0, 4, 4, 0] as [number, number, number, number],
  strokeWidth: 2.25,
  /** Brand blues + restrained accents (matches --primary / sidebar) */
  colors: {
    blue: '#3b82f6',
    blueSoft: '#60a5fa',
    blueDeep: '#2563eb',
    orange: '#f59e0b',
    green: '#22c55e',
    violet: '#8b5cf6',
    slate: '#94a3b8',
    red: '#ef4444',
    ink: '#334155',
  },
  /** Sequential blue scale for donuts — no rainbow */
  donut: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
}

export const noPointEnds = {
  dot: false as const,
  activeDot: false as const,
}
