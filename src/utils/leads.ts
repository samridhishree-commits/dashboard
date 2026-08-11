import type { Lead } from '../types'

/** Client-facing CRM status driven by Convin interest_level. */
export type ClientLeadStatus =
  | 'high_intent'
  | 'moderate_intent'
  | 'low_intent'
  | 'in_progress'
  | 'verified'
  | 'uninterested'

export const clientStatusLabels: Record<ClientLeadStatus, string> = {
  high_intent: 'High intent',
  moderate_intent: 'Moderate intent',
  low_intent: 'Low intent',
  in_progress: 'In Progress',
  verified: 'High intent',
  uninterested: 'Low intent',
}

export const clientStatusHints: Record<ClientLeadStatus, string> = {
  high_intent: 'Hot · strong interest',
  moderate_intent: 'Warm · may be interested',
  low_intent: 'Cold / not interested',
  in_progress: 'Call ongoing / Not attempted',
  verified: 'Hot · strong interest',
  uninterested: 'Cold / not interested',
}

/** Normalize legacy DB values + new interest buckets. */
export function normalizeClientStatus(s: string | undefined | null): ClientLeadStatus {
  const v = String(s || '')
    .trim()
    .toLowerCase()
    .replace(/ /g, '_')
  if (v === 'verified' || v === 'hot' || v === 'high_intent') return 'high_intent'
  if (v === 'warm' || v === 'moderate_intent') return 'moderate_intent'
  if (v === 'uninterested' || v === 'cold' || v === 'low_intent' || v === 'not_interested')
    return 'low_intent'
  if (v === 'in_progress') return 'in_progress'
  return 'in_progress'
}

export function isHighIntent(s: ClientLeadStatus | string): boolean {
  return normalizeClientStatus(s) === 'high_intent'
}

export function isInterestedStatus(s: ClientLeadStatus | string): boolean {
  const n = normalizeClientStatus(s)
  return n === 'high_intent' || n === 'moderate_intent'
}

/** Digits-only phone for validation & Convin. */
export function normalizePhoneDigits(raw: string): string {
  return (raw || '').replace(/\D/g, '')
}

/**
 * Indian mobile validation (demo CRM rules):
 * - empty → invalid
 * - 10 digits starting 6–9 → valid
 * - 12 digits starting 91 + 10-digit mobile → valid
 * - otherwise invalid
 */
export function validatePhoneNumber(raw: string): {
  valid: boolean
  reason?: string
  display: string
  e164: string
} {
  const trimmed = (raw || '').trim()
  if (!trimmed) {
    return { valid: false, reason: 'Phone number missing', display: '—', e164: '' }
  }
  const digits = normalizePhoneDigits(trimmed)
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return {
      valid: true,
      display: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
      e164: `+91${digits}`,
    }
  }
  if (digits.length === 12 && /^91[6-9]\d{9}$/.test(digits)) {
    const local = digits.slice(2)
    return {
      valid: true,
      display: `+91 ${local.slice(0, 5)} ${local.slice(5)}`,
      e164: `+${digits}`,
    }
  }
  if (digits.length < 10) {
    return {
      valid: false,
      reason: 'Too short — need 10-digit Indian mobile',
      display: trimmed,
      e164: digits ? `+${digits}` : trimmed,
    }
  }
  if (digits.length === 10) {
    return {
      valid: false,
      reason: 'Invalid mobile — must start with 6–9',
      display: trimmed,
      e164: `+91${digits}`,
    }
  }
  return {
    valid: false,
    reason: 'Invalid phone format',
    display: trimmed,
    e164: digits ? `+${digits}` : trimmed,
  }
}

/** Jain University → JU, Horizon Academy → HA, Amity → AMY */
export function instituteCodeFromName(name: string): string {
  const stop = new Set(['of', 'the', 'and', 'for', 'at', 'in'])
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !stop.has(w.toLowerCase()))
  if (words.length >= 2) {
    const initials = words
      .map((w) => w.replace(/[^a-zA-Z]/g, '')[0] ?? '')
      .join('')
      .toUpperCase()
    return initials.slice(0, 4) || 'CD'
  }
  const single = (words[0] || 'CD').replace(/[^a-zA-Z]/g, '').toUpperCase()
  return single.slice(0, 3) || 'CD'
}

/** DDMMYYYY for lead creation date segment */
export function formatLeadDateCode(d = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${dd}${mm}${yyyy}`
}

/**
 * CRM external_id — always ours, never from client sheet.
 * Pattern: {InstituteCode}{DDMMYYYY}{seq4}{rand3}
 * e.g. Jain University → JU07082026001482
 */
export function generateExternalId(
  instituteName: string,
  seq: number,
  createdAt: Date = new Date(),
): string {
  const code = instituteCodeFromName(instituteName)
  const date = formatLeadDateCode(createdAt)
  const seqPart = String(Math.max(1, seq)).padStart(4, '0')
  const rand = String(Math.floor(100 + Math.random() * 900))
  return `${code}${date}${seqPart}${rand}`
}

/** Always mint unique CRM external_ids for a batch. */
export function mintBatchExternalIds(
  count: number,
  instituteName: string,
  createdAt: Date = new Date(),
): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    let id = generateExternalId(instituteName, i + 1, createdAt)
    let n = 0
    while (seen.has(id)) {
      n += 1
      id = generateExternalId(instituteName, i + 1 + n * 1000, createdAt)
    }
    seen.add(id)
    ids.push(id)
  }
  return ids
}

export function leadDisplayName(lead: Pick<Lead, 'first_name' | 'last_name'>): string {
  return `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Lead'
}

/** Payload sent to Convin on Run Campaign — only these three fields. */
export type ConvinLeadPayload = {
  external_id: string
  phone_number: string
  name: string
}

export function toConvinPayload(lead: Lead): ConvinLeadPayload | null {
  if (!lead.phoneValid) return null
  const name = leadDisplayName(lead)
  if (!lead.external_id?.trim() || !lead.phone_number?.trim() || !name) return null
  return {
    external_id: lead.external_id.trim(),
    phone_number: lead.phoneE164 || lead.phone_number.trim(),
    name,
  }
}

export function filterConvinReadyLeads(leads: Lead[]): Lead[] {
  return leads.filter((l) => !l.archived && toConvinPayload(l) !== null)
}

export function isClientStatus(s: string): s is ClientLeadStatus {
  return (
    s === 'high_intent' ||
    s === 'moderate_intent' ||
    s === 'low_intent' ||
    s === 'in_progress' ||
    s === 'verified' ||
    s === 'uninterested'
  )
}
