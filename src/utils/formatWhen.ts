/** Format webhook/call timestamps for India CRM UI.
 * Convin sends UTC (`…Z`). Older rows may be naive `YYYY-MM-DD HH:mm:ss` (treat as UTC).
 * Always render in Asia/Kolkata so times match DBeaver received_at (+0530). */
export function formatWhen(ts?: string) {
  if (!ts) return '—'
  const raw = String(ts).trim()
  let d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    const asUtc =
      /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) || raw.includes('T')
        ? raw
        : `${raw.replace(' ', 'T')}Z`
    d = new Date(asUtc)
  }
  // Legacy stripped-Z values like "2026-08-11 06:20:46" were UTC wall times
  if (
    !Number.isNaN(d.getTime()) &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw) &&
    !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
  ) {
    d = new Date(`${raw.replace(' ', 'T')}Z`)
  }
  if (Number.isNaN(d.getTime())) {
    return raw.replace('T', ' ').replace(/\.\d+Z?$/, '').slice(0, 19)
  }
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
