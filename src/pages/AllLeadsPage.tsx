import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Filter, Search } from 'lucide-react'
import { AppShell, PageCrumb } from '../components/layout/AppShell'
import { KpiCard } from '../components/ui/KpiCard'
import { LeadActivityNudge } from '../components/leads/LeadActivityNudge'
import { LeadHistoryModal } from '../components/leads/LeadHistoryModal'
import { useApp } from '../context/AppContext'
import { channelLabels } from '../data/mockData'
import type { Channel, Lead } from '../types'
import { buildLeadActivityIndex } from '../utils/leadActivity'
import { isLeadVerified, verificationComboLabel } from '../utils/verification'

type FlatLead = {
  lead: Lead
  campaignId: string
  campaignName: string
  channel: Channel | 'unassigned'
  name: string
  email: string
  phone: string
  source: string
  country: string
  state: string
  city: string
  course: string
  verified: boolean
  verifyLabel: string
  clientStatus: string
  phoneValid: boolean
  callAttempts: number
  createdAt: string
  lastActivity: string
  externalId: string
  clientLeadId?: string
  archived: boolean
}

export function AllLeadsPage() {
  const { instituteId = '' } = useParams()
  const { institutes, filters, setFilters, resetFilters, instituteCampaigns } = useApp()
  const institute = institutes.find((i) => i.id === instituteId)
  const campaigns = instituteCampaigns(instituteId)
  const leadActivity = useMemo(() => buildLeadActivityIndex(campaigns), [campaigns])
  const [channelFilter, setChannelFilter] = useState('All Channels')
  const [sourceFilter, setSourceFilter] = useState('All Sources')
  const [historyRow, setHistoryRow] = useState<FlatLead | null>(null)

  const allLeads: FlatLead[] = useMemo(() => {
    const rows: FlatLead[] = []
    for (const c of campaigns) {
      for (const l of c.leads) {
        rows.push({
          lead: l,
          campaignId: c.id,
          campaignName: c.name,
          channel: c.channel ?? 'unassigned',
          name: `${l.first_name} ${l.last_name}`.trim(),
          email: l.email,
          phone: l.phone_number,
          source: l.source || 'API',
          country: l.country || 'India',
          state: l.state,
          city: l.city,
          course: l.course,
          verified: isLeadVerified(l),
          verifyLabel: isLeadVerified(l)
            ? verificationComboLabel(l.verifiedChannels ?? [])
            : 'Not verified',
          clientStatus: l.clientStatus,
          phoneValid: l.phoneValid,
          callAttempts: l.callAttempts,
          createdAt: l.createdAt,
          lastActivity: l.lastActivity,
          externalId: l.external_id,
          clientLeadId: l.clientLeadId,
          archived: l.archived,
        })
      }
    }
    return rows
  }, [campaigns])

  const sources = useMemo(
    () => Array.from(new Set(allLeads.map((l) => l.source))).sort(),
    [allLeads],
  )

  const visible = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return allLeads.filter((l) => {
      if (l.archived && filters.status !== 'Archived') return false
      if (filters.status === 'Archived' && !l.archived) return false
      if (filters.status === 'Verified' && !l.verified) return false
      if (filters.status === 'Unverified' && l.verified) return false
      if (channelFilter !== 'All Channels') {
        const ch = channelFilter.toLowerCase()
        if (l.channel === 'unassigned') return false
        if (l.channel !== ch) return false
      }
      if (sourceFilter !== 'All Sources' && l.source !== sourceFilter) return false
      if (
        filters.course !== 'All Courses' &&
        !l.course.toLowerCase().includes(filters.course.toLowerCase())
      ) {
        return false
      }
      if (
        q &&
        !`${l.name} ${l.email} ${l.phone} ${l.source} ${l.campaignName}`.toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
  }, [allLeads, filters, channelFilter, sourceFilter])

  if (!institute) {
    return (
      <AppShell showChannels>
        <h1 className="page-title">Institute not found</h1>
      </AppShell>
    )
  }

  return (
    <AppShell showChannels>
      <div className="page-header">
        <PageCrumb
          items={[
            { label: 'Dashboard', to: `/institute/${instituteId}` },
            { label: 'All Leads' },
          ]}
        />
        <h1 className="page-title">{institute.name} · All Leads</h1>
        <p className="page-sub">
          Every lead across campaigns and channels, with source and full details
        </p>
      </div>

      <div className="filter-bar">
        <div className="filter-row" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <div className="field">
            <label>Channel</label>
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
              <option>All Channels</option>
              <option>Voicebot</option>
              <option>SMS</option>
              <option>Email</option>
              <option>WhatsApp</option>
            </select>
          </div>
          <div className="field">
            <label>Source</label>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option>All Sources</option>
              {sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
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
              <option>Verified</option>
              <option>Unverified</option>
              <option>Archived</option>
            </select>
          </div>
        </div>
        <div className="filter-actions">
          <input
            className="search-input"
            placeholder="Search leads, source, campaign…"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
          <button type="button" className="btn btn-primary">
            <Search size={14} /> Search
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              resetFilters()
              setChannelFilter('All Channels')
              setSourceFilter('All Sources')
            }}
          >
            Reset
          </button>
          <button type="button" className="btn btn-outline">
            <Filter size={14} /> Advance Filter
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <KpiCard label="Total leads" value={visible.length} icon="users" color="blue" />
        <KpiCard
          label="Verified leads"
          value={visible.filter((l) => l.verified).length}
          icon="verified"
          color="green"
        />
        <KpiCard
          label="Multi-channel"
          value={visible.filter((l) => (l.lead.verifiedChannels?.length ?? 0) >= 2).length}
          icon="multi"
          color="purple"
        />
        <KpiCard
          label="Not verified"
          value={visible.filter((l) => !l.verified).length}
          icon="unverified"
          color="slate"
        />
      </div>

      <section className="panel">
        <div className="table-toolbar">
          <span>Total {visible.length} Leads · click a row for history</span>
          <button type="button" className="linkish">
            Edit Column
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table light">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Source</th>
                <th>Channel</th>
                <th>Campaign</th>
                <th>Course</th>
                <th>Country</th>
                <th>State</th>
                <th>City</th>
                <th>Status</th>
                <th>Phone</th>
                <th>Attempts</th>
                <th>External ID (CRM)</th>
                <th>Client Lead ID</th>
                <th>Created</th>
                <th>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr
                  key={`${l.campaignId}-${l.lead.id}`}
                  className={`lead-row-click ${l.phoneValid ? '' : 'lead-row-invalid'}`}
                  onClick={() => setHistoryRow(l)}
                  title="View full lead history"
                >
                  <td>
                    <span className="lead-name-cell">
                      <LeadActivityNudge activity={leadActivity.forLead(l.lead)} />
                      <span>{l.name}</span>
                    </span>
                  </td>
                  <td>{l.email || '—'}</td>
                  <td>{l.phone}</td>
                  <td>
                    <strong>{l.source}</strong>
                  </td>
                  <td>
                    {l.channel === 'unassigned'
                      ? '—'
                      : channelLabels[l.channel] ?? l.channel}
                  </td>
                  <td>{l.campaignName}</td>
                  <td>{l.course || '—'}</td>
                  <td>{l.country}</td>
                  <td>{l.state}</td>
                  <td>{l.city}</td>
                  <td>
                    <span className={`status-pill status-${l.clientStatus}`}>
                      {l.clientStatus === 'high_intent' || l.clientStatus === 'verified'
                        ? 'High intent'
                        : l.clientStatus === 'moderate_intent'
                          ? 'Moderate intent'
                          : l.clientStatus === 'low_intent' || l.clientStatus === 'uninterested'
                            ? 'Low intent'
                            : 'In Progress'}
                    </span>
                  </td>
                  <td>
                    {l.phoneValid ? (
                      <span className="status-pill status-completed">Valid</span>
                    ) : (
                      <span className="status-pill status-failed">Invalid</span>
                    )}
                  </td>
                  <td>{l.callAttempts}</td>
                  <td>
                    <code className="ext-id-code">{l.externalId}</code>
                  </td>
                  <td className="muted">{l.clientLeadId || '—'}</td>
                  <td>{l.createdAt}</td>
                  <td>{l.lastActivity}</td>
                </tr>
              ))}
              {!visible.length ? (
                <tr>
                  <td colSpan={16} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No leads found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <span>10 records per page</span>
          <span>
            Showing {Math.min(10, visible.length)} of {visible.length}
          </span>
        </div>
      </section>

      {historyRow ? (
        <LeadHistoryModal
          lead={historyRow.lead}
          campaignName={historyRow.campaignName}
          onClose={() => setHistoryRow(null)}
        />
      ) : null}
    </AppShell>
  )
}
