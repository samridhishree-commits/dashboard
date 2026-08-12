import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download, Filter, Play, Plus, Search, Upload } from 'lucide-react'
import { AppShell, PageCrumb } from '../layout/AppShell'
import { CampaignCard } from './CampaignCard'
import { CampaignAnalytics } from './CampaignAnalytics'
import { LeadLevelView } from './LeadLevelView'
import { RunLeadPickerModal } from '../leads/RunLeadPickerModal'
import { KpiCard } from '../ui/KpiCard'
import { Modal } from '../ui/Modal'
import { useApp } from '../../context/AppContext'
import { CSV_SAMPLE, channelLabels, voicebotTypeLabels } from '../../data/mockData'
import type { Channel, Lead, VoicebotType } from '../../types'
import { parseLeadsCsv } from '../../utils/parseLeadsCsv'
import { countByClientStatus } from '../../utils/lifecycle'
import { filterConvinReadyLeads } from '../../utils/leads'
import { leadsEligibleForConvinPush } from '../../utils/leadActivity'

type DetailTab = 'analytics' | 'leads'

function unpushedReadyCount(leads: Lead[]) {
  return leadsEligibleForConvinPush(filterConvinReadyLeads(leads)).length
}

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
    addLeadsToCampaign,
    getCampaign,
    archiveLead,
    setCampaignStatus,
    setActiveCampaignId,
    startVoicebotRun,
    runningCampaignId,
    runProgress,
    lastPushError,
    lastPushNotice,
    clearLastPushError,
  } = useApp()

  const institute = institutes.find((i) => i.id === instituteId)
  const campaigns = channelCampaigns(instituteId, channel)
  const selected = campaignId ? getCampaign(campaignId) : null

  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<DetailTab>('analytics')
  const [createOpen, setCreateOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [voiceTypeOpen, setVoiceTypeOpen] = useState(false)
  const [runningInfoOpen, setRunningInfoOpen] = useState(false)
  const [leadPickOpen, setLeadPickOpen] = useState(false)
  const [pendingRunLeadIds, setPendingRunLeadIds] = useState<string[] | null>(null)
  const [selectedVoiceType, setSelectedVoiceType] = useState<VoicebotType>('btech')
  const [campName, setCampName] = useState('')
  const [campCourse, setCampCourse] = useState('Online MBA')
  const [parsedLeads, setParsedLeads] = useState<Lead[]>([])
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadFileRef = useRef<HTMLInputElement>(null)

  // Keep detail view in sync when URL campaignId changes (avoids blank / stale tab)
  useEffect(() => {
    if (campaignId) {
      setActiveCampaignId(campaignId)
      setTab('analytics')
    }
  }, [campaignId, setActiveCampaignId])

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
  if (campaignId && !selected) {
    return (
      <AppShell showChannels activeChannel={channel}>
        <div className="page-header">
          <PageCrumb
            items={[
              { label: 'Dashboard', to: `/institute/${instituteId}` },
              { label: channelLabels[channel], to: base },
              { label: 'Campaign' },
            ]}
          />
          <h1 className="page-title">Campaign not found</h1>
          <p className="muted">
            This campaign is not in the current session (e.g. after a full reload of a newly created
            campaign). Open it again from the {channelLabels[channel]} list.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate(base)}>
            Back to {channelLabels[channel]}
          </button>
        </div>
      </AppShell>
    )
  }

  if (selected && selected.instituteId === instituteId) {
    const uploading = runningCampaignId === selected.id
    const pendingPush = unpushedReadyCount(selected.leads)
    // Upload anytime except while a push is in flight (draft / ready / idle / even after prior run)
    const canUploadLeads = !uploading
    const canRun =
      channel === 'voicebot' && pendingPush > 0 && !uploading && !runningCampaignId

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
                {' · '}
                {selected.leads.filter((l) => !l.archived).length} leads
                {selected.leads.some((l) => l.archived)
                  ? ` · ${selected.leads.filter((l) => l.archived).length} archived`
                  : ''}{' '}
                · {pendingPush} ready to push
              </p>
            </div>
            <div className="stack-h">
              {canUploadLeads ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={downloadSample}
                    title="Download sample CSV template"
                  >
                    <Download size={14} /> Sample CSV
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={uploading}
                    onClick={() => {
                      setParsedLeads([])
                      setFileName('')
                      setUploadOpen(true)
                    }}
                  >
                    <Upload size={14} /> Upload leads
                  </button>
                </>
              ) : null}
              {channel === 'voicebot' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!canRun}
                  title={
                    pendingPush === 0
                      ? 'Upload valid leads first (or all valid leads already pushed)'
                      : 'Push valid leads to voicebot'
                  }
                  onClick={() => {
                    if (selected.status === 'running') {
                      setRunningInfoOpen(true)
                    } else {
                      setLeadPickOpen(true)
                    }
                  }}
                >
                  <Play size={14} /> Run Campaign
                </button>
              ) : null}
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

        {uploadOpen ? (
          <Modal
            title="Upload leads to campaign"
            onClose={() => {
              setUploadOpen(false)
              setParsedLeads([])
              setFileName('')
            }}
            footer={
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setUploadOpen(false)
                    setParsedLeads([])
                    setFileName('')
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={!parsedLeads.length}
                  onClick={() => {
                    addLeadsToCampaign(
                      selected.id,
                      parsedLeads.map((l) => ({ ...l, course: selected.course })),
                    )
                    setUploadOpen(false)
                    setParsedLeads([])
                    setFileName('')
                    setTab('leads')
                  }}
                >
                  Add {parsedLeads.length || ''} leads
                </button>
              </>
            }
          >
            <p className="muted" style={{ marginTop: 0 }}>
              Adds leads into <strong>{selected.name}</strong> ({selected.status}). Invalid phones
              stay in CRM and are never dialed.
            </p>
            <div className="create-upload-block">
              <div className="create-upload-head">
                <span>Lead CSV</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={downloadSample}>
                  <Download size={13} /> Sample CSV
                </button>
              </div>
              <div
                className={`dropzone ${dragOver ? 'drag' : ''}`}
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
                onClick={() => uploadFileRef.current?.click()}
              >
                <Upload size={22} />
                <strong>{fileName || 'Drop CSV or click to browse'}</strong>
                <span className="muted">Stored in this campaign only</span>
                <input
                  ref={uploadFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </div>
              {parsedLeads.length ? (
                <p className="muted" style={{ marginBottom: 0 }}>
                  <strong className="upload-ready">
                    {parsedLeads.length} ready · {parsedLeads.filter((l) => l.phoneValid).length}{' '}
                    valid · {parsedLeads.filter((l) => !l.phoneValid).length} invalid
                  </strong>
                </p>
              ) : null}
            </div>
          </Modal>
        ) : null}

        {leadPickOpen && selected && channel === 'voicebot' ? (
          <RunLeadPickerModal
            leads={selected.leads}
            onClose={() => setLeadPickOpen(false)}
            onConfirm={(ids) => {
              setPendingRunLeadIds(ids)
              setLeadPickOpen(false)
              setSelectedVoiceType(selected.voicebotType || 'btech')
              setVoiceTypeOpen(true)
            }}
          />
        ) : null}

        {voiceTypeOpen && channel === 'voicebot' ? (
          <Modal
            title="Run Campaign · Voicebot type"
            onClose={() => {
              setVoiceTypeOpen(false)
              setPendingRunLeadIds(null)
            }}
          >
            <p className="muted" style={{ marginTop: 0 }}>
              Pushes {pendingRunLeadIds?.length ?? pendingPush} selected fresh lead(s) to the voicebot.
              Invalid / already-used leads are skipped.
            </p>
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
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setVoiceTypeOpen(false)
                  setPendingRunLeadIds(null)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!(pendingRunLeadIds?.length || pendingPush)}
                onClick={() => {
                  setVoiceTypeOpen(false)
                  void startVoicebotRun(
                    selected.id,
                    selectedVoiceType,
                    pendingRunLeadIds || undefined,
                  )
                  setPendingRunLeadIds(null)
                }}
              >
                <Play size={14} /> Push to voicebot
                {pendingRunLeadIds?.length ? ` (${pendingRunLeadIds.length})` : ''}
              </button>
            </div>
          </Modal>
        ) : null}

        {runningCampaignId === selected.id ? (
          <Modal title="Uploading leads" onClose={() => undefined}>
            <p style={{ marginTop: 0 }}>
              Uploading valid leads
              {selected.voicebotType
                ? ` · ${voicebotTypeLabels[selected.voicebotType]}`
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

        {runningInfoOpen ? (
          <Modal
            title="Campaign already running"
            onClose={() => setRunningInfoOpen(false)}
            footer={
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setRunningInfoOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setRunningInfoOpen(false)
                    setLeadPickOpen(true)
                  }}
                >
                  Continue
                </button>
              </>
            }
          >
            <p style={{ marginTop: 0 }}>
              This voicebot campaign is already running. You can still upload newly added leads —
              Each lead will return success, duplicate number/ID, or invalid phone.
            </p>
          </Modal>
        ) : null}

        {!runningCampaignId && (lastPushNotice || lastPushError) ? (
          <Modal
            title={lastPushNotice?.title || 'Notice'}
            onClose={clearLastPushError}
            footer={
              <button type="button" className="btn btn-primary" onClick={clearLastPushError}>
                OK
              </button>
            }
          >
            <p style={{ marginTop: 0 }}>{lastPushNotice?.summary || lastPushError}</p>
            {lastPushNotice?.lines?.length ? (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
                {lastPushNotice.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
              Only leads accepted for dialing stay In Progress. Duplicate ID/number and other errors are
              shown without where they already exist.
            </p>
          </Modal>
        ) : null}
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
              { label: 'Dashboard', to: `/institute/${instituteId}` },
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
            label="High intent"
            value={poolStats.highIntent}
            icon="verified"
            color="green"
            tip="Hot · strong interest"
          />
          <KpiCard
            label="Moderate intent"
            value={poolStats.moderateIntent}
            icon="badge"
            color="orange"
            tip="Warm · may be interested"
          />
          <KpiCard
            label="Low intent"
            value={poolStats.lowIntent}
            icon="unverified"
            color="red"
            tip="Cold / not interested"
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
            tip="Never dialed"
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
                disabled={!campName.trim()}
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
                {parsedLeads.length ? 'Create & Open' : 'Create empty draft'}
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
