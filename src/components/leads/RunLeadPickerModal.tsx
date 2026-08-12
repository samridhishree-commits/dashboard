import { useMemo, useState } from 'react'
import { Modal } from '../ui/Modal'
import type { Lead } from '../../types'
import { classifyCampaignLeads } from '../../utils/leadActivity'

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export function RunLeadPickerModal({
  leads,
  onClose,
  onConfirm,
  initialSelectedIds,
}: {
  leads: Lead[]
  onClose: () => void
  onConfirm: (leadIds: string[]) => void
  /** Pre-check these fresh lead ids (e.g. from table selection). */
  initialSelectedIds?: string[]
}) {
  const buckets = useMemo(() => classifyCampaignLeads(leads), [leads])
  const fresh = buckets.fresh
  const freshIdSet = useMemo(() => new Set(fresh.map((l) => l.id)), [fresh])

  const cities = useMemo(
    () => uniqueSorted(fresh.map((l) => (l.city || '').trim()).filter(Boolean)),
    [fresh],
  )
  const sources = useMemo(
    () => uniqueSorted(fresh.map((l) => (l.source || '').trim()).filter(Boolean)),
    [fresh],
  )

  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [source, setSource] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => {
    const preset = (initialSelectedIds || []).filter((id) => freshIdSet.has(id))
    if (preset.length) return new Set(preset)
    return new Set(fresh.map((l) => l.id))
  })
  const [firstN, setFirstN] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return fresh.filter((l) => {
      if (city && (l.city || '').trim() !== city) return false
      if (source && (l.source || '').trim() !== source) return false
      if (!q) return true
      return (
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
        l.phone_number.toLowerCase().includes(q) ||
        l.external_id.toLowerCase().includes(q) ||
        (l.city || '').toLowerCase().includes(q) ||
        (l.source || '').toLowerCase().includes(q)
      )
    })
  }, [fresh, search, city, source])

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
    const n = Math.max(0, Math.min(filtered.length, Number(firstN) || 0))
    setSelected(new Set(filtered.slice(0, n).map((l) => l.id)))
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
        Only <strong>Fresh</strong> leads can be selected. Already used: {buckets.used.length} ·
        Blocked: {buckets.blocked.length} · Invalid: {buckets.invalid.length}
      </p>

      <div className="lead-filter-bar" style={{ marginBottom: 10 }}>
        <input
          placeholder="Search name, phone, ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 160px', minWidth: 140 }}
        />
        <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city">
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
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
            max={filtered.length}
            placeholder="First N"
            value={firstN}
            onChange={(e) => setFirstN(e.target.value)}
            style={{ width: 88 }}
            title="Select first N of the filtered list"
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={applyFirstN}>
            Apply
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 8px', fontSize: 13 }}>
        <strong>{count}</strong> of {fresh.length} fresh selected
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
              <th>Source</th>
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
                <td>{l.source || '—'}</td>
                <td>{l.city || '—'}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  No fresh leads match these filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
