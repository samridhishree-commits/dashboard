/**
 * Convin /lead/add response → CRM-friendly outcome.
 * Never expose existing_lead_id / existing_campaign_id / "where" details.
 */

export function stripConvinWhereDetails(message) {
  if (!message) return ''
  return String(message)
    .replace(/\s*\([^)]*existing_[^)]*\)/gi, '')
    .replace(/\s*existing_lead_id\s*=\s*\S+/gi, '')
    .replace(/\s*existing_campaign_id\s*=\s*\S+/gi, '')
    .replace(/\blead_id\s*[:=]\s*[a-f0-9-]{20,}/gi, '')
    .replace(/\bcampaign_id\s*[:=]\s*[a-f0-9-]{20,}/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * @returns {{
 *   status: 'success' | 'duplicate' | 'error',
 *   code: 'success' | 'duplicate_phone' | 'duplicate_external_id' | 'invalid_phone' | 'error',
 *   message: string,
 *   lead_id: string | null
 * }}
 */
export function classifyConvinAddResponse(data, httpStatus) {
  const rawStatus = String(data?.status || '').toLowerCase()
  const rawMsg = String(data?.message || '')
  const msgLower = rawMsg.toLowerCase()
  const lead_id = data?.lead_id ?? null

  if (rawStatus === 'success' || httpStatus === 201) {
    return {
      status: 'success',
      code: 'success',
      message: 'Lead uploaded for dialing',
      lead_id,
    }
  }

  const isDuplicate =
    rawStatus === 'duplicate' || httpStatus === 409 || msgLower.includes('already exists')

  if (isDuplicate) {
    const aboutPhone =
      msgLower.includes('phone') ||
      msgLower.includes('mobile') ||
      msgLower.includes('number')
    const aboutExternal =
      msgLower.includes('external_id') ||
      msgLower.includes('external id') ||
      (msgLower.includes('external') && !aboutPhone)

    if (aboutExternal && !aboutPhone) {
      return {
        status: 'duplicate',
        code: 'duplicate_external_id',
        message: 'Duplicate external ID',
        lead_id,
      }
    }
    return {
      status: 'duplicate',
      code: 'duplicate_phone',
      message: 'Duplicate phone number',
      lead_id,
    }
  }

  const invalidPhone =
    msgLower.includes('invalid') &&
    (msgLower.includes('phone') || msgLower.includes('mobile') || msgLower.includes('number'))

  if (invalidPhone) {
    return {
      status: 'error',
      code: 'invalid_phone',
      message: 'Invalid phone number',
      lead_id,
    }
  }

  const cleaned = stripConvinWhereDetails(rawMsg) || 'Upload failed'
  // Keep short — no internal Convin routing details
  const short =
    cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned

  return {
    status: 'error',
    code: 'error',
    message: short,
    lead_id,
  }
}

export function friendlyPushCodeLabel(code) {
  switch (code) {
    case 'success':
      return 'Uploaded'
    case 'duplicate_phone':
      return 'Duplicate phone number'
    case 'duplicate_external_id':
      return 'Duplicate external ID'
    case 'invalid_phone':
      return 'Invalid phone number'
    default:
      return 'Upload failed'
  }
}
