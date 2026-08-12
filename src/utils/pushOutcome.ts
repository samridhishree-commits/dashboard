import type { Lead } from '../types'

/** User-facing push outcome — Convin response only, no "where" details. */
export function pushOutcomeLabel(lead: Lead): string | null {
  const code = lead.convinPushCode
  const status = lead.convinPushStatus
  if (status === 'skipped_invalid' || code === 'invalid_phone') return 'Invalid phone number'
  if (code === 'duplicate_external_id') return 'Duplicate external ID'
  if (status === 'duplicate' || code === 'duplicate_phone') return 'Duplicate phone number'
  if (status === 'error') return lead.convinPushMessage || 'Upload failed'
  if (status === 'success') return null // fall through to interest / in progress
  return null
}

export function pushOutcomePillClass(lead: Lead): string {
  const code = lead.convinPushCode
  const status = lead.convinPushStatus
  if (status === 'skipped_invalid' || code === 'invalid_phone') return 'status-failed'
  if (status === 'duplicate' || code === 'duplicate_phone' || code === 'duplicate_external_id') {
    return 'status-paused'
  }
  if (status === 'error') return 'status-failed'
  if (status !== 'success') return 'status-draft'
  return `status-${lead.clientStatus}`
}

/** True when lead was successfully pushed and is awaiting / in voicebot outcomes. */
export function isAwaitingVoicebot(lead: Lead): boolean {
  return lead.convinPushStatus === 'success'
}
