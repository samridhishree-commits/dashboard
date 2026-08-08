import { maybeDecryptBody, maybeEncryptBody } from './crypto.js'

const DEFAULT_BASE = 'https://activate.convin.ai'

function config() {
  const baseUrl = (process.env.CONVIN_BASE_URL || DEFAULT_BASE).replace(/\/$/, '')
  const apiKey = process.env.CONVIN_API_KEY?.trim()
  const apiToken = process.env.CONVIN_API_TOKEN?.trim()
  const campaignId = process.env.CONVIN_CAMPAIGN_ID?.trim()
  if (!apiKey || !apiToken) {
    throw new Error('CONVIN_API_KEY and CONVIN_API_TOKEN are required')
  }
  if (!campaignId) {
    throw new Error('CONVIN_CAMPAIGN_ID is required')
  }
  return { baseUrl, apiKey, apiToken, campaignId }
}

export function getCampaignId() {
  return config().campaignId
}

/**
 * Low-level Convin POST. Handles optional AES envelope.
 */
export async function convinPost(path, payload) {
  const { baseUrl, apiKey, apiToken } = config()
  const body = maybeEncryptBody(payload)

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-api-token': apiToken,
    },
    body: JSON.stringify(body),
  })

  const rawText = await res.text()
  let rawJson = null
  try {
    rawJson = rawText ? JSON.parse(rawText) : null
  } catch {
    rawJson = { status: 'error', message: rawText || 'Non-JSON response', raw: rawText }
  }

  let data = rawJson
  try {
    data = maybeDecryptBody(rawJson)
  } catch (err) {
    data = {
      status: 'error',
      code: 'DECRYPT_FAILED',
      message: err instanceof Error ? err.message : 'Failed to decrypt Convin response',
      raw: rawJson,
    }
  }

  return {
    httpStatus: res.status,
    ok: res.status >= 200 && res.status < 300,
    data,
    retryAfter: res.headers.get('retry-after'),
  }
}

/** Add one lead to the fixed campaign. */
export async function addLead({ external_id, phone_number, name, first_name, last_name }) {
  const campaign_id = getCampaignId()
  const payload = {
    external_id,
    campaign_id,
    phone_number,
  }
  if (name) payload.name = name
  if (first_name) payload.first_name = first_name
  if (last_name) payload.last_name = last_name

  return convinPost('/api/v1/lead/add', payload)
}

/** Archive by our CRM external_id + fixed campaign. */
export async function archiveLead({ external_id, reason }) {
  const campaign_id = getCampaignId()
  return convinPost('/api/v1/lead/archive', {
    external_id,
    campaign_id,
    reason: reason || 'Archived from CRM',
  })
}

/** Fetch leads (defaults to fixed campaign). */
export async function fetchLeads(filters = {}) {
  const campaign_id = getCampaignId()
  const payload = {
    campaign_id,
    limit: 50,
    offset: 0,
    ...filters,
  }
  return convinPost('/api/v1/leads/fetch', payload)
}
