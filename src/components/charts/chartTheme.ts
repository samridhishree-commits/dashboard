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
    blue: '#2f6fed',
    blueSoft: '#6b93e8',
    blueDeep: '#1e4bb8',
    orange: '#c47a2c',
    green: '#2f7d57',
    violet: '#5b6b8c',
    slate: '#94a3b8',
    red: '#b45353',
    ink: '#334155',
  },
  /** Sequential blue scale for donuts — no rainbow */
  donut: ['#1e4bb8', '#2f6fed', '#6b93e8', '#b7c9e8'],
}

export const noPointEnds = {
  dot: false as const,
  activeDot: false as const,
}
