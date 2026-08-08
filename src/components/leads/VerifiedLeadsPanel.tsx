import { Fragment, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronDown, Phone, Search } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import type { Lead } from '../../types'
import { Panel } from '../ui/Panel'
import {
  channelVerifyLabels,
  isLeadVerified,
  verificationComboLabel,
} from '../../utils/verification'
import { LeadHistoryModal } from './LeadHistoryModal'

type VerifiedRow = Lead & { campaignName: string; channel: string }

function initials(l: Lead) {
  return `${l.first_name?.[0] ?? ''}${l.last_name?.[0] ?? ''}`.toUpperCase() || '#'
}

function historyEvents(l: VerifiedRow) {
  const events: { at: string; title: string; detail: string }[] = [
    {
      at: l.createdAt,
      title: 'Lead captured',
      detail: `Source ${l.source || '—'} · ${l.course} · ${l.city}, ${l.state}`,
    },
  ]

  l.recordings.forEach((r, i) => {
    events.push({
      at: r.timestamp,
      title: `Call attempt ${i + 1}`,
      detail: `${r.outcome.replace('_', ' ')} · ${r.durationSec}s${r.url ? ' · recording available' : ''}`,
    })
  })

  if ((l.verificationHistory?.length ?? 0) > 0) {
    l.verificationHistory.forEach((v) => {
      events.push({
        at: v.at,
        title: `Verified · ${channelVerifyLabels[v.channel]}`,
        detail: v.note || `Marked verified on ${channelVerifyLabels[v.channel]}`,
      })
    })
  } else if (isLeadVerified(l)) {
    events.push({
      at: l.lastActivity,
      title: 'Marked verified',
      detail: verificationComboLabel(l.verifiedChannels ?? []),
    })
  }

  if (l.voicebotNote) {
    events.push({
      at: l.lastActivity,
      title: 'Voicebot note',
      detail: l.voicebotNote,
    })
  }

  return events
}

export function VerifiedLeadsPanel() {
  const { id: instituteId = '' } = useParams()
  const { instituteCampaigns } = useApp()
  const [q, setQ] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [historyLead, setHistoryLead] = useState<VerifiedRow | null>(null)

  const rows = useMemo(() => {
    const campaigns = instituteCampaigns(instituteId)
    const list: VerifiedRow[] = []
    for (const c of campaigns) {
      for (const l of c.leads) {
        if (l.archived || !isLeadVerified(l)) continue
        list.push({
          ...l,
          campaignName: c.name,
          channel: c.channel ?? 'voicebot',
        })
      }
    }
    const query = q.trim().toLowerCase()
    return list
      .filter((l) => {
        if (!query) return true
        return (
          `${l.first_name} ${l.last_name}`.toLowerCase().includes(query) ||
          l.phone_number.includes(query) ||
          l.email.toLowerCase().includes(query) ||
          l.campaignName.toLowerCase().includes(query) ||
          l.source.toLowerCase().includes(query)
        )
      })
      .sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : -1))
  }, [instituteCampaigns, instituteId, q])

  return (
    <>
    <Panel
      title="Verified Leads · History"
      tip="Full interaction history for leads that completed L1 verification"
      tools={
        <div className="verified-search">
          <Search size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search verified leads…"
            aria-label="Search verified leads"
          />
        </div>
      }
    >
      <div className="verified-panel">
        <p className="verified-panel-meta">
          {rows.length} verified lead{rows.length === 1 ? '' : 's'} · click a row for full history
        </p>
        <div className="table-wrap">
          <table className="data-table light verified-table">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Lead</th>
                <th>Source</th>
                <th>Campaign</th>
                <th>Verification</th>
                <th>Attempts</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const open = expandedId === l.id
                const events = historyEvents(l)
                return (
                  <Fragment key={`${l.campaignName}-${l.id}`}>
                    <tr
                      className={`verified-row ${open ? 'is-open' : ''}`}
                      onClick={() => setHistoryLead(l)}
                      onDoubleClick={() => setExpandedId(open ? null : l.id)}
                      title="Click for full lead history"
                    >
                      <td>
                        <ChevronDown
                          size={16}
                          className={`verified-chevron ${open ? 'open' : ''}`}
                        />
                      </td>
                      <td>
                        <div className="verified-lead-cell">
                          <span className="verified-avatar">{initials(l)}</span>
                          <div>
                            <strong>
                              {l.first_name} {l.last_name}
                            </strong>
                            <div className="muted" style={{ fontSize: 12 }}>
                              {l.phone_number} · {l.email || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{l.source || '—'}</td>
                      <td>
                        <div>{l.campaignName}</div>
                        <div className="muted" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                          {l.channel}
                        </div>
                      </td>
                      <td>
                        <span className="verify-tag-inline">
                          {verificationComboLabel(l.verifiedChannels ?? [])}
                        </span>
                      </td>
                      <td>
                        <Phone size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                        {l.callConnected}/{l.callAttempts}
                      </td>
                      <td className="muted">{l.lastActivity}</td>
                    </tr>
                    {open ? (
                      <tr className="verified-history-row">
                        <td colSpan={7}>
                          <div className="lead-history">
                            <h4>Lead history</h4>
                            <ol className="lead-history-list">
                              {events.map((ev, i) => (
                                <li key={`${ev.title}-${i}`}>
                                  <span className="lead-history-dot" />
                                  <div>
                                    <div className="lead-history-title">
                                      {ev.title}
                                      <time>{ev.at}</time>
                                    </div>
                                    <p>{ev.detail}</p>
                                  </div>
                                </li>
                              ))}
                            </ol>
                            <div className="lead-history-meta">
                              <span>
                                {l.city}, {l.state}, {l.country || 'India'}
                              </span>
                              <span>External ID · {l.external_id || '—'}</span>
                              {l.clientLeadId ? (
                                <span>Client Lead ID · {l.clientLeadId}</span>
                              ) : null}
                              <span>Interactions · {l.interactions}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No verified leads yet. Run a channel campaign to qualify leads.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
    {historyLead ? (
      <LeadHistoryModal
        lead={historyLead}
        campaignName={historyLead.campaignName}
        onClose={() => setHistoryLead(null)}
      />
    ) : null}
    </>
  )
}
