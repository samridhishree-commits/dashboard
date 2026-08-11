import { Fragment, useMemo, useState } from 'react'
import { Archive, Pause, Phone, Play, Search } from 'lucide-react'
import type { Campaign, Channel, Lead } from '../../types'
import { clientStatusHints, currentStateLabel, statusLabel } from '../../utils/lifecycle'
import { LeadHistoryModal } from '../leads/LeadHistoryModal'

function initials(l: Lead) {
  return `${l.first_name?.[0] ?? ''}${l.last_name?.[0] ?? ''}`.toUpperCase() || '#'
}

export function LeadLevelView({
  campaign,
  channel,
  onArchive,
  onResumeCampaign,
  onPauseCampaign,
}: {
  campaign: Campaign
  channel: Channel
  onArchive: (leadId: string) => void
  onResumeCampaign?: () => void
  onPauseCampaign?: () => void
}) {
  const [q, setQ] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [lifecycleLead, setLifecycleLead] = useState<Lead | null>(null)

  const leads = useMemo(() => {
    const query = q.trim().toLowerCase()
    return campaign.leads.filter((l) => {
      if (l.archived) return false
      if (!query) return true
      return (
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(query) ||
        l.phone_number.includes(query) ||
        l.email.toLowerCase().includes(query) ||
        l.external_id.toLowerCase().includes(query) ||
        (l.clientLeadId || '').toLowerCase().includes(query) ||
        l.source.toLowerCase().includes(query)
      )
    })
  }, [campaign.leads, q])

  const archivedLeads = useMemo(() => {
    const query = q.trim().toLowerCase()
    return campaign.leads.filter((l) => {
      if (!l.archived) return false
      if (!query) return true
      return (
        `${l.first_name} ${l.last_name}`.toLowerCase().includes(query) ||
        l.phone_number.includes(query) ||
        l.email.toLowerCase().includes(query) ||
        l.external_id.toLowerCase().includes(query) ||
        (l.clientLeadId || '').toLowerCase().includes(query) ||
        l.source.toLowerCase().includes(query)
      )
    })
  }, [campaign.leads, q])

  const isVoice = channel === 'voicebot'

  return (
    <div className="lead-level lead-level-flat">
      <div className="lead-level-bar">
        <div className="lead-search-wrap">
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter leads…"
            aria-label="Filter leads"
          />
        </div>
        <p className="lead-level-hint muted">
          Statuses: <strong>High</strong> · <strong>Moderate</strong> · <strong>Low intent</strong> ·{' '}
          <strong>In Progress</strong>. Invalid phones stay in CRM and are never sent to Convin.
        </p>
        <div className="lead-level-bar-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onResumeCampaign}>
            <Play size={13} fill="currentColor" /> Resume
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onPauseCampaign}>
            <Pause size={13} /> Pause
          </button>
        </div>
      </div>

      <div className="lead-level-table-wrap">
        <table className="lead-level-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Lead</th>
              <th>External ID (CRM)</th>
              <th>Client Lead ID</th>
              <th>Phone</th>
              <th>Status</th>
              <th>State</th>
              <th>{isVoice ? 'Call attempts' : 'Attempts'}</th>
              <th>Last activity</th>
              {isVoice ? <th style={{ width: 100 }}>Recording</th> : null}
              <th style={{ width: 48 }} />
            </tr>
          </thead>
          <tbody>
            {leads.map((l, idx) => {
              const expanded = expandedId === l.id
              const rec = l.recordings[l.recordings.length - 1]
              return (
                <Fragment key={l.id}>
                  <tr
                    className={`${expanded ? 'active' : ''} ${l.phoneValid ? '' : 'lead-row-invalid'}`}
                    onClick={() => setLifecycleLead(l)}
                    onDoubleClick={() => setExpandedId(expanded ? null : l.id)}
                    title={`Open ${channel} lifecycle`}
                  >
                    <td className="lead-idx">
                      <span className="idx-num">{idx + 1}</span>
                      <Phone size={14} className="idx-play" />
                    </td>
                    <td>
                      <div className="lead-title-cell">
                        <div className="lead-avatar">{initials(l)}</div>
                        <div>
                          <strong>
                            {l.first_name} {l.last_name}
                          </strong>
                          <span>
                            {l.phone_number}
                            {l.email ? ` · ${l.email}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="ext-id-code">{l.external_id}</code>
                    </td>
                    <td className="muted">{l.clientLeadId || '—'}</td>
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
                      <span
                        className={`status-pill status-${l.clientStatus}`}
                        title={clientStatusHints[l.clientStatus]}
                      >
                        {statusLabel(l)}
                      </span>
                    </td>
                    <td>{currentStateLabel(l)}</td>
                    <td>
                      {!l.phoneValid
                        ? '—'
                        : isVoice
                          ? `${l.callAttempts}${l.callConnected ? ` / ${l.callConnected}` : ''}`
                          : channel === 'email'
                            ? (l.emailMessageAttempts ?? 0)
                            : channel === 'sms'
                              ? (l.smsMessageAttempts ?? 0)
                              : (l.whatsappMessageAttempts ?? 0)}
                    </td>
                    <td className="muted">{l.lastActivity}</td>
                    {isVoice ? (
                      <td>
                        {l.recordings.length ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (l.recordings.length === 1 && rec) {
                                setPlayingId(playingId === rec.id ? null : rec.id)
                              } else {
                                setLifecycleLead(l)
                              }
                            }}
                          >
                            {l.recordings.length > 1
                              ? `${l.recordings.length} recs`
                              : playingId === rec?.id
                                ? 'Pause'
                                : 'Play'}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    ) : null}
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Archive"
                        onClick={(e) => {
                          e.stopPropagation()
                          onArchive(l.id)
                        }}
                      >
                        <Archive size={14} />
                      </button>
                    </td>
                  </tr>
                  {expanded && isVoice ? (
                    <tr className="lead-expand-row">
                      <td colSpan={11}>
                        <div className="lead-expand-panel">
                          <div className="stack-h" style={{ justifyContent: 'space-between' }}>
                            <h3 style={{ margin: 0, fontSize: 15 }}>
                              {l.first_name} {l.last_name} · recordings
                            </h3>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedId(null)
                              }}
                            >
                              Close
                            </button>
                          </div>
                          <h4 className="rec-heading">Recordings ({l.recordings.length})</h4>
                          {l.recordings.length ? (
                            <div className="rec-stack">
                              {l.recordings.map((r, ri) => (
                                <div className="rec-chip" key={r.id}>
                                  <span className="rec-chip-n">#{ri + 1}</span>
                                  <span className="rec-chip-meta">
                                    {r.timestamp}
                                    <em>{r.outcome.replace('_', ' ')}</em>
                                    <em>{r.durationSec}s</em>
                                  </span>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm rec-chip-play"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setPlayingId(playingId === r.id ? null : r.id)
                                    }}
                                  >
                                    {playingId === r.id ? 'Pause' : 'Play'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                              No recordings yet
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        {!leads.length && !archivedLeads.length ? (
          <div className="empty">No leads in this campaign</div>
        ) : null}
        {!leads.length && archivedLeads.length ? (
          <div className="empty muted">No active leads — see archived below</div>
        ) : null}
      </div>

      {archivedLeads.length ? (
        <div className="archived-leads-block">
          <h4 className="archived-leads-title">
            Archived leads
            <span className="lifecycle-ch-count">{archivedLeads.length}</span>
          </h4>
          <p className="muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
            View only — cannot restore or re-add these leads to the campaign.
          </p>
          <div className="lead-level-table-wrap">
            <table className="lead-level-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Lead</th>
                  <th>External ID (CRM)</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {archivedLeads.map((l, idx) => (
                  <tr
                    key={l.id}
                    className="lead-row-archived"
                    onClick={() => setLifecycleLead(l)}
                    title="View lead history"
                  >
                    <td className="lead-idx">
                      <span className="idx-num">{idx + 1}</span>
                    </td>
                    <td>
                      <div className="lead-title-cell">
                        <div className="lead-avatar">{initials(l)}</div>
                        <div>
                          <strong>
                            {l.first_name} {l.last_name}{' '}
                            <span className="status-pill status-draft">Archived</span>
                          </strong>
                          <span>{l.phone_number}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="ext-id-code">{l.external_id}</code>
                    </td>
                    <td>
                      {l.phoneValid ? (
                        <span className="status-pill status-completed">Valid</span>
                      ) : (
                        <span className="status-pill status-failed">Invalid</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill status-${l.clientStatus}`}>
                        {statusLabel(l)}
                      </span>
                    </td>
                    <td>{currentStateLabel(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {lifecycleLead ? (
        <LeadHistoryModal
          lead={lifecycleLead}
          campaignName={campaign.name}
          channel={channel}
          onClose={() => setLifecycleLead(null)}
        />
      ) : null}
    </div>
  )
}
