import Papa from 'papaparse'
import type { Lead } from '../types'
import { mintBatchExternalIds, validatePhoneNumber } from './leads'

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  const lower = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, '_'), v]),
  )
  for (const k of keys) {
    const v = lower[k.toLowerCase()]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

/**
 * Parse CSV upload → CRM leads.
 * - Always mints our external_id (institute code + date + numbers)
 * - Keeps any client lead_id / external_id as clientLeadId for display only
 */
export function parseLeadsCsv(csvText: string, instituteName = 'CollegeDunia'): Lead[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  const rawRows = parsed.data.filter((row) => {
    const phone = pick(row, 'phone_number', 'phone_number*', 'phone', 'mobile')
    const name = pick(row, 'name', 'first_name', 'full_name')
    return Boolean(phone || name)
  })

  const createdDate = new Date()
  const created = createdDate.toLocaleDateString('en-GB').replace(/\//g, '-')
  const externalIds = mintBatchExternalIds(rawRows.length, instituteName, createdDate)

  return rawRows.map((row, i) => {
    const phoneRaw = pick(row, 'phone_number', 'phone_number*', 'phone', 'mobile')
    const phone = validatePhoneNumber(phoneRaw)
    const first = pick(row, 'first_name')
    const last = pick(row, 'last_name')
    const nameFallback = pick(row, 'name', 'full_name')
    let firstName = first
    let lastName = last
    if (!firstName && !lastName && nameFallback) {
      const parts = nameFallback.split(/\s+/)
      firstName = parts[0] ?? ''
      lastName = parts.slice(1).join(' ')
    }

    const clientLeadId =
      pick(row, 'lead_id', 'external_id', 'ext_id', 'client_id', 'crm_id') || undefined

    return {
      id: `up-${Date.now()}-${i}`,
      phone_number: phone.display,
      phoneE164: phone.e164,
      phoneValid: phone.valid,
      phoneInvalidReason: phone.valid ? undefined : phone.reason,
      external_id: externalIds[i],
      clientLeadId,
      first_name: firstName || 'Lead',
      last_name: lastName,
      email: pick(row, 'email'),
      city: pick(row, 'city') || '—',
      state: pick(row, 'state') || '—',
      course: pick(row, 'course') || '—',
      createdAt: created,
      verified: false,
      verifiedChannels: [],
      verificationHistory: [],
      channelHistory: [],
      clientStatus: 'in_progress' as const,
      callAttempts: 0,
      callConnected: 0,
      interactions: 0,
      lastActivity: created,
      recordings: [],
      archived: false,
      source: pick(row, 'source', 'lead_origin') || 'API',
      country: pick(row, 'country') || 'India',
      currentState: phone.valid ? 'Not attempted' : 'Invalid phone',
    }
  })
}
