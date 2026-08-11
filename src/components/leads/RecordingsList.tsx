import { useState } from 'react'
import type { CallRecording } from '../../types'
import { formatWhen } from '../../utils/formatWhen'

export function RecordingsList({
  recordings,
  emptyLabel = 'No recordings yet for this lead.',
}: {
  recordings: CallRecording[]
  emptyLabel?: string
}) {
  const [openTranscriptId, setOpenTranscriptId] = useState<string | null>(null)
  /** Only one native player active at a time (pause others). */
  const [activeId, setActiveId] = useState<string | null>(null)

  if (!recordings.length) {
    return (
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="lifecycle-rec-list">
      <p className="lifecycle-rec-count muted">
        {recordings.length} recording{recordings.length === 1 ? '' : 's'}
        {recordings.length > 1 ? ' · same lead, multiple calls' : ''}
      </p>
      {recordings.map((r, i) => {
        const showTranscript = openTranscriptId === r.id
        const canPlay = Boolean(r.url)
        const isActive = activeId === r.id
        return (
          <article
            key={r.id}
            className={`lifecycle-rec-card ${isActive ? 'is-playing' : ''}`}
          >
            <div className="lifecycle-rec-top">
              <span className="lifecycle-rec-n">#{i + 1}</span>
              <div className="lifecycle-rec-meta">
                <strong>{formatWhen(r.timestamp) || `Call ${i + 1}`}</strong>
                <span>
                  <em className="lifecycle-status">{r.outcome.replace('_', ' ')}</em>
                  <span className="muted"> · {r.durationSec}s</span>
                  {r.answeredBy ? <span className="muted"> · {r.answeredBy}</span> : null}
                </span>
                {r.failureReason ? (
                  <span className="lifecycle-rec-fail">{r.failureReason}</span>
                ) : null}
              </div>
            </div>

            {canPlay ? (
              <div className="lifecycle-rec-player">
                <audio
                  src={r.url}
                  controls
                  preload="none"
                  style={{ width: '100%' }}
                  onPlay={(e) => {
                    setActiveId(r.id)
                    // Pause every other audio on the page so only one plays
                    const el = e.currentTarget
                    document.querySelectorAll('audio').forEach((a) => {
                      if (a !== el) a.pause()
                    })
                  }}
                  onPause={() => {
                    if (activeId === r.id) setActiveId(null)
                  }}
                  onEnded={() => setActiveId(null)}
                >
                  <a href={r.url} target="_blank" rel="noreferrer">
                    Open recording
                  </a>
                </audio>
              </div>
            ) : (
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                Recording link not available for this call.
              </p>
            )}

            {r.transcript ? (
              <div className="lifecycle-rec-transcript-wrap">
                <button
                  type="button"
                  className="linkish"
                  onClick={() => setOpenTranscriptId(showTranscript ? null : r.id)}
                >
                  {showTranscript ? 'Hide transcript' : 'Show transcript'}
                </button>
                {showTranscript ? (
                  <blockquote className="lifecycle-transcript">{r.transcript}</blockquote>
                ) : null}
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
