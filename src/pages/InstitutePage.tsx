import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Download,
  Filter,
  Mail,
  MessageSquare,
  Mic,
  Phone,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { AppShell, PageCrumb } from '../components/layout/AppShell'
import { AnalyticsSuite } from '../components/charts/AnalyticsSuite'
import { KpiCard, KpiPopover } from '../components/ui/KpiCard'
import { Modal } from '../components/ui/Modal'
import { LeadActivityNudge } from '../components/leads/LeadActivityNudge'
import { LeadHistoryModal } from '../components/leads/LeadHistoryModal'
import { useApp } from '../context/AppContext'
import { CSV_SAMPLE, voicebotTypeLabels } from '../data/mockData'
import type { Lead, VoicebotType } from '../types'
import {
  countByVerificationCombo,
  countVerifiedByChannel,
  isLeadVerified,
} from '../utils/verification'
import { filterConvinReadyLeads } from '../utils/leads'
import { buildLeadActivityIndex, leadsEligibleForConvinPush } from '../utils/leadActivity'
import { parseLeadsCsv } from '../utils/parseLeadsCsv'
import { normalizeClientStatus, statusLabel } from '../utils/lifecycle'

function downloadSampleCsv() {
  const blob = new Blob([CSV_SAMPLE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'lead_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function InstitutePage() {
  const { instituteId = '' } = useParams()
  const navigate = useNavigate()
  const {
    institutes,
    filters,
    setFilters,
    resetFilters,
    activeCampaignId,
    openCampaignTab,
    setActiveCampaignId,
    createCampaign,
    startVoicebotRun,
    getCampaign,
    instituteCampaigns,
    runningCampaignId,
    runProgress,
    lastPushError,
    clearLastPushError,
    addLeadsToCampaign,
    deleteLeads,
  } = useApp()

  const institute = institutes.find((i) => i.id === instituteId)
  const campaigns = instituteCampaigns(instituteId)
  const activeCampaign = activeCampaignId ? getCampaign(activeCampaignId) : null
  const leadActivity = useMemo(() => buildLeadActivityIndex(campaigns), [campaigns])

  const [createOpen, setCreateOpen] = useState(false)
  const [campName, setCampName] = useState('')
  const [campCourse, setCampCourse] = useState('Online MBA')
  const [parsedLeads, setParsedLeads] = useState<Lead[]>([])
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const addLeadsFileRef = useRef<HTMLInputElement>(null)

  const [runOpen, setRunOpen] = useState(false)
  const [voiceTypeOpen, setVoiceTypeOpen] = useState(false)
  const [selectedVoiceType, setSelectedVoiceType] = useState<VoicebotType>('online')
  const [pageSize] = useState(10)
  const [leadSearch, setLeadSearch] = useState('')
  const [kpiOpen, setKpiOpen] = useState<Set<'verified' | 'multi' | 'total' | 'unverified'>>(
    () => new Set(),
  )
  const [historyLead, setHistoryLead] = useState<Lead | null>(null)
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set())
  const [deletingLeads, setDeletingLeads] = useState(false)

  const closeCampaign = () => {
    setActiveCampaignId(null)
    setLeadSearch('')
    setHistoryLead(null)
    setSelectedLeadIds(new Set())
  }

  const toggleKpi = (key: 'verified' | 'multi' | 'total' | 'unverified') => {
    setKpiOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const visibleLeads = useMemo(() => {
    if (!activeCampaign) return []
    const q = leadSearch.trim().toLowerCase()
    return activeCampaign.leads.filter((l) => {
      if (l.archived) return false
      return (
        !q ||
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(q) ||
        l.phone_number.includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.external_id.toLowerCase().includes(q) ||
        (l.clientLeadId || '').toLowerCase().includes(q)
      )
    })
  }, [activeCampaign, leadSearch])

  const campaignLeadStats = useMemo(() => {
    const leads = visibleLeads
    return {
      total: leads.length,
      valid: leads.filter((l) => l.phoneValid).length,
      invalid: leads.filter((l) => !l.phoneValid).length,
      highIntent: leads.filter((l) => normalizeClientStatus(l.clientStatus) === 'high_intent')
        .length,
      moderateIntent: leads.filter(
        (l) => normalizeClientStatus(l.clientStatus) === 'moderate_intent',
      ).length,
      lowIntent: leads.filter((l) => normalizeClientStatus(l.clientStatus) === 'low_intent').length,
      inProgress: leads.filter((l) => normalizeClientStatus(l.clientStatus) === 'in_progress')
        .length,
      convinReady: filterConvinReadyLeads(leads).length,
    }
  }, [visibleLeads])

  const uploadStats = useMemo(() => {
    const valid = parsedLeads.filter((l) => l.phoneValid).length
    const invalid = parsedLeads.length - valid
    const withClientId = parsedLeads.filter((l) => l.clientLeadId).length
    return { valid, invalid, withClientId }
  }, [parsedLeads])

  const filteredCampaigns = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return campaigns.filter((c) => {
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.course.toLowerCase().includes(q)
      const matchCourse =
        filters.course === 'All Courses' ||
        c.course.toLowerCase().includes(filters.course.toLowerCase())
      const s = filters.status
      const matchStatus =
        s === 'All' ||
        (s === 'Not started' && c.status === 'draft') ||
        (s === 'Pending' && c.status === 'ready') ||
        (s === 'Running' && c.status === 'running') ||
        (s === 'Paused' && c.status === 'paused') ||
        (s === 'Completed' && c.status === 'completed') ||
        (s === 'Failed' && c.status === 'failed')
      return matchSearch && matchCourse && matchStatus
    })
  }, [campaigns, filters])

  const pagedLeads = visibleLeads.slice(0, pageSize)
  const deletableVisible = visibleLeads.filter((l) => !leadActivity.forLead(l).locked)
  const allDeletableSelected =
    deletableVisible.length > 0 && deletableVisible.every((l) => selectedLeadIds.has(l.id))
  const selectedCount = selectedLeadIds.size
  const selectedDeletable = [...selectedLeadIds].filter((id) => {
    const lead = visibleLeads.find((l) => l.id === id)
    return lead && !leadActivity.forLead(lead).locked
  })

  const toggleLeadSelected = (leadId: string) => {
    const lead = visibleLeads.find((l) => l.id === leadId)
    if (lead && leadActivity.forLead(lead).locked) return
    setSelectedLeadIds((prev) => {
      const next = new Set(prev)
      if (next.has(leadId)) next.delete(leadId)
      else next.add(leadId)
      return next
    })
  }

  const toggleSelectAllVisible = () => {
    setSelectedLeadIds((prev) => {
      if (deletableVisible.every((l) => prev.has(l.id))) return new Set()
      return new Set(deletableVisible.map((l) => l.id))
    })
  }

  const handleDeleteSelected = async () => {
    if (!activeCampaign || !selectedDeletable.length || deletingLeads) return
    const skipped = selectedCount - selectedDeletable.length
    const ok = window.confirm(
      skipped > 0
        ? `Delete ${selectedDeletable.length} lead(s)? ${skipped} active lead(s) will be skipped (already in a campaign).`
        : `Delete ${selectedDeletable.length} lead${selectedDeletable.length === 1 ? '' : 's'} from this campaign and the database?`,
    )
    if (!ok) return
    setDeletingLeads(true)
    try {
      await deleteLeads(activeCampaign.id, selectedDeletable)
      setSelectedLeadIds(new Set())
    } finally {
      setDeletingLeads(false)
    }
  }

  const kpis = useMemo(() => {
    const leads = campaigns.flatMap((c) => c.leads.filter((l) => !l.archived))
    const verified = leads.filter((l) => isLeadVerified(l))
    const multi = verified.filter((l) => (l.verifiedChannels?.length ?? 0) >= 2)
    return {
      total: leads.length,
      verified: verified.length,
      multi: multi.length,
      unverified: leads.filter((l) => !isLeadVerified(l)).length,
      combos: countByVerificationCombo(leads),
      byChannel: countVerifiedByChannel(leads),
      allLeads: leads,
    }
  }, [campaigns])

  if (!institute) {
    return (
      <AppShell>
        <h1 className="page-title">Institute not found</h1>
        <p className="page-sub">Select a user from the admin list.</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/admin')}>
          Back
        </button>
      </AppShell>
    )
  }

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () =>
      setParsedLeads(parseLeadsCsv(String(reader.result || ''), institute?.name || 'CollegeDunia'))
    reader.readAsText(file)
  }

  return (
    <AppShell showChannels>
      <div className="dash-head">
        <div>
          <PageCrumb items={[{ label: 'Home', to: '/admin' }, { label: institute.name }]} />
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {institute.name} · Lead dashboard
          </h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            L1 qualification · upload leads · run channels
          </p>
        </div>
        <button type="button" className="btn btn-success" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Add Campaign
        </button>
      </div>

      <div className="filter-bar filter-bar-compact">
        <div className="field">
          <label>Course</label>
          <select value={filters.course} onChange={(e) => setFilters({ course: e.target.value })}>
            <option>All Courses</option>
            <option>Online MBA</option>
            <option>B.Tech</option>
            <option>MBA</option>
            <option>Online Courses</option>
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })}>
            <option>All</option>
            <option>Not started</option>
            <option>Pending</option>
            <option>Running</option>
            <option>Paused</option>
            <option>Completed</option>
            <option>Failed</option>
          </select>
        </div>
        <div className="field">
          <label>Date</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ dateFrom: e.target.value })}
          />
        </div>
        <div className="field field-search">
          <label>Search</label>
          <div className="inline-search">
            <Search size={14} />
            <input
              placeholder="Name, phone, email…"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
            />
          </div>
        </div>
        <div className="filter-btn-group">
          <button type="button" className="btn btn-primary btn-sm">
            Search
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
            Reset
          </button>
          <button type="button" className="btn btn-outline btn-sm">
            <Filter size={13} /> Filters
          </button>
        </div>
      </div>

      <div className="kpi-stack">
        <div className="kpi-row">
          <KpiCard
            label="Total leads"
            value={kpis.total}
            icon="users"
            color="blue"
            tip="All uploaded leads across campaigns"
            hint="Click for pool split"
            onClick={() => toggleKpi('total')}
            active={kpiOpen.has('total')}
          />
          <KpiCard
            label="Verified leads"
            value={kpis.verified}
            icon="verified"
            color="green"
            tip="Leads verified on at least one channel"
            hint="Click for channel mix"
            onClick={() => toggleKpi('verified')}
            active={kpiOpen.has('verified')}
          />
          <KpiCard
            label="Multi-channel verified"
            value={kpis.multi}
            icon="multi"
            color="purple"
            tip="Verified on 2+ channels e.g. voicebot+email"
            hint="Click for combos"
            onClick={() => toggleKpi('multi')}
            active={kpiOpen.has('multi')}
          />
          <KpiCard
            label="Not verified"
            value={kpis.unverified}
            icon="unverified"
            color="slate"
            tip="No channel has verified these leads yet"
            hint="Click for details"
            onClick={() => toggleKpi('unverified')}
            active={kpiOpen.has('unverified')}
          />
        </div>

        {kpiOpen.size > 0 ? (
          <div className="kpi-panels">
            <KpiPopover
              open={kpiOpen.has('total')}
              onClose={() => toggleKpi('total')}
              title="Lead pool"
            >
              <ul className="kpi-breakdown">
                <li>
                  <span>Verified</span>
                  <strong>{kpis.verified}</strong>
                </li>
                <li>
                  <span>Not verified</span>
                  <strong>{kpis.unverified}</strong>
                </li>
                <li>
                  <span>Multi-channel</span>
                  <strong>{kpis.multi}</strong>
                </li>
                <li>
                  <span>Single-channel</span>
                  <strong>{Math.max(kpis.verified - kpis.multi, 0)}</strong>
                </li>
              </ul>
            </KpiPopover>

            <KpiPopover
              open={kpiOpen.has('verified')}
              onClose={() => toggleKpi('verified')}
              title="Verified by channel"
            >
              <p className="kpi-popover-note">
                A lead can count in more than one channel when multi-verified.
              </p>
              <ul className="kpi-breakdown">
                {kpis.byChannel.map((row) => (
                  <li key={row.channel}>
                    <span>{row.label}</span>
                    <strong>{row.count}</strong>
                  </li>
                ))}
              </ul>
              <h4 className="kpi-breakdown-h">By verification combo</h4>
              <ul className="kpi-breakdown">
                {kpis.combos.length ? (
                  kpis.combos.map((row) => (
                    <li key={row.key}>
                      <span>{row.label}</span>
                      <strong>{row.count}</strong>
                    </li>
                  ))
                ) : (
                  <li className="muted">No verified leads yet</li>
                )}
              </ul>
            </KpiPopover>

            <KpiPopover
              open={kpiOpen.has('multi')}
              onClose={() => toggleKpi('multi')}
              title="Multi-channel verification combos"
            >
              <ul className="kpi-breakdown">
                {kpis.combos
                  .filter((c) => c.key.includes('+'))
                  .map((row) => (
                    <li key={row.key}>
                      <span>{row.label}</span>
                      <strong>{row.count}</strong>
                    </li>
                  ))}
                {!kpis.combos.some((c) => c.key.includes('+')) ? (
                  <li className="muted">No multi-channel verified leads yet</li>
                ) : null}
              </ul>
            </KpiPopover>

            <KpiPopover
              open={kpiOpen.has('unverified')}
              onClose={() => toggleKpi('unverified')}
              title="Not verified"
            >
              <p className="kpi-popover-note">
                These leads have no verified channel yet — run Voicebot, Email, SMS, or WhatsApp to
                qualify them.
              </p>
              <ul className="kpi-breakdown">
                <li>
                  <span>Awaiting verification</span>
                  <strong>{kpis.unverified}</strong>
                </li>
                <li>
                  <span>Share of pool</span>
                  <strong>
                    {kpis.total
                      ? `${Math.round((kpis.unverified / kpis.total) * 1000) / 10}%`
                      : '0%'}
                  </strong>
                </li>
              </ul>
            </KpiPopover>
          </div>
        ) : null}
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Campaigns</h3>
          <span className="muted">{filteredCampaigns.length}</span>
        </div>
        <div className="panel-body">
          {filteredCampaigns.length ? (
            <div className="campaign-list">
              {filteredCampaigns.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="campaign-item"
                  onClick={() => openCampaignTab(c)}
                >
                  <div>
                    <h4>
                      {c.name}{' '}
                      <span className={`status-pill status-${c.status}`}>{c.status}</span>
                    </h4>
                    <p className="muted" style={{ margin: 0 }}>
                      {c.course} · {c.leads.filter((l) => !l.archived).length} leads · {c.createdAt}
                    </p>
                  </div>
                      <span className="btn btn-outline btn-sm" style={{ pointerEvents: 'none' }}>
                        Open
                      </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty">
              {campaigns.length
                ? 'No campaigns match these filters.'
                : 'No campaigns yet. Click Add Campaign to upload leads.'}
            </div>
          )}
        </div>
      </section>

      <div className="section-gap" id="analytics">
        <AnalyticsSuite />
      </div>

      {activeCampaign ? (
        <Modal
          xl
          title={activeCampaign.name}
          onClose={closeCampaign}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeCampaign}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate(`/institute/${instituteId}/voicebot`)}
              >
                <Mic size={14} /> Voicebot
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  !!runningCampaignId ||
                  leadsEligibleForConvinPush(filterConvinReadyLeads(activeCampaign.leads)).length === 0
                }
                title={
                  leadsEligibleForConvinPush(filterConvinReadyLeads(activeCampaign.leads)).length === 0
                    ? 'Upload valid leads first (or all valid leads already pushed)'
                    : 'Push valid leads to Convin'
                }
                onClick={() => setRunOpen(true)}
              >
                <Play size={14} /> Run Campaign
              </button>
            </>
          }
        >
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 12 }}>
            Status:{' '}
            <span className={`status-pill status-${activeCampaign.status}`}>
              {activeCampaign.status}
            </span>
          </p>

          <div className="kpi-row" style={{ marginBottom: 12 }}>
            <KpiCard label="Total leads" value={campaignLeadStats.total} icon="users" color="blue" />
            <KpiCard
              label="High intent"
              value={campaignLeadStats.highIntent}
              icon="verified"
              color="green"
              tip="Hot · strong interest"
            />
            <KpiCard
              label="Moderate intent"
              value={campaignLeadStats.moderateIntent}
              icon="multi"
              color="orange"
              tip="Warm · may be interested"
            />
            <KpiCard
              label="Low intent"
              value={campaignLeadStats.lowIntent}
              icon="badge"
              color="red"
              tip="Cold / not interested"
            />
            <KpiCard
              label="In Progress"
              value={campaignLeadStats.inProgress}
              icon="layers"
              color="slate"
              tip="Call ongoing / Not attempted"
            />
            <KpiCard
              label="Invalid phones"
              value={campaignLeadStats.invalid}
              icon="unverified"
              color="red"
              tip="Stored in CRM · never sent to Convin"
            />
          </div>

          <div className="table-toolbar">
            <span>
              {campaignLeadStats.total} leads · {campaignLeadStats.convinReady} Convin-ready ·{' '}
              {campaignLeadStats.invalid} invalid
              {selectedCount ? ` · ${selectedCount} selected` : ''}
            </span>
            <div className="stack-h">
              {selectedDeletable.length ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm lead-delete-btn"
                  disabled={deletingLeads}
                  onClick={() => void handleDeleteSelected()}
                  title="Remove selected leads that are not active in a campaign"
                >
                  <Trash2 size={13} />{' '}
                  {deletingLeads
                    ? 'Deleting…'
                    : `Delete selected${
                        selectedCount > selectedDeletable.length
                          ? ` (${selectedDeletable.length})`
                          : ''
                      }`}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={downloadSampleCsv}
                title="Download sample CSV template"
              >
                <Download size={13} /> Sample CSV
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={!!runningCampaignId}
                onClick={() => addLeadsFileRef.current?.click()}
              >
                <Upload size={13} /> Upload more leads
              </button>
              <input
                ref={addLeadsFileRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f || !activeCampaign) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const leads = parseLeadsCsv(
                      String(reader.result || ''),
                      institute?.name || 'CollegeDunia',
                    ).map((l) => ({ ...l, course: activeCampaign.course }))
                    addLeadsToCampaign(activeCampaign.id, leads)
                  }
                  reader.readAsText(f)
                  e.target.value = ''
                }}
              />
              <div className="inline-search" style={{ minWidth: 200 }}>
                <Search size={14} />
                <input
                  placeholder="Search leads…"
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table light">
              <thead>
                <tr>
                  <th className="lead-check-col">
                    <input
                      type="checkbox"
                      aria-label="Select all deletable leads"
                      checked={allDeletableSelected}
                      onChange={toggleSelectAllVisible}
                      disabled={!deletableVisible.length}
                    />
                  </th>
                  <th>Name</th>
                  <th>External ID (CRM)</th>
                  <th>Client Lead ID</th>
                  <th>Mobile</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Source</th>
                  <th>City</th>
                </tr>
              </thead>
              <tbody>
                {pagedLeads.map((l) => {
                  const activity = leadActivity.forLead(l)
                  const locked = activity.locked
                  return (
                  <tr
                    key={l.id}
                    className={`lead-row-click ${l.phoneValid ? '' : 'lead-row-invalid'} ${
                      selectedLeadIds.has(l.id) ? 'lead-row-selected' : ''
                    } ${locked ? 'lead-row-locked' : ''}`}
                    onClick={() => setHistoryLead(l)}
                    title="View lead history"
                  >
                    <td
                      className="lead-check-col"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${l.first_name} ${l.last_name}`}
                        checked={selectedLeadIds.has(l.id)}
                        disabled={locked}
                        title={
                          locked
                            ? 'Active in a campaign — cannot delete'
                            : 'Select to delete'
                        }
                        onChange={() => toggleLeadSelected(l.id)}
                      />
                    </td>
                    <td>
                      <span className="lead-name-cell">
                        <LeadActivityNudge activity={activity} />
                        <span>
                          {l.first_name} {l.last_name}
                        </span>
                      </span>
                    </td>
                    <td>
                      <code className="ext-id-code">{l.external_id}</code>
                    </td>
                    <td className="muted">{l.clientLeadId || '—'}</td>
                    <td>{l.phone_number || '—'}</td>
                    <td>
                      {l.phoneValid ? (
                        <span className="status-pill status-completed">Valid</span>
                      ) : (
                        <span className="status-pill status-failed" title={l.phoneInvalidReason}>
                          Invalid
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill status-${l.clientStatus}`}>
                        {statusLabel(l)}
                      </span>
                    </td>
                    <td>{l.source || 'API'}</td>
                    <td>{l.city}</td>
                  </tr>
                  )
                })}
                {!pagedLeads.length ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No leads match filters
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span>{pageSize} records per page</span>
            <span>
              Showing {Math.min(pageSize, visibleLeads.length)} of {visibleLeads.length}
            </span>
          </div>
        </Modal>
      ) : null}

      {historyLead ? (
        <LeadHistoryModal
          lead={historyLead}
          campaignName={activeCampaign?.name}
          onClose={() => setHistoryLead(null)}
        />
      ) : null}

      {createOpen ? (
        <Modal
          title="Add Campaign · Bulk Upload Leads"
          large
          onClose={() => {
            setCreateOpen(false)
            setParsedLeads([])
            setFileName('')
          }}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!campName.trim() || !parsedLeads.length}
                onClick={() => {
                  const campaign = createCampaign(
                    instituteId,
                    campName.trim(),
                    campCourse,
                    parsedLeads,
                  )
                  openCampaignTab(campaign)
                  setCreateOpen(false)
                  setParsedLeads([])
                  setFileName('')
                  setCampName('')
                }}
              >
                Create & Open
              </button>
            </>
          }
        >
          <div className="form-grid" style={{ marginBottom: 10 }}>
            <div className="field">
              <label>Campaign name</label>
              <input value={campName} onChange={(e) => setCampName(e.target.value)} />
            </div>
            <div className="field">
              <label>Course</label>
              <select value={campCourse} onChange={(e) => setCampCourse(e.target.value)}>
                <option>Online MBA</option>
                <option>B.Tech</option>
                <option>MBA</option>
                <option>Online Courses</option>
              </select>
            </div>
          </div>
          <div className="howto">
            <h3>How to bulk upload leads</h3>
            <ol>
              <li>Download the sample CSV template</li>
              <li>Fill lead data (phone_number* required)</li>
              <li>Save as CSV and upload</li>
            </ol>
            <hr />
            <p style={{ margin: 0 }}>
              Fields: phone_number* (validated), optional lead_id/external_id (shown as Client Lead
              ID only), first_name / name, email, city, state, course. We always mint our own
              external_id (e.g. JU07082026001482) for Convin. Invalid phones stay in CRM but are
              never sent.
            </p>
          </div>
          <div style={{ margin: '12px 0' }}>
            <button type="button" className="btn btn-success" onClick={downloadSampleCsv}>
              <Download size={14} /> Download Sample CSV
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
          <div
            className={`dropzone ${dragOver ? 'active' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) handleFile(f)
            }}
          >
            <Upload size={20} />
            <div>{fileName || 'Drag & drop CSV or click to browse'}</div>
            {parsedLeads.length ? (
              <strong>
                {parsedLeads.length} stored · {uploadStats.valid} valid · {uploadStats.invalid}{' '}
                invalid · {parsedLeads.length} CRM external IDs minted
                {uploadStats.withClientId
                  ? ` · ${uploadStats.withClientId} client lead IDs kept`
                  : ''}
              </strong>
            ) : null}
          </div>
          {uploadStats.invalid > 0 ? (
            <div className="upload-invalid-box">
              <strong>Invalid phones (kept in CRM, skipped on Run)</strong>
              <ul>
                {parsedLeads
                  .filter((l) => !l.phoneValid)
                  .slice(0, 8)
                  .map((l) => (
                    <li key={l.id}>
                      {l.first_name} {l.last_name} · {l.phone_number} · {l.phoneInvalidReason}
                    </li>
                  ))}
                {uploadStats.invalid > 8 ? <li>…and {uploadStats.invalid - 8} more</li> : null}
              </ul>
            </div>
          ) : null}
        </Modal>
      ) : null}

      {runOpen ? (
        <Modal
          title="Run Campaign · Choose channel"
          onClose={() => setRunOpen(false)}
          footer={
            <button type="button" className="btn btn-ghost" onClick={() => setRunOpen(false)}>
              Close
            </button>
          }
        >
          <div className="choice-grid">
            <button
              type="button"
              className="choice-card"
              onClick={() => {
                setRunOpen(false)
                navigate(`/institute/${instituteId}/email`)
              }}
            >
              <Mail size={20} />
              <h4>Email</h4>
            </button>
            <button
              type="button"
              className="choice-card"
              onClick={() => {
                setRunOpen(false)
                navigate(`/institute/${instituteId}/sms`)
              }}
            >
              <MessageSquare size={20} />
              <h4>SMS</h4>
            </button>
            <button
              type="button"
              className="choice-card"
              onClick={() => {
                setRunOpen(false)
                navigate(`/institute/${instituteId}/whatsapp`)
              }}
            >
              <Phone size={20} />
              <h4>WhatsApp</h4>
            </button>
            <button
              type="button"
              className="choice-card"
              onClick={() => {
                setRunOpen(false)
                setVoiceTypeOpen(true)
              }}
            >
              <Mic size={20} color="#2f6fed" />
              <h4>Voicebot</h4>
            </button>
          </div>
        </Modal>
      ) : null}

      {voiceTypeOpen ? (
        <Modal
          title="Select Voicebot type"
          onClose={() => setVoiceTypeOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setVoiceTypeOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  !activeCampaign ||
                  leadsEligibleForConvinPush(filterConvinReadyLeads(activeCampaign.leads)).length === 0
                }
                onClick={() => {
                  if (activeCampaign) {
                    startVoicebotRun(activeCampaign.id, selectedVoiceType)
                    setVoiceTypeOpen(false)
                    navigate(`/institute/${instituteId}/voicebot`)
                  }
                }}
              >
                Confirm & Run
              </button>
            </>
          }
        >
          {activeCampaign ? (
            <p className="convin-push-note">
              Convin will receive{' '}
              <strong>
                {leadsEligibleForConvinPush(filterConvinReadyLeads(activeCampaign.leads)).length}
              </strong>{' '}
              new leads with <code>external_id</code>, <code>phone_number</code>, and <code>name</code>
              . Already-pushed leads are skipped.
              only.
              {activeCampaign.leads.filter((l) => !l.phoneValid).length > 0
                ? ` ${activeCampaign.leads.filter((l) => !l.phoneValid).length} invalid phone(s) stay in CRM and will not be sent.`
                : null}
            </p>
          ) : null}
          <div className="type-grid">
            {(
              [
                ['btech', 'B.Tech'],
                ['mbbs', 'MBBS'],
                ['mba', 'MBA'],
                ['online', 'Online Courses'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`type-card ${selectedVoiceType === id ? 'selected' : ''}`}
                onClick={() => setSelectedVoiceType(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}

      {runningCampaignId ? (
        <Modal title="Uploading leads" onClose={() => undefined}>
          <p style={{ marginTop: 0 }}>
            Uploading valid leads to Convin (campaign already running)
            {activeCampaign?.voicebotType
              ? ` · ${voicebotTypeLabels[activeCampaign.voicebotType]}`
              : ''}
            {activeCampaign?.lastConvinPush
              ? ` · ${activeCampaign.lastConvinPush.leadCount} to send`
              : ''}
            {activeCampaign?.lastConvinPush?.skippedInvalid
              ? ` · ${activeCampaign.lastConvinPush.skippedInvalid} invalid skipped`
              : ''}
            .
          </p>
          <div className="stack-h" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="muted">Progress</span>
            <strong>{runProgress}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${runProgress}%` }} />
          </div>
        </Modal>
      ) : null}

      {!runningCampaignId && lastPushError ? (
        <Modal title="Notice" onClose={clearLastPushError}>
          <p style={{ marginTop: 0 }}>{lastPushError}</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Leads that uploaded stay In Progress until webhook / fetch updates status.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn primary" onClick={clearLastPushError}>
              OK
            </button>
          </div>
        </Modal>
      ) : null}
    </AppShell>
  )
}
