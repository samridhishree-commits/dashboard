import { Archive, Phone, CheckCircle2, Ban, Loader } from 'lucide-react'
import type { Lead } from '../../types'
import { clientStatusHints, statusLabel } from '../../utils/lifecycle'

function StatusIcon({ status }: { status: Lead['clientStatus'] }) {
  if (status === 'verified') return <CheckCircle2 size={12} />
  if (status === 'uninterested') return <Ban size={12} />
  return <Loader size={12} />
}

export function LeadMiniCard({
  lead,
  active,
  onClick,
}: {
  lead: Lead
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className={`lead-mini ${active ? 'active' : ''} ${lead.archived ? 'archived' : ''} ${
        lead.phoneValid ? '' : 'lead-mini-invalid'
      }`}
      onClick={onClick}
    >
      <div className="lead-mini-top">
        <span className="lead-mini-name">
          {lead.first_name} {lead.last_name}
        </span>
        <span className={`status-pill status-${lead.clientStatus}`} title={clientStatusHints[lead.clientStatus]}>
          <StatusIcon status={lead.clientStatus} /> {statusLabel(lead)}
        </span>
      </div>
      <div className="lead-mini-phone">
        {lead.phone_number}
        {!lead.phoneValid ? ' · invalid' : ''}
      </div>
      <div className="lead-mini-meta">
        <span title="External ID (CRM)">{lead.external_id}</span>
        {lead.clientLeadId ? <span title="Client Lead ID">{lead.clientLeadId}</span> : null}
        <span title="Call attempts">
          <Phone size={11} style={{ verticalAlign: -1 }} /> {lead.callAttempts}
        </span>
        <span>Last: {lead.lastActivity}</span>
      </div>
    </button>
  )
}

export function LeadDetailPanel({
  lead,
  onArchive,
  showVoicebotExtras,
}: {
  lead: Lead
  onArchive?: () => void
  showVoicebotExtras?: boolean
}) {
  return (
    <div className="lead-detail-pane">
      <div className="lead-detail-head">
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>
            {lead.first_name} {lead.last_name}
          </h3>
          <div className="stack-h">
            <span className={`status-pill status-${lead.clientStatus}`}>{statusLabel(lead)}</span>
            {lead.phoneValid ? (
              <span className="status-pill status-completed">Valid phone</span>
            ) : (
              <span className="status-pill status-failed">Invalid phone</span>
            )}
            {lead.archived ? <span className="status-pill status-draft">Archived</span> : null}
          </div>
        </div>
        {onArchive && !lead.archived ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onArchive} title="Archive lead">
            <Archive size={14} /> Archive
          </button>
        ) : null}
      </div>

      <div className="detail-grid">
        <div>
          <span>Phone</span>
          <strong>{lead.phone_number}</strong>
        </div>
        <div>
          <span>Email</span>
          <strong>{lead.email || '—'}</strong>
        </div>
        <div>
          <span>External ID (CRM)</span>
          <strong>{lead.external_id}</strong>
        </div>
        <div>
          <span>Client Lead ID</span>
          <strong>{lead.clientLeadId || '—'}</strong>
        </div>
        <div>
          <span>Course</span>
          <strong>{lead.course}</strong>
        </div>
        <div>
          <span>City / State</span>
          <strong>
            {lead.city}, {lead.state}
          </strong>
        </div>
        <div>
          <span>Created</span>
          <strong>{lead.createdAt}</strong>
        </div>
        <div>
          <span>Call attempts</span>
          <strong>
            {lead.callAttempts}
            {lead.callConnected ? ` · ${lead.callConnected} connected` : ''}
          </strong>
        </div>
        <div>
          <span>Last activity</span>
          <strong>{lead.lastActivity}</strong>
        </div>
      </div>

      {lead.voicebotNote ? <p className="muted">{lead.voicebotNote}</p> : null}

      {showVoicebotExtras ? (
        <>
          <h4 style={{ fontSize: 13, margin: '0 0 8px' }}>Call recordings</h4>
          {lead.recordings.length ? (
            <div className="recording-list">
              {lead.recordings.map((r) => (
                <div className="recording-row" key={r.id}>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text)' }}>{r.timestamp}</strong>
                    <span className="muted">
                      {r.outcome.replace('_', ' ')} · {r.durationSec}s
                    </span>
                  </div>
                  <a href={r.url || '#'} onClick={(e) => e.preventDefault()}>
                    Play
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ padding: 16 }}>
              No recordings yet — run voicebot campaign to generate call logs.
            </div>
          )}
        </>
      ) : (
        <div className="empty" style={{ padding: 16 }}>
          Lead ready for L1 qualification. Run a channel (Voicebot) to attempt calls and attach
          recordings.
        </div>
      )}
    </div>
  )
}
