/**
 * Map Convin CRM Push / fetch fields → our CRM clientStatus.
 * Verified (Hot) | Uninterested (Warm/Cold/Not Interested) | In Progress
 */

const HOT = new Set(['hot', 'qualified', 'qualify', 'high'])
const UNINTERESTED = new Set([
  'warm',
  'cold',
  'not interested',
  'not_interested',
  'uninterested',
  'disqualified',
  'no interest',
  'low',
])

function norm(v) {
  if (v == null) return ''
  return String(v).trim().toLowerCase().replace(/_/g, ' ')
}

function truthyGoal(v) {
  if (v === true || v === 1) return true
  if (v === false || v === 0 || v == null) return false
  const s = String(v).trim().toLowerCase()
  return s === 'true' || s === 'yes' || s === '1'
}

/**
 * @returns {'verified' | 'uninterested' | 'in_progress'}
 */
export function mapClientStatus(fields = {}) {
  const interest = norm(fields.interest_level)
  const qualification = norm(fields.qualification_status)
  const goal = truthyGoal(fields.goal_achieved)

  if (goal || HOT.has(interest) || HOT.has(qualification)) {
    return 'verified'
  }

  if (UNINTERESTED.has(interest) || UNINTERESTED.has(qualification)) {
    return 'uninterested'
  }

  // Partial matches e.g. "Not Interested - busy"
  if (
    interest.includes('not interest') ||
    interest.includes('uninterest') ||
    qualification.includes('not interest') ||
    qualification.includes('disqualif')
  ) {
    return 'uninterested'
  }

  return 'in_progress'
}

/** Flatten nested Convin CRM Push payload into a consistent shape. */
export function normalizeWebhookBody(body = {}) {
  const last = body.last_call_details || {}
  const custom = body.custom_fields || {}
  const entities = body.lead_entities || {}

  const external_id =
    body.external_id ||
    custom.external_id ||
    body.External_ID ||
    null

  return {
    request_id: body.request_id ?? null,
    lead_id: body.lead_id ?? null,
    external_id: external_id ? String(external_id).trim() : null,
    name: body.name || custom.name || [custom.first_name, custom.last_name].filter(Boolean).join(' ') || null,
    phone: body.phone || body.phone_number || null,
    email: body.email || null,
    campaign_id: body.campaign_id || null,
    campaign_name: body.campaign_name || null,
    current_state: body.current_state || null,
    qualification_status: body.qualification_status ?? null,
    qualification_reason: body.qualification_reason ?? null,
    interest_level: body.interest_level ?? null,
    interest_level_reason: body.interest_level_reason ?? null,
    goal_achieved: body.goal_achieved ?? null,
    goal_achieved_reason: body.goal_achieved_reason ?? null,
    call_attempts: Number(body.call_attempts ?? last.last_call_attempt_number ?? 0) || 0,
    call_status: body.call_status || last.last_call_status || null,
    duration_sec: body.duration_sec ?? last.last_call_duration_sec ?? null,
    recording_url:
      body.recording_url || last.last_call_recording_url || null,
    transcript: last.last_call_transcript || body.transcript || null,
    last_connected_at: body.last_connected_at || null,
    last_connected_channel: body.last_connected_channel || null,
    event: body.event || null,
    timestamp: body.timestamp || null,
    call_id: body.call_id || last.last_call_id || null,
    agent_name: body.agent_name || body.agent || null,
    callback_requested: entities.callback_requested ?? null,
    raw: body,
  }
}
