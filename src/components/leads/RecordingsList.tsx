import { useState } from 'react'
import { Pause, Play } from 'lucide-react'
import type { CallRecording } from '../../types'

export function RecordingsList({
  recordings,
  emptyLabel = 'No recordings yet for this lead.',
}: {
  recordings: CallRecording[]
  emptyLabel?: string
}) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [openTranscriptId, setOpenTranscriptId] = useState<string | null>(null)

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
      </p>
      {recordings.map((r, i) => {
        const playing = playingId === r.id
        const showTranscript = openTranscriptId === r.id
        return (
          <article key={r.id} className={`lifecycle-rec-card ${playing ? 'is-playing' : ''}`}>
            <div className="lifecycle-rec-top">
              <span className="lifecycle-rec-n">#{i + 1}</span>
              <div className="lifecycle-rec-meta">
                <strong>{r.timestamp}</strong>
                <span>
                  <em className="lifecycle-status">{r.outcome.replace('_', ' ')}</em>
                  <span className="muted"> · {r.durationSec}s</span>
                  {r.answeredBy ? <span className="muted"> · {r.answeredBy}</span> : null}
                </span>
                {r.failureReason ? (
                  <span className="lifecycle-rec-fail">{r.failureReason}</span>
                ) : null}
              </div>
              <button
                type="button"
                className={`btn btn-sm ${playing ? 'btn-outline' : 'btn-primary'}`}
                onClick={() => setPlayingId(playing ? null : r.id)}
                aria-label={playing ? `Pause recording ${i + 1}` : `Play recording ${i + 1}`}
              >
                {playing ? <Pause size={13} /> : <Play size={13} />}
                {playing ? 'Pause' : 'Play'}
              </button>
            </div>

            {playing ? (
              <div className="lifecycle-rec-player" aria-live="polite">
                <div className="lifecycle-rec-wave" />
                <span className="muted">Playing demo recording {i + 1}…</span>
              </div>
            ) : null}

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
