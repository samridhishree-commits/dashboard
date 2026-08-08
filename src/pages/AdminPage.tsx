import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { AppShell } from '../components/layout/AppShell'
import { Modal } from '../components/ui/Modal'
import { useApp } from '../context/AppContext'

export function AdminPage() {
  const { institutes, filters, setFilters, resetFilters, addInstitute } = useApp()
  const navigate = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')

  const filtered = useMemo(() => {
    return institutes.filter((inst) => {
      const q = filters.username.trim().toLowerCase()
      const matchUser =
        !q ||
        inst.username.toLowerCase().includes(q) ||
        inst.name.toLowerCase().includes(q)
      const matchFrom = !filters.dateFrom || inst.createdAt >= filters.dateFrom
      const matchTo = !filters.dateTo || inst.createdAt <= filters.dateTo
      return matchUser && matchFrom && matchTo
    })
  }, [institutes, filters])

  const selected = institutes.find((i) => i.id === selectedId) ?? null

  return (
    <AppShell showAdminBadge>
      <div className="page-header">
        <h1 className="page-title">Select institute user</h1>
        <p className="page-sub">Choose a client account to open their L1 lead qualification dashboard.</p>
      </div>

      <div className="filter-bar">
        <div className="filter-row">
          <div className="field">
            <label htmlFor="username">Username / Institute</label>
            <input
              id="username"
              value={filters.username}
              onChange={(e) => setFilters({ username: e.target.value })}
              placeholder="Search username or name"
            />
          </div>
          <div className="field">
            <label htmlFor="from">Created from</label>
            <input
              id="from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ dateFrom: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="to">Created to</label>
            <input
              id="to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ dateTo: e.target.value })}
            />
          </div>
        </div>
        <div className="filter-actions">
          <button type="button" className="btn btn-primary">
            <Search size={14} /> Search
          </button>
          <button type="button" className="btn btn-secondary" onClick={resetFilters}>
            Reset
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Create User
          </button>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Institute users</h3>
          <span className="muted">{filtered.length} users</span>
        </div>
        <div className="panel-body">
          <div className="user-list">
            {filtered.map((inst) => (
              <button
                key={inst.id}
                type="button"
                className={`user-row ${selectedId === inst.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(inst.id)}
              >
                <div>
                  <h4>{inst.name}</h4>
                  <p>
                    @{inst.username} · created {inst.createdAt}
                  </p>
                </div>
                <span className="muted" style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
                  {selectedId === inst.id ? 'Selected' : 'Select'}
                </span>
              </button>
            ))}
          </div>

          <div className="select-continue">
            <p className="muted" style={{ margin: 0 }}>
              {selected ? `Selected: ${selected.name}` : 'Select a user to continue'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selected}
              onClick={() => {
                if (selected) navigate(`/institute/${selected.id}`)
              }}
            >
              Open dashboard
            </button>
          </div>
        </div>
      </section>

      {showCreate ? (
        <Modal
          title="Create User"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!name.trim() || !username.trim()}
                onClick={() => {
                  addInstitute(name.trim(), username.trim())
                  setName('')
                  setUsername('')
                  setShowCreate(false)
                }}
              >
                Create
              </button>
            </>
          }
        >
          <div className="form-grid">
            <div className="field full">
              <label>Institute name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field full">
              <label>Username</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          </div>
        </Modal>
      ) : null}
    </AppShell>
  )
}
