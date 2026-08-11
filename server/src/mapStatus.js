/**
 * Map Convin CRM Push interest_level → our 4 CRM categories:
 * High intent (hot) | Moderate intent (warm) | Low intent (cold/not interested) | In Progress
 */

const HIGH = new Set(['hot', 'high', 'high intent', 'high_intent'])
const MODERATE = new Set(['warm', 'moderate', 'moderate intent', 'moderate_intent'])
const LOW = new Set([
  'cold',
  'low',
  'low intent',
  'low_intent',
  'not interested',
  'not_interested',
  'uninterested',
  'disqualified',
  'no interest',
])

function norm(v) {
  if (v == null) return ''
  return String(v).trim().toLowerCase().replace(/_/g, ' ')
}

/**
 * @returns {'high_intent' | 'moderate_intent' | 'low_intent' | 'in_progress'}
 */
export function mapClientStatus(fields = {}) {
  const interest = norm(fields.interest_level)

  if (HIGH.has(interest) || interest.includes('hot')) return 'high_intent'
  if (MODERATE.has(interest) || interest.includes('warm')) return 'moderate_intent'
  if (
    LOW.has(interest) ||
    interest.includes('cold') ||
    interest.includes('not interest') ||
    interest.includes('uninterest')
  ) {
    return 'low_intent'
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

  const extracted = {}
  for (const [k, v] of Object.entries(body)) {
    if (
      ['jee_percentile', '12th_percentage', 'tenth_percentage', 'neet_score', 'budget'].includes(k) &&
      v != null &&
      String(v).trim() !== ''
    ) {
      extracted[k] = String(v)
    }
  }
  for (const [k, v] of Object.entries(entities)) {
    if (v != null && typeof v !== 'object' && String(v).trim() !== '') {
      extracted[k] = String(v)
    }
  }
  for (const [k, v] of Object.entries(custom)) {
    if (
      v != null &&
      typeof v !== 'object' &&
      !['external_id', 'name', 'first_name', 'last_name', 'phone', 'email'].includes(k)
    ) {
      extracted[k] = String(v)
    }
  }

  return {
    request_id: body.request_id ?? null,
    lead_id: body.lead_id ?? null,
    external_id: external_id ? String(external_id).trim() : null,
    name:
      body.name ||
      custom.name ||
      [custom.first_name, custom.last_name].filter(Boolean).join(' ') ||
      null,
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
    recording_url: body.recording_url || last.last_call_recording_url || null,
    transcript: last.last_call_transcript || body.transcript || null,
    last_connected_at: body.last_connected_at || null,
    last_connected_channel: body.last_connected_channel || null,
    event: body.event || null,
    timestamp: body.timestamp || null,
    call_id: body.call_id || last.last_call_id || null,
    agent_name: body.agent_name || body.agent || null,
    callback_requested: entities.callback_requested ?? null,
    extracted_entities: extracted,
    raw: body,
  }
}
