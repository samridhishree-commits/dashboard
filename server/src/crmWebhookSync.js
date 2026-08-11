/**
 * Map Convin webhook → OUR crm_leads by external_id (CRM id we minted).
 * Convin campaign UUID is NOT our camp-* id — never join on that.
 * Multiple calls for the same external_id append to recordings[] (keyed by call_id).
 * webhook_events is the durable log of every call; recordings[] is rebuilt from it on read.
 */

const STATUS_STATE = {
  high_intent: 'High intent',
  moderate_intent: 'Moderate intent',
  low_intent: 'Low intent',
  in_progress: 'In Progress',
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

/** Strip signed-url query so the same audio file matches across webhook retries. */
export function recordingUrlKey(url) {
  if (!url) return ''
  try {
    const u = new URL(String(url))
    return `${u.origin}${u.pathname}`
  } catch {
    return String(url).split('?')[0]
  }
}

/** Build one recording from a webhook_events row. Prefer top-level call fields;
 * only use last_call_details when it matches this call_id (avoids replaying old audio). */
export function recordingFromWebhookPayload(payload, fallbackId = '', receivedAt = '') {
  const body = asObj(payload)
  const { _meta, ...p } = body
  const last = p.last_call_details || {}
  const topCallId = p.call_id ? String(p.call_id) : ''
  const lastCallId = last.last_call_id ? String(last.last_call_id) : ''
  const lastMatches = !topCallId || !lastCallId || topCallId === lastCallId

  const callId = topCallId || lastCallId || fallbackId || `wh-${p.timestamp || Date.now()}`
  const durationSec =
    Number(
      p.duration_sec != null
        ? p.duration_sec
        : lastMatches
          ? last.last_call_duration_sec
          : 0,
    ) || 0
  const url =
    p.recording_url ||
    (lastMatches ? last.last_call_recording_url : undefined) ||
    undefined
  const transcript =
    p.transcript ||
    (lastMatches ? last.last_call_transcript : undefined) ||
    undefined

  // Prefer webhook_events.received_at so UI matches the DB log exactly.
  const at = receivedAt || p.timestamp || p.call_end_time || new Date().toISOString()

  if (!url && !durationSec && !transcript) return null

  return {
    id: String(callId),
    timestamp: String(at).replace('T', ' ').replace(/\.\d+/, '').slice(0, 19),
    durationSec,
    outcome: p.call_status === 'completed' ? 'completed' : p.call_status || 'completed',
    url,
    transcript,
    answeredBy: p.agent_name || undefined,
  }
}

/**
 * Merge recordings uniquely by recording file URL (same audio = one call),
 * then by call_id. Never keep two cards for the same audio under different ids.
 */
export function mergeRecordings(...lists) {
  const byId = new Map()
  const byUrl = new Map()
  const out = []

  const richer = (a, b) => {
    const score = (r) =>
      (r.url ? 4 : 0) + (r.transcript ? 2 : 0) + (Number(r.durationSec) > 0 ? 1 : 0)
    return score(b) >= score(a) ? { ...a, ...b, url: b.url || a.url, transcript: b.transcript || a.transcript } : { ...b, ...a, url: a.url || b.url, transcript: a.transcript || b.transcript }
  }

  const add = (r) => {
    if (!r || (!r.id && !r.url && !r.durationSec && !r.transcript)) return
    const id = r.id ? String(r.id) : ''
    const urlKey = recordingUrlKey(r.url)

    if (urlKey && byUrl.has(urlKey)) {
      const prev = byUrl.get(urlKey)
      const merged = richer(prev, r)
      // Keep earlier call id if both exist; timestamp: prefer later event
      if (String(r.timestamp || '') > String(prev.timestamp || '')) {
        merged.timestamp = r.timestamp
      }
      byUrl.set(urlKey, merged)
      if (prev.id) byId.set(String(prev.id), merged)
      if (merged.id) byId.set(String(merged.id), merged)
      const idx = out.findIndex(
        (x) =>
          x === prev ||
          (urlKey && recordingUrlKey(x.url) === urlKey) ||
          (prev.id && x.id === prev.id),
      )
      if (idx >= 0) out[idx] = merged
      return
    }

    if (id && byId.has(id)) {
      const prev = byId.get(id)
      const merged = richer(prev, r)
      byId.set(id, merged)
      if (urlKey) byUrl.set(urlKey, merged)
      const idx = out.findIndex((x) => x.id === id)
      if (idx >= 0) out[idx] = merged
      return
    }

    const row = { ...r, id: id || `rec-${out.length + 1}` }
    out.push(row)
    if (row.id) byId.set(String(row.id), row)
    if (urlKey) byUrl.set(urlKey, row)
  }

  for (const list of lists) {
    if (Array.isArray(list)) list.forEach(add)
  }

  out.sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')))
  return out
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

  const incoming = {
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
  }

  const recordings = mergeRecordings(
    prev.recordings,
    normalized.recording_url || durationSec > 0 || normalized.transcript ? [incoming] : [],
  )

  const channelHistory = Array.isArray(prev.channelHistory) ? [...prev.channelHistory] : []
  const nonCallHistory = channelHistory.filter(
    (e) => e.event !== 'call_attempt' && e.event !== 'call.analysis_completed',
  )

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
    call_attempts: Math.max(
      Number(normalized.call_attempts) || 0,
      Number(prev.callAttempts) || 0,
      recordings.length,
    ),
    call_status: normalized.call_status,
    recording_url: normalized.recording_url,
    transcript: normalized.transcript,
    duration_sec: durationSec || prev.duration_sec,
    agent_name: normalized.agent_name,
    interestLevel: normalized.interest_level ?? prev.interestLevel,
    interestLevelReason: normalized.interest_level_reason ?? prev.interestLevelReason,
    qualificationStatus: normalized.qualification_status ?? prev.qualificationStatus,
    qualificationReason: normalized.qualification_reason ?? prev.qualificationReason,
    goalAchieved:
      normalized.goal_achieved != null
        ? Boolean(normalized.goal_achieved)
        : prev.goalAchieved,
    goalAchievedReason: normalized.goal_achieved_reason ?? prev.goalAchievedReason,
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
    channelHistory: nonCallHistory,
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
 * @param extraRecordings recordings rebuilt from webhook_events (source of truth for multi-call)
 */
export function hydrateLeadFields(raw = {}, extraRecordings = []) {
  const r = asObj(raw)
  // Prefer explicit extras (usually rebuilt from webhook_events). Only fall back to
  // raw.recordings when no extras were provided — never invent a phantom first call.
  let recordings = extraRecordings?.length
    ? mergeRecordings(extraRecordings)
    : mergeRecordings(r.recordings)

  const callAttempts = Math.max(
    Number(r.callAttempts ?? r.call_attempts ?? 0) || 0,
    recordings.length,
  )

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
    for (const k of [
      'jee_percentile',
      '12th_percentage',
      'tenth_percentage',
      'neet_score',
      'budget',
    ]) {
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
    channelHistory: Array.isArray(r.channelHistory)
      ? r.channelHistory.filter(
          (e) => e.event !== 'call_attempt' && e.event !== 'call.analysis_completed',
        )
      : [],
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
