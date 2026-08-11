import type { ReactNode } from 'react'
import { Modal } from '../ui/Modal'
import { RecordingsList } from './RecordingsList'
import type { Channel, Lead } from '../../types'
import {
  channelLifecycleLabels,
  channelsTouched,
  getChannelHistory,
  normalizeClientStatus,
  statusLabel,
} from '../../utils/lifecycle'
import { channelAttemptCount } from '../../utils/lifecycle'
import { formatWhen } from '../../utils/formatWhen'

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

function outcomeLabel(outcome?: string) {
  if (!outcome) return 'Unknown'
  return outcome.replace(/_/g, ' ')
}

function CompactMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="lead-compact-meta">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  )
}

function ObservationsBlock({ lead }: { lead: Lead }) {
  const entities = lead.extractedEntities || {}
  const entityEntries = Object.entries(entities).filter(
    ([, v]) => v != null && String(v).trim() !== '',
  )
  const observations = [
    lead.goalAchievedReason,
    lead.qualificationReason,
  ].filter((t) => t && String(t).trim())

  if (!lead.interestLevel && !observations.length && !entityEntries.length) return null

  return (
    <section className="lead-hist-section lead-hist-section-flat">
      <div className="lead-interest-row">
        <span className="muted">Interest</span>
        <span className={`status-pill status-${normalizeClientStatus(lead.clientStatus)}`}>
          {lead.interestLevel || statusLabel(lead)}
        </span>
      </div>

      {observations.length ? (
        <div className="lead-observation-card">
          <h4 className="lead-hist-h" style={{ marginBottom: 8 }}>
            Observation from call on lead till now
          </h4>
          <ul className="lead-observation-list">
            {observations.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {entityEntries.length ? (
        <div className="lead-entity-inline">
          {entityEntries.map(([k, v]) => (
            <span key={k} className="lead-entity-chip">
              <em>{entityLabel(k)}</em>
              <strong>{v}</strong>
            </span>
          ))}
        </div>
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
    ? `${lead.first_name} ${lead.last_name} · ${channelLifecycleLabels[channel!]}`
    : `${lead.first_name} ${lead.last_name} · Lead history`

  if (isChannelView && channel) {
    const recordings = channel === 'voicebot' ? lead.recordings ?? [] : []
    const attempts = channelAttemptCount(lead, channel)
    const talkSec = recordings.reduce((s, r) => s + (r.durationSec || 0), 0)
    const statusKey = normalizeClientStatus(lead.clientStatus)

    return (
      <Modal title={title} onClose={onClose} xl>
        <div className="lead-hist-modal lead-hist-modal-clean">
          {!lead.phoneValid ? (
            <p className="lifecycle-banner lifecycle-banner-warn">
              Invalid phone — CRM only, not sent to Convin
              {lead.phoneInvalidReason ? ` (${lead.phoneInvalidReason})` : ''}.
            </p>
          ) : null}

          <section className="lead-hist-section lead-hist-section-flat">
            <div className="lead-compact-bar">
              <CompactMeta label="Status">
                <span className={`status-pill status-${statusKey}`}>{statusLabel(lead)}</span>
              </CompactMeta>
              <CompactMeta label="Phone">
                <strong>
                  {lead.phone_number}{' '}
                  {lead.phoneValid ? (
                    <span className="status-pill status-completed">Valid</span>
                  ) : (
                    <span className="status-pill status-failed">Invalid</span>
                  )}
                </strong>
              </CompactMeta>
              <CompactMeta label="External ID">
                <code className="ext-id-code">{lead.external_id}</code>
              </CompactMeta>
              <CompactMeta label="Campaign">
                <strong>{campaignName || '—'}</strong>
              </CompactMeta>
              <CompactMeta label="Calls">
                <strong>
                  {attempts} · {talkSec ? `${talkSec}s talk` : 'no talk yet'}
                </strong>
              </CompactMeta>
            </div>
          </section>

          <ObservationsBlock lead={lead} />

          <section className="lead-hist-section lead-hist-section-flat">
            <h4 className="lead-hist-h">
              {channelLifecycleLabels[channel]} history
              {recordings.length ? (
                <span className="lifecycle-ch-count">{recordings.length}</span>
              ) : null}
            </h4>

            {channel === 'voicebot' && recordings.length ? (
              <div className="lead-call-stack">
                {recordings.map((r, i) => (
                  <article key={r.id} className="lead-call-item">
                    <div className="lead-call-item-head">
                      <div>
                        <strong>
                          Call attempt {i + 1}
                          <span className="lifecycle-status">{outcomeLabel(r.outcome)}</span>
                        </strong>
                        <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                          {formatWhen(r.timestamp)}
                          {r.durationSec != null ? ` · ${r.durationSec}s` : ''}
                          {r.answeredBy ? ` · ${r.answeredBy}` : ''}
                        </p>
                      </div>
                    </div>
                    <RecordingsList recordings={[r]} emptyLabel="No recording URL for this call." />
                  </article>
                ))}
              </div>
            ) : (
              (() => {
                const events = getChannelHistory(lead, channel)
                if (!events.length) {
                  return (
                    <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                      No {channelLifecycleLabels[channel]} activity yet.
                    </p>
                  )
                }
                return (
                  <ol className="lead-history-list">
                    {events.map((ev) => (
                      <li key={ev.id}>
                        <span className="lead-history-dot" />
                        <div>
                          <div className="lead-history-title">
                            {ev.event.replace(/_/g, ' ')}
                            {ev.status ? (
                              <span className="lifecycle-status">
                                {outcomeLabel(ev.status)}
                              </span>
                            ) : null}
                            <time>{formatWhen(ev.at)}</time>
                          </div>
                          {ev.detail ? <p>{ev.detail}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                )
              })()
            )}
          </section>

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
    <Modal title={title} onClose={onClose} xl>
      <div className="lead-hist-modal lead-hist-modal-clean">
        <section className="lead-hist-section lead-hist-section-flat">
          <div className="lead-compact-bar">
            <CompactMeta label="Phone">
              <strong>
                {lead.phone_number}{' '}
                {lead.phoneValid ? (
                  <span className="status-pill status-completed">Valid</span>
                ) : (
                  <span className="status-pill status-failed">Invalid</span>
                )}
              </strong>
            </CompactMeta>
            <CompactMeta label="External ID">
              <code className="ext-id-code">{lead.external_id}</code>
            </CompactMeta>
            <CompactMeta label="Campaign">
              <strong>{campaignName || '—'}</strong>
            </CompactMeta>
            <CompactMeta label="Status">
              <span className={`status-pill status-${normalizeClientStatus(lead.clientStatus)}`}>
                {statusLabel(lead)}
              </span>
            </CompactMeta>
          </div>
        </section>

        <ObservationsBlock lead={lead} />

        {touched.map((ch) => {
          const channelRecordings = ch === 'voicebot' ? lead.recordings ?? [] : []
          return (
            <section key={ch} className="lead-hist-section lead-hist-section-flat">
              <h4 className="lead-hist-h">{channelLifecycleLabels[ch]}</h4>
              {ch === 'voicebot' && channelRecordings.length ? (
                <div className="lead-call-stack">
                  {channelRecordings.map((r, i) => (
                    <article key={r.id} className="lead-call-item">
                      <div className="lead-call-item-head">
                        <strong>
                          Call attempt {i + 1}
                          <span className="lifecycle-status">{outcomeLabel(r.outcome)}</span>
                        </strong>
                        <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                          {formatWhen(r.timestamp)}
                          {r.durationSec != null ? ` · ${r.durationSec}s` : ''}
                          {r.answeredBy ? ` · ${r.answeredBy}` : ''}
                        </p>
                      </div>
                      <RecordingsList recordings={[r]} />
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                  No call recordings yet.
                </p>
              )}
            </section>
          )
        })}
      </div>
    </Modal>
  )
}
