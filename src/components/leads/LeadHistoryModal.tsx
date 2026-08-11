import type { ReactNode } from 'react'
import { Modal } from '../ui/Modal'
import { RecordingsList } from './RecordingsList'
import type { Channel, Lead } from '../../types'
import {
  channelLifecycleLabels,
  channelsTouched,
  clientStatusHints,
  currentStateLabel,
  getChannelHistory,
  normalizeClientStatus,
  statusLabel,
} from '../../utils/lifecycle'
import { channelAttemptCount } from '../../utils/lifecycle'

function eventTitle(event: string, attemptNumber?: number) {
  if (event === 'call_attempt') return `Call attempt${attemptNumber ? ` ${attemptNumber}` : ''}`
  if (event === 'message_sent') return 'Message sent'
  if (event === 'delivered') return 'Delivered'
  if (event === 'verified') return 'Verified'
  if (event === 'failed') return 'Failed'
  if (event === 'callback_requested') return 'Callback requested'
  return event.replace(/_/g, ' ')
}

function formatWhen(ts?: string) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) {
    return String(ts).replace('T', ' ').replace(/\.\d+Z?$/, '').slice(0, 19)
  }
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function entityLabel(key: string) {
  const map: Record<string, string> = {
    jee_percentile: 'JEE percentile',
    '12th_percentage': '12th percentage',
    tenth_percentage: '10th percentage',
    neet_score: 'NEET score',
    budget: 'Budget',
  }
  if (map[key]) return map[key]
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function displayCurrentState(lead: Lead) {
  const raw = (lead.currentState || '').toLowerCase()
  if (!raw) return currentStateLabel(lead)
  if (raw.includes('uninterest') || raw === 'not interested') {
    return statusLabel({ ...lead, clientStatus: normalizeClientStatus(lead.clientStatus) })
  }
  if (raw === 'verified') return 'High intent'
  return lead.currentState || currentStateLabel(lead)
}

function Metric({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="lead-metric-tile">
      <span className="muted">{label}</span>
      <div className="lead-metric-value">{children}</div>
    </div>
  )
}

function CallAnalysisBlock({ lead }: { lead: Lead }) {
  const entities = lead.extractedEntities || {}
  const entityEntries = Object.entries(entities).filter(([, v]) => v != null && String(v).trim() !== '')
  const hasAnalysis =
    lead.interestLevel ||
    lead.goalAchieved != null ||
    lead.qualificationStatus ||
    entityEntries.length > 0

  if (!hasAnalysis) return null

  return (
    <section className="lead-hist-section">
      <h4 className="lead-hist-h">Call analysis</h4>
      <div className="lead-analysis-grid">
        <div className="lead-analysis-card">
          <span className="muted">Goal achievement</span>
          <strong>
            <span
              className={`status-pill ${
                lead.goalAchieved ? 'status-completed' : 'status-in_progress'
              }`}
            >
              {lead.goalAchieved == null ? '—' : lead.goalAchieved ? 'yes' : 'no'}
            </span>
          </strong>
          {lead.goalAchievedReason ? (
            <p className="lead-analysis-reason">{lead.goalAchievedReason}</p>
          ) : null}
        </div>
        <div className="lead-analysis-card">
          <span className="muted">Lead qualification</span>
          <strong>
            <span className="status-pill status-warm">
              {lead.qualificationStatus || '—'}
            </span>
          </strong>
          {lead.qualificationReason ? (
            <p className="lead-analysis-reason">{lead.qualificationReason}</p>
          ) : null}
        </div>
        <div className="lead-analysis-card">
          <span className="muted">Interest level</span>
          <strong>
            <span className={`status-pill status-${normalizeClientStatus(lead.clientStatus)}`}>
              {lead.interestLevel || statusLabel(lead)}
            </span>
          </strong>
          {lead.interestLevelReason ? (
            <p className="lead-analysis-reason">{lead.interestLevelReason}</p>
          ) : (
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
              Reason appears when Convin sends interest_level_reason
            </p>
          )}
        </div>
      </div>

      {entityEntries.length ? (
        <>
          <h4 className="lead-hist-h" style={{ marginTop: 14 }}>
            Extracted details
          </h4>
          <div className="lead-entity-grid">
            {entityEntries.map(([k, v]) => (
              <div key={k} className="lead-entity-card">
                <span className="muted">{entityLabel(k)}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}

export function LeadHistoryModal({
  lead,
  campaignName,
  channel,
  onClose,
}: {
  lead: Lead
  campaignName?: string
  channel?: Channel
  onClose: () => void
}) {
  const isChannelView = Boolean(channel)
  const title = isChannelView
    ? `${lead.first_name} ${lead.last_name} · ${channelLifecycleLabels[channel!]} lifecycle`
    : `${lead.first_name} ${lead.last_name} · Lead history`

  if (isChannelView && channel) {
    const events = getChannelHistory(lead, channel)
    const recordings = channel === 'voicebot' ? lead.recordings ?? [] : []
    const lastCall = recordings.length ? recordings[recordings.length - 1] : null
    const attempts = channelAttemptCount(lead, channel)
    const talkSec = recordings.reduce((s, r) => s + (r.durationSec || 0), 0)
    const statusKey = normalizeClientStatus(lead.clientStatus)

    return (
      <Modal title={title} onClose={onClose} xl>
        <div className="lead-hist-modal">
          {!lead.phoneValid ? (
            <p className="lifecycle-banner lifecycle-banner-warn">
              Invalid phone — stored in CRM only. This lead is <strong>not sent to Convin</strong>.
              {lead.phoneInvalidReason ? ` (${lead.phoneInvalidReason})` : ''}
            </p>
          ) : (
            <p className="lifecycle-banner">
              Interest from voicebot: <strong>High</strong> (hot), <strong>Moderate</strong>{' '}
              (warm), <strong>Low</strong> (cold / not interested), or <strong>In Progress</strong>.
            </p>
          )}

          <section className="lead-hist-section">
            <div className="lead-metric-grid">
              <Metric label="Status">
                <span className={`status-pill status-${statusKey}`}>{statusLabel(lead)}</span>
                <em className="lead-metric-hint">
                  {clientStatusHints[statusKey] || clientStatusHints.in_progress}
                </em>
              </Metric>
              <Metric label="Current state">
                <strong>{displayCurrentState(lead)}</strong>
              </Metric>
              <Metric label="Phone">
                <strong>
                  {lead.phone_number}{' '}
                  {lead.phoneValid ? (
                    <span className="status-pill status-completed">Valid</span>
                  ) : (
                    <span className="status-pill status-failed">Invalid</span>
                  )}
                </strong>
              </Metric>
              <Metric label="External ID (CRM)">
                <code className="ext-id-code">{lead.external_id}</code>
              </Metric>
              <Metric label="Client Lead ID">
                <strong>{lead.clientLeadId || '—'}</strong>
              </Metric>
              <Metric label={channel === 'voicebot' ? 'Call attempts' : 'Message attempts'}>
                <strong>{lead.phoneValid ? attempts : '—'}</strong>
              </Metric>
              <Metric label="Recordings">
                <strong>{channel === 'voicebot' ? recordings.length : '—'}</strong>
              </Metric>
              <Metric label="Talk time">
                <strong>{talkSec ? `${talkSec}s` : '—'}</strong>
              </Metric>
              <Metric label="Last connected">
                <strong>
                  {lead.lastConnectedAt
                    ? `${formatWhen(lead.lastConnectedAt)}${
                        lead.lastConnectedChannel
                          ? ` · ${channelLifecycleLabels[lead.lastConnectedChannel]}`
                          : ''
                      }`
                    : '—'}
                </strong>
              </Metric>
              <Metric label="Campaign">
                <strong>{campaignName || '—'}</strong>
              </Metric>
            </div>
          </section>

          <CallAnalysisBlock lead={lead} />

          <section className="lead-hist-section">
            <h4 className="lead-hist-h">{channelLifecycleLabels[channel]} history</h4>
            {events.length ? (
              <ol className="lead-history-list">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <span className="lead-history-dot" />
                    <div>
                      <div className="lead-history-title">
                        {eventTitle(ev.event, ev.attemptNumber)}
                        {ev.status ? (
                          <span className="lifecycle-status">{ev.status.replace('_', ' ')}</span>
                        ) : null}
                        <time>{formatWhen(ev.at)}</time>
                      </div>
                      {ev.detail ? <p>{ev.detail}</p> : null}
                      {ev.durationSec != null ? (
                        <p className="muted" style={{ margin: '2px 0 0' }}>
                          Duration {ev.durationSec}s
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                No {channelLifecycleLabels[channel]} touches yet for this lead.
              </p>
            )}
          </section>

          {channel === 'voicebot' ? (
            <section className="lead-hist-section">
              <h4 className="lead-hist-h">
                Call recordings
                <span className="lifecycle-ch-count">{recordings.length}</span>
              </h4>
              <RecordingsList recordings={recordings} />
              {lastCall ? (
                <div className="lead-last-call">
                  <div>
                    <span className="muted">Last call</span>
                    <strong>{lastCall.outcome.replace('_', ' ')}</strong>
                  </div>
                  <div>
                    <span className="muted">Duration</span>
                    <strong>{lastCall.durationSec}s</strong>
                  </div>
                  <div>
                    <span className="muted">When</span>
                    <strong>{formatWhen(lastCall.timestamp)}</strong>
                  </div>
                  <div>
                    <span className="muted">Agent</span>
                    <strong>{lastCall.answeredBy || lead.agentName || '—'}</strong>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <p className="lifecycle-footnote muted">
            {lead.email ? `${lead.email} · ` : ''}
            Agent {lead.agentName || '—'}
          </p>
        </div>
      </Modal>
    )
  }

  const touched = channelsTouched(lead)
  return (
    <Modal title={title} onClose={onClose} large>
      <div className="lead-hist-modal">
        <section className="lead-hist-section">
          <div className="lead-metric-grid">
            <Metric label="Phone">
              <strong>
                {lead.phone_number}{' '}
                {lead.phoneValid ? (
                  <span className="status-pill status-completed">Valid</span>
                ) : (
                  <span className="status-pill status-failed">Invalid</span>
                )}
              </strong>
            </Metric>
            <Metric label="External ID (CRM)">
              <code className="ext-id-code">{lead.external_id}</code>
            </Metric>
            <Metric label="Client Lead ID">
              <strong>{lead.clientLeadId || '—'}</strong>
            </Metric>
            <Metric label="Campaign">
              <strong>{campaignName || '—'}</strong>
            </Metric>
            <Metric label="Status">
              <span className={`status-pill status-${normalizeClientStatus(lead.clientStatus)}`}>
                {statusLabel(lead)}
              </span>
            </Metric>
          </div>
        </section>

        <CallAnalysisBlock lead={lead} />

        <section className="lead-hist-section">
          <h4 className="lead-hist-h">Full lead history</h4>
          <ol className="lead-history-list">
            <li>
              <span className="lead-history-dot" />
              <div>
                <div className="lead-history-title">
                  Lead captured
                  <time>{lead.createdAt}</time>
                </div>
                <p>
                  Source {lead.source || '—'} · {lead.course} · {lead.city}, {lead.state}
                </p>
              </div>
            </li>
          </ol>
        </section>

        {touched.map((ch) => {
          const events = getChannelHistory(lead, ch)
          const channelRecordings = ch === 'voicebot' ? lead.recordings ?? [] : []
          return (
            <section key={ch} className="lead-hist-section lifecycle-channel-block">
              <h4 className="lead-hist-h">
                {channelLifecycleLabels[ch]}
                <span className="lifecycle-ch-count">{events.length}</span>
              </h4>
              {events.length ? (
                <ol className="lead-history-list">
                  {events.map((ev) => (
                    <li key={ev.id}>
                      <span className="lead-history-dot" />
                      <div>
                        <div className="lead-history-title">
                          {eventTitle(ev.event, ev.attemptNumber)}
                          {ev.status ? (
                            <span className="lifecycle-status">{ev.status.replace('_', ' ')}</span>
                          ) : null}
                          <time>{formatWhen(ev.at)}</time>
                        </div>
                        {ev.detail ? <p>{ev.detail}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted" style={{ fontSize: 12 }}>
                  No events on {channelLifecycleLabels[ch]}
                </p>
              )}
              {ch === 'voicebot' ? (
                <>
                  <h4 className="lead-hist-h" style={{ marginTop: 12 }}>
                    Recordings
                    <span className="lifecycle-ch-count">{channelRecordings.length}</span>
                  </h4>
                  <RecordingsList recordings={channelRecordings} />
                </>
              ) : null}
            </section>
          )
        })}
      </div>
    </Modal>
  )
}
