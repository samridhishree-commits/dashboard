/**
 * Map Convin webhook → OUR crm_leads by external_id (CRM id we minted).
 * Convin campaign UUID is NOT our camp-* id — never join on that.
 */

const STATUS_STATE = {
  verified: 'Verified',
  uninterested: 'Not interested',
  in_progress: 'In Progress',
}

function asObj(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return { ...raw }
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/** Build UI-shaped raw patch (camelCase) the frontend Lead type expects. */
export function buildCrmRawPatch(normalized, client_status, existingRaw = {}) {
  const prev = asObj(existingRaw)
  const at =
    normalized.timestamp ||
    normalized.last_connected_at ||
    new Date().toISOString()
  const durationSec = Number(normalized.duration_sec) || 0
  const callId =
    normalized.call_id ||
    normalized.lead_id ||
    `wh-${Date.now()}`

  const recordings = Array.isArray(prev.recordings) ? [...prev.recordings] : []
  const already = recordings.some(
    (r) =>
      (r.id && String(r.id) === String(callId)) ||
      (normalized.recording_url && r.url && r.url === normalized.recording_url),
  )

  if (!already && (normalized.recording_url || durationSec > 0 || normalized.transcript)) {
    recordings.push({
      id: String(callId),
      timestamp: String(at).slice(0, 19).replace('T', ' '),
      durationSec,
      outcome: normalized.call_status === 'completed' ? 'completed' : normalized.call_status || 'completed',
      url: normalized.recording_url || undefined,
      transcript: normalized.transcript || undefined,
      answeredBy: normalized.agent_name || undefined,
    })
  }

  const channelHistory = Array.isArray(prev.channelHistory) ? [...prev.channelHistory] : []
  const histId = `wh-${callId}`
  if (!channelHistory.some((e) => e.id === histId)) {
    channelHistory.push({
      id: histId,
      channel: 'voicebot',
      at: String(at).slice(0, 19).replace('T', ' '),
      event: normalized.event || 'call_attempt',
      status: normalized.call_status || client_status,
      durationSec: durationSec || undefined,
      detail: [
        normalized.campaign_name ? `Campaign ${normalized.campaign_name}` : null,
        normalized.call_status,
        durationSec ? `${durationSec}s` : null,
        client_status,
      ]
        .filter(Boolean)
        .join(' · '),
      transcript: normalized.transcript || undefined,
      recordingUrl: normalized.recording_url || undefined,
      attemptNumber: Number(normalized.call_attempts) || recordings.length || 1,
    })
  }

  const talkSeconds = recordings.reduce((s, r) => s + (Number(r.durationSec) || 0), 0)

  return {
    ...prev,
    lastWebhookAt: new Date().toISOString(),
    interest_level: normalized.interest_level,
    qualification_status: normalized.qualification_status,
    goal_achieved: normalized.goal_achieved,
    call_attempts: normalized.call_attempts,
    call_status: normalized.call_status,
    recording_url: normalized.recording_url,
    transcript: normalized.transcript,
    duration_sec: durationSec || prev.duration_sec,
    agent_name: normalized.agent_name,
    callAttempts: Math.max(
      Number(prev.callAttempts) || 0,
      Number(normalized.call_attempts) || 0,
      recordings.length,
    ),
    callConnected: Math.max(
      Number(prev.callConnected) || 0,
      durationSec > 0 || normalized.call_status === 'completed' ? 1 : 0,
    ),
    interactions: Math.max(Number(prev.interactions) || 0, recordings.length, 1),
    lastActivity: String(at).slice(0, 19).replace('T', ' '),
    recordings,
    channelHistory,
    talkSeconds,
    lastConnectedAt: normalized.last_connected_at || (durationSec > 0 ? at : prev.lastConnectedAt),
    lastConnectedChannel: 'voicebot',
    agentName: normalized.agent_name || prev.agentName,
    verified: client_status === 'verified' ? true : Boolean(prev.verified),
    verifiedChannels:
      client_status === 'verified'
        ? Array.from(new Set([...(prev.verifiedChannels || []), 'voicebot']))
        : prev.verifiedChannels || [],
  }
}

/**
 * Hydrate Lead JSON from crm_leads.raw (supports snake_case leftovers + camelCase).
 */
export function hydrateLeadFields(raw = {}) {
  const r = asObj(raw)
  let recordings = Array.isArray(r.recordings) ? r.recordings : []
  if (!recordings.length && (r.recording_url || r.transcript || r.duration_sec)) {
    recordings = [
      {
        id: 'legacy-wh',
        timestamp: r.lastWebhookAt || r.lastActivity || '',
        durationSec: Number(r.duration_sec) || 0,
        outcome: r.call_status || 'completed',
        url: r.recording_url || undefined,
        transcript: r.transcript || undefined,
        answeredBy: r.agent_name || r.agentName || undefined,
      },
    ]
  }

  const callAttempts = Number(r.callAttempts ?? r.call_attempts ?? 0) || recordings.length || 0

  return {
    callAttempts,
    callConnected: Number(r.callConnected ?? 0) || (recordings.some((x) => x.durationSec > 0) ? 1 : 0),
    interactions: Number(r.interactions ?? 0) || callAttempts,
    lastActivity: r.lastActivity || '',
    recordings,
    channelHistory: Array.isArray(r.channelHistory) ? r.channelHistory : [],
    lastConnectedAt: r.lastConnectedAt || undefined,
    lastConnectedChannel: r.lastConnectedChannel || undefined,
    agentName: r.agentName || r.agent_name || undefined,
    talkSeconds:
      Number(r.talkSeconds) ||
      recordings.reduce((s, x) => s + (Number(x.durationSec) || 0), 0),
    verified: Boolean(r.verified),
    verifiedChannels: r.verifiedChannels || [],
    verificationHistory: r.verificationHistory || [],
    voicebotNote: r.voicebotNote,
  }
}

export { STATUS_STATE }
