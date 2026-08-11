/**
 * Map Convin webhook → OUR crm_leads by external_id (CRM id we minted).
 * Convin campaign UUID is NOT our camp-* id — never join on that.
 * Multiple calls for the same external_id append to recordings[] (keyed by call_id / url).
 */

const STATUS_STATE = {
  high_intent: 'High intent',
  moderate_intent: 'Moderate intent',
  low_intent: 'Low intent',
  in_progress: 'In Progress',
  // legacy DB values
  verified: 'High intent',
  uninterested: 'Low intent',
}

export function normalizeStoredStatus(s) {
  const v = String(s || '')
    .trim()
    .toLowerCase()
    .replace(/ /g, '_')
  if (['verified', 'hot', 'high_intent'].includes(v)) return 'high_intent'
  if (['warm', 'moderate_intent'].includes(v)) return 'moderate_intent'
  if (['uninterested', 'cold', 'low_intent', 'not_interested'].includes(v)) return 'low_intent'
  if (['high_intent', 'moderate_intent', 'low_intent', 'in_progress'].includes(v)) return v
  return 'in_progress'
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

  // Append — never replace — so multiple calls per external_id are kept
  if (!already && (normalized.recording_url || durationSec > 0 || normalized.transcript)) {
    recordings.push({
      id: String(callId),
      timestamp: String(at).slice(0, 19).replace('T', ' '),
      durationSec,
      outcome:
        normalized.call_status === 'completed'
          ? 'completed'
          : normalized.call_status || 'completed',
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
        normalized.interest_level ? `Interest ${normalized.interest_level}` : null,
        normalized.campaign_name ? `Campaign ${normalized.campaign_name}` : null,
        normalized.call_status,
        durationSec ? `${durationSec}s` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      transcript: normalized.transcript || undefined,
      recordingUrl: normalized.recording_url || undefined,
      attemptNumber: Number(normalized.call_attempts) || recordings.length || 1,
    })
  }

  const talkSeconds = recordings.reduce((s, r) => s + (Number(r.durationSec) || 0), 0)
  const entities = {
    ...(prev.extractedEntities || {}),
    ...(normalized.extracted_entities || {}),
  }

  return {
    ...prev,
    lastWebhookAt: new Date().toISOString(),
    interest_level: normalized.interest_level,
    interest_level_reason: normalized.interest_level_reason,
    qualification_status: normalized.qualification_status,
    qualification_reason: normalized.qualification_reason,
    goal_achieved: normalized.goal_achieved,
    goal_achieved_reason: normalized.goal_achieved_reason,
    call_attempts: normalized.call_attempts,
    call_status: normalized.call_status,
    recording_url: normalized.recording_url,
    transcript: normalized.transcript,
    duration_sec: durationSec || prev.duration_sec,
    agent_name: normalized.agent_name,
    interestLevel: normalized.interest_level ?? prev.interestLevel,
    interestLevelReason:
      normalized.interest_level_reason ?? prev.interestLevelReason,
    qualificationStatus:
      normalized.qualification_status ?? prev.qualificationStatus,
    qualificationReason:
      normalized.qualification_reason ?? prev.qualificationReason,
    goalAchieved:
      normalized.goal_achieved != null
        ? Boolean(normalized.goal_achieved)
        : prev.goalAchieved,
    goalAchievedReason:
      normalized.goal_achieved_reason ?? prev.goalAchievedReason,
    extractedEntities: entities,
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
    lastConnectedAt:
      normalized.last_connected_at || (durationSec > 0 ? at : prev.lastConnectedAt),
    lastConnectedChannel: 'voicebot',
    agentName: normalized.agent_name || prev.agentName,
    verified:
      client_status === 'high_intent' || client_status === 'verified'
        ? true
        : Boolean(prev.verified),
    verifiedChannels:
      client_status === 'high_intent' || client_status === 'verified'
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

  const nested = asObj(r.raw)
  const entities = {
    ...(typeof r.extracted_entities === 'object' && r.extracted_entities
      ? r.extracted_entities
      : {}),
    ...(typeof r.extractedEntities === 'object' && r.extractedEntities
      ? r.extractedEntities
      : {}),
  }
  for (const src of [r, nested]) {
    for (const k of ['jee_percentile', '12th_percentage', 'tenth_percentage', 'neet_score', 'budget']) {
      if (src[k] != null && String(src[k]).trim() !== '' && entities[k] == null) {
        entities[k] = String(src[k])
      }
    }
  }

  return {
    callAttempts,
    callConnected:
      Number(r.callConnected ?? 0) || (recordings.some((x) => x.durationSec > 0) ? 1 : 0),
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
    interestLevel: r.interestLevel || r.interest_level || undefined,
    interestLevelReason: r.interestLevelReason || r.interest_level_reason || undefined,
    qualificationStatus: r.qualificationStatus || r.qualification_status || undefined,
    qualificationReason: r.qualificationReason || r.qualification_reason || undefined,
    goalAchieved:
      r.goalAchieved != null
        ? Boolean(r.goalAchieved)
        : r.goal_achieved != null
          ? Boolean(r.goal_achieved)
          : undefined,
    goalAchievedReason: r.goalAchievedReason || r.goal_achieved_reason || undefined,
    extractedEntities: entities,
  }
}

export { STATUS_STATE }
