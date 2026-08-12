import { useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import type { Lead } from '../../types'
import { classifyCampaignLeads } from '../../utils/leadActivity'

export function RunLeadPickerModal({
  leads,
  onClose,
  onConfirm,
}: {
  leads: Lead[]
  onClose: () => void
  onConfirm: (leadIds: string[]) => void
}) {
  const buckets = useMemo(() => classifyCampaignLeads(leads), [leads])
  const fresh = buckets.fresh
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(fresh.map((l) => l.id)),
  )
  const [firstN, setFirstN] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return fresh
    return fresh.filter(
      (l) =>
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
        l.phone_number.toLowerCase().includes(q) ||
        l.external_id.toLowerCase().includes(q) ||
        (l.city || '').toLowerCase().includes(q),
    )
  }, [fresh, search])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const l of filtered) next.add(l.id)
      return next
    })
  }

  const clearAll = () => setSelected(new Set())

  const applyFirstN = () => {
    const n = Math.max(0, Math.min(fresh.length, Number(firstN) || 0))
    setSelected(new Set(fresh.slice(0, n).map((l) => l.id)))
  }

  const count = selected.size

  return (
    <Modal
      large
      title="Select leads to run"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={count === 0}
            onClick={() => onConfirm([...selected])}
          >
            Continue with {count} lead{count === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Only <strong>fresh</strong> leads (never successfully pushed for dialing) can be selected.
        Already used: {buckets.used.length} · Blocked (duplicate/error): {buckets.blocked.length} ·
        Invalid: {buckets.invalid.length}
      </p>

      <div className="stack-h" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <input
          placeholder="Search fresh leads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 180px', minWidth: 160 }}
        />
        <button type="button" className="btn btn-outline btn-sm" onClick={selectAllFiltered}>
          Select shown
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
          Clear
        </button>
        <div className="stack-h" style={{ gap: 6 }}>
          <input
            type="number"
            min={0}
            max={fresh.length}
            placeholder="First N"
            value={firstN}
            onChange={(e) => setFirstN(e.target.value)}
            style={{ width: 88 }}
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={applyFirstN}>
            Apply
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 8px', fontSize: 13 }}>
        <strong>{count}</strong> of {fresh.length} fresh leads selected
        {filtered.length !== fresh.length ? ` · showing ${filtered.length}` : ''}
      </p>

      <div className="table-wrap" style={{ maxHeight: 320, overflow: 'auto' }}>
        <table className="data-table light">
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>Name</th>
              <th>External ID</th>
              <th>Mobile</th>
              <th>City</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                    aria-label={`Select ${l.first_name} ${l.last_name}`}
                  />
                </td>
                <td>
                  {l.first_name} {l.last_name}
                </td>
                <td>
                  <code className="ext-id-code">{l.external_id}</code>
                </td>
                <td>{l.phone_number}</td>
                <td>{l.city || '—'}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No fresh leads match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
