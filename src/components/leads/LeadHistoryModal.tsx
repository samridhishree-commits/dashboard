import { Modal } from '../ui/Modal'
import { RecordingsList } from './RecordingsList'
import type { Channel, Lead } from '../../types'
import {
  channelLifecycleLabels,
  channelsTouched,
  clientStatusHints,
  currentStateLabel,
  getChannelHistory,
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
              Simple CRM status for clients: <strong>Verified</strong>, <strong>Uninterested</strong>
              , or <strong>In Progress</strong>.
            </p>
          )}

          <div className="lead-hist-summary lifecycle-metrics">
            <div>
              <span className="muted">Status</span>
              <strong>
                <span className={`status-pill status-${lead.clientStatus}`}>{statusLabel(lead)}</span>
              </strong>
              <span className="muted" style={{ marginTop: 4 }}>
                {clientStatusHints[lead.clientStatus]}
              </span>
            </div>
            <div>
              <span className="muted">Current state</span>
              <strong>{currentStateLabel(lead)}</strong>
            </div>
            <div>
              <span className="muted">Phone</span>
              <strong>
                {lead.phone_number}{' '}
                {lead.phoneValid ? (
                  <span className="status-pill status-completed">Valid</span>
                ) : (
                  <span className="status-pill status-failed">Invalid</span>
                )}
              </strong>
            </div>
            <div>
              <span className="muted">External ID (CRM)</span>
              <strong>
                <code className="ext-id-code">{lead.external_id}</code>
              </strong>
            </div>
            <div>
              <span className="muted">Client Lead ID</span>
              <strong>{lead.clientLeadId || '—'}</strong>
            </div>
            <div>
              <span className="muted">
                {channel === 'voicebot' ? 'Call attempts' : 'Message attempts'}
              </span>
              <strong>{lead.phoneValid ? attempts : '—'}</strong>
            </div>
            <div>
              <span className="muted">Recordings</span>
              <strong>{channel === 'voicebot' ? recordings.length : '—'}</strong>
            </div>
            <div>
              <span className="muted">Last connected</span>
              <strong>
                {lead.lastConnectedAt
                  ? `${lead.lastConnectedAt}${
                      lead.lastConnectedChannel
                        ? ` · ${channelLifecycleLabels[lead.lastConnectedChannel]}`
                        : ''
                    }`
                  : '—'}
              </strong>
            </div>
            <div>
              <span className="muted">Campaign</span>
              <strong>{campaignName || '—'}</strong>
            </div>
          </div>

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
                      <time>{ev.at}</time>
                    </div>
                    {ev.detail ? <p>{ev.detail}</p> : null}
                    {ev.durationSec != null ? (
                      <p className="muted" style={{ margin: '2px 0 0' }}>
                        Duration {ev.durationSec}s
                        {ev.event === 'call_attempt' ? ' · see recordings below' : ''}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
              No {channelLifecycleLabels[channel]} touches yet for this lead.
            </p>
          )}

          {channel === 'voicebot' ? (
            <>
              <h4 className="lead-hist-h">
                Call recordings
                <span className="lifecycle-ch-count">{recordings.length}</span>
              </h4>
              <RecordingsList recordings={recordings} />
              {lastCall ? (
                <>
                  <h4 className="lead-hist-h">Last call details</h4>
                  <div className="lead-hist-summary">
                    <div>
                      <span className="muted">Status</span>
                      <strong>{lastCall.outcome.replace('_', ' ')}</strong>
                    </div>
                    <div>
                      <span className="muted">Duration</span>
                      <strong>{lastCall.durationSec}s</strong>
                    </div>
                    <div>
                      <span className="muted">When</span>
                      <strong>{lastCall.timestamp}</strong>
                    </div>
                    <div>
                      <span className="muted">Answered by</span>
                      <strong>{lastCall.answeredBy || '—'}</strong>
                    </div>
                  </div>
                </>
              ) : null}
            </>
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
        <div className="lead-hist-summary">
          <div>
            <span className="muted">Phone</span>
            <strong>
              {lead.phone_number}{' '}
              {lead.phoneValid ? (
                <span className="status-pill status-completed">Valid</span>
              ) : (
                <span className="status-pill status-failed">Invalid</span>
              )}
            </strong>
          </div>
          <div>
            <span className="muted">External ID (CRM)</span>
            <strong>
              <code className="ext-id-code">{lead.external_id}</code>
            </strong>
          </div>
          <div>
            <span className="muted">Client Lead ID</span>
            <strong>{lead.clientLeadId || '—'}</strong>
          </div>
          <div>
            <span className="muted">Campaign</span>
            <strong>{campaignName || '—'}</strong>
          </div>
          <div>
            <span className="muted">Status</span>
            <strong>
              <span className={`status-pill status-${lead.clientStatus}`}>{statusLabel(lead)}</span>
            </strong>
          </div>
        </div>

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

        {touched.map((ch) => {
          const events = getChannelHistory(lead, ch)
          const channelRecordings = ch === 'voicebot' ? lead.recordings ?? [] : []
          return (
            <div key={ch} className="lifecycle-channel-block">
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
                          <time>{ev.at}</time>
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
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
