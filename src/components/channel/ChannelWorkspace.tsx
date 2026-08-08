import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Filter, Plus, Search, Upload } from 'lucide-react'
import { AppShell, PageCrumb } from '../layout/AppShell'
import { CampaignCard } from './CampaignCard'
import { CampaignAnalytics } from './CampaignAnalytics'
import { LeadLevelView } from './LeadLevelView'
import { KpiCard } from '../ui/KpiCard'
import { Modal } from '../ui/Modal'
import { useApp } from '../../context/AppContext'
import { CSV_SAMPLE, channelLabels } from '../../data/mockData'
import type { Channel, Lead } from '../../types'
import { parseLeadsCsv } from '../../utils/parseLeadsCsv'
import { countByClientStatus } from '../../utils/lifecycle'

type DetailTab = 'analytics' | 'leads'

/**
 * Channel-scoped workspace:
 * - Lists only campaigns for this channel
 * - Create campaign here (course + CSV) — does not mix other channels
 * - Opening a campaign defaults to Analytics; Leads = detailed lead-level view
 */
export function ChannelWorkspace({ channel }: { channel: Channel }) {
  const { instituteId = '', campaignId } = useParams()
  const navigate = useNavigate()
  const {
    institutes,
    channelCampaigns,
    createCampaign,
    getCampaign,
    archiveLead,
    setCampaignStatus,
    setActiveCampaignId,
  } = useApp()

  const institute = institutes.find((i) => i.id === instituteId)
  const campaigns = channelCampaigns(instituteId, channel)
  const selected = campaignId ? getCampaign(campaignId) : null

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<DetailTab>('analytics')
  const [createOpen, setCreateOpen] = useState(false)
  const [campName, setCampName] = useState('')
  const [campCourse, setCampCourse] = useState('Online MBA')
  const [parsedLeads, setParsedLeads] = useState<Lead[]>([])
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.course.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q),
    )
  }, [campaigns, search])

  const base = `/institute/${instituteId}/${channel}`

  if (!institute) {
    return (
      <AppShell showChannels activeChannel={channel}>
        <h1 className="page-title">Institute not found</h1>
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

  const downloadSample = () => {
    const blob = new Blob([CSV_SAMPLE], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lead_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  /* —— Campaign detail (analytics default) —— */
  if (selected && selected.instituteId === instituteId) {
    return (
      <AppShell showChannels activeChannel={channel}>
        <div className="page-header">
          <PageCrumb
            items={[
              { label: 'Dashboard', to: `/institute/${instituteId}` },
              { label: channelLabels[channel], to: base },
              { label: selected.name },
            ]}
          />
          <div className="dash-head" style={{ marginBottom: 12 }}>
            <div>
              <h1 className="page-title" style={{ marginBottom: 2 }}>
                {selected.name}
              </h1>
              <p className="page-sub" style={{ marginBottom: 0 }}>
                {channelLabels[channel]} · {selected.course} ·{' '}
                <span className={`status-pill status-${selected.status}`}>{selected.status}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="vb-tabs">
          <button
            type="button"
            className={`vb-tab ${tab === 'analytics' ? 'active' : ''}`}
            onClick={() => {
              setTab('analytics')
              window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
            }}
          >
            Outcome · Analytics
          </button>
          <button
            type="button"
            className={`vb-tab ${tab === 'leads' ? 'active' : ''}`}
            onClick={() => {
              setTab('leads')
              window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
            }}
          >
            Detailed · {channelLabels[channel]} lifecycle
          </button>
        </div>

        {tab === 'analytics' ? (
          <CampaignAnalytics campaign={selected} />
        ) : (
          <LeadLevelView
            campaign={selected}
            channel={channel}
            onArchive={(leadId) => archiveLead(selected.id, leadId)}
            onResumeCampaign={() => setCampaignStatus(selected.id, 'running')}
            onPauseCampaign={() => setCampaignStatus(selected.id, 'paused')}
          />
        )}
      </AppShell>
    )
  }

  const runningCount = campaigns.filter((c) => c.status === 'running').length
  const poolStats = countByClientStatus(campaigns.flatMap((c) => c.leads))
  const uploadStats = useMemo(() => {
    const valid = parsedLeads.filter((l) => l.phoneValid).length
    return {
      valid,
      invalid: parsedLeads.length - valid,
      withClientId: parsedLeads.filter((l) => l.clientLeadId).length,
    }
  }, [parsedLeads])

  /* —— Campaign list for this channel only —— */
  return (
    <AppShell showChannels activeChannel={channel}>
      <div className="dash-head">
        <div>
          <PageCrumb
            items={[
              { label: 'Home', to: `/institute/${instituteId}` },
              { label: institute.name, to: `/institute/${instituteId}` },
              { label: `${channelLabels[channel]} · Campaigns` },
            ]}
          />
          <h1 className="page-title" style={{ marginBottom: 2 }}>
            {channelLabels[channel]} · Campaigns
          </h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {institute.name} · channel-only L1 qualification
          </p>
        </div>
        <button type="button" className="btn btn-success" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Add Campaign
        </button>
      </div>

      <div className="filter-bar filter-bar-compact">
        <div className="field field-search" style={{ flex: '1 1 220px', maxWidth: 320 }}>
          <label>Search</label>
          <div className="inline-search">
            <Search size={14} />
            <input
              placeholder="Name, course, status…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="filter-btn-group">
          <button type="button" className="btn btn-primary btn-sm">
            Search
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
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
            label="Campaigns"
            value={campaigns.length}
            icon="layers"
            color="blue"
            hint={`${runningCount} running`}
          />
          <KpiCard
            label="Verified"
            value={poolStats.verified}
            icon="verified"
            color="green"
            tip="Hot · qualified via voicebot"
          />
          <KpiCard
            label="Uninterested"
            value={poolStats.uninterested}
            icon="badge"
            color="orange"
            tip="Warm / Cold / Not interested"
          />
          <KpiCard
            label="In Progress"
            value={poolStats.inProgress}
            icon="users"
            color="slate"
            tip="Call ongoing / Not attempted"
          />
          <KpiCard
            label="Invalid phones"
            value={poolStats.invalid}
            icon="unverified"
            color="red"
            tip="Never sent to Convin"
          />
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h3 className="panel-title">Campaigns</h3>
          <span className="muted">{filtered.length}</span>
        </div>
        <div className="panel-body">
          {filtered.length ? (
            <div className="campaign-list">
              {filtered.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onOpen={() => {
                    setActiveCampaignId(c.id)
                    setTab('analytics')
                    navigate(`${base}/${c.id}`)
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              No {channelLabels[channel]} campaigns yet. Click Add Campaign to start L1 qualification
              on this channel.
            </div>
          )}
        </div>
      </section>

      {createOpen ? (
        <Modal
          title={`Create ${channelLabels[channel]} campaign`}
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
                className="btn btn-success"
                disabled={!campName.trim() || !parsedLeads.length}
                onClick={() => {
                  const camp = createCampaign(
                    instituteId,
                    campName.trim(),
                    campCourse,
                    parsedLeads.map((l) => ({ ...l, course: campCourse })),
                    channel,
                  )
                  setCreateOpen(false)
                  setParsedLeads([])
                  setFileName('')
                  setCampName('')
                  setTab('analytics')
                  navigate(`${base}/${camp.id}`)
                }}
              >
                Create & Open
              </button>
            </>
          }
        >
          <p className="create-hint">
            Stays under <strong>{channelLabels[channel]}</strong> only — not shown in other channels.
          </p>

          <div className="create-form">
            <div className="field">
              <label>Campaign name</label>
              <input
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
                placeholder="e.g. July Online MBA Push"
              />
            </div>
            <div className="field">
              <label>Course</label>
              <select value={campCourse} onChange={(e) => setCampCourse(e.target.value)}>
                <option>Online MBA</option>
                <option>B.Tech</option>
                <option>MBA</option>
                <option>MBBS</option>
                <option>Online Courses</option>
              </select>
            </div>
          </div>

          <div className="create-upload-block">
            <div className="create-upload-head">
              <span>Lead file (CSV)</span>
              <button type="button" className="btn btn-success btn-sm" onClick={downloadSample}>
                <Download size={13} /> Sample CSV
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
              className={`dropzone dropzone-sm ${dragOver ? 'active' : ''}`}
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
              <Upload size={16} />
              <div>{fileName || 'Drop CSV or click to browse'}</div>
              {parsedLeads.length ? (
                <strong className="upload-ready">
                  {parsedLeads.length} stored · {uploadStats.valid} valid · {uploadStats.invalid}{' '}
                  invalid · CRM IDs minted
                  {uploadStats.withClientId ? ` · ${uploadStats.withClientId} client IDs` : ''}
                </strong>
              ) : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </AppShell>
  )
}
