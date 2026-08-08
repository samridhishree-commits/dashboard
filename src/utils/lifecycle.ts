import type { Channel, ChannelTouchEvent, Lead } from '../types'
import { channelVerifyLabels } from './verification'
import { clientStatusHints, clientStatusLabels, type ClientLeadStatus } from './leads'

export { clientStatusLabels, clientStatusHints }
export type { ClientLeadStatus }

export const channelLifecycleLabels: Record<Channel, string> = {
  voicebot: 'Voicebot',
  sms: 'SMS',
  email: 'Email',
  whatsapp: 'WhatsApp',
}

export function getChannelHistory(lead: Lead, channel?: Channel): ChannelTouchEvent[] {
  const stored = lead.channelHistory ?? []
  const fromVerify: ChannelTouchEvent[] = (lead.verificationHistory ?? []).map((v) => ({
    id: `ver-${v.id}`,
    channel: v.channel,
    at: v.at,
    event: 'verified',
    status: 'verified',
    detail: v.note || `Verified via ${channelVerifyLabels[v.channel]}`,
  }))
  const fromCalls: ChannelTouchEvent[] = (lead.recordings ?? []).map((r, i) => ({
    id: `call-${r.id}`,
    channel: 'voicebot' as Channel,
    at: r.timestamp,
    event: 'call_attempt',
    status: r.outcome,
    durationSec: r.durationSec,
    detail: r.failureReason
      ? `${r.outcome.replace('_', ' ')} · ${r.failureReason}`
      : `${r.outcome.replace('_', ' ')}${r.answeredBy ? ` · answered by ${r.answeredBy}` : ''}`,
    transcript: r.transcript,
    recordingUrl: r.url,
    attemptNumber: i + 1,
  }))

  const merged = [...stored, ...fromVerify, ...fromCalls]
  const seen = new Set<string>()
  const unique = merged.filter((e) => {
    const key = `${e.channel}|${e.event}|${e.at}|${e.attemptNumber ?? ''}|${e.detail ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  unique.sort((a, b) => a.at.localeCompare(b.at))
  if (!channel) return unique
  return unique.filter((e) => e.channel === channel)
}

export function statusLabel(lead: Lead): string {
  return clientStatusLabels[lead.clientStatus] ?? 'In Progress'
}

export function statusHint(lead: Lead): string {
  return clientStatusHints[lead.clientStatus] ?? ''
}

export function currentStateLabel(lead: Lead): string {
  if (!lead.phoneValid) return 'Invalid phone'
  if (lead.currentState) return lead.currentState
  if (lead.archived) return 'Archived'
  if (lead.clientStatus === 'verified') return 'Verified'
  if (lead.clientStatus === 'uninterested') return 'Uninterested'
  if (lead.callAttempts > 0) return 'Call ongoing'
  return 'Not attempted'
}

export function channelAttemptCount(lead: Lead, channel: Channel): number {
  if (channel === 'voicebot') return lead.callAttempts
  if (channel === 'whatsapp') return lead.whatsappMessageAttempts ?? 0
  if (channel === 'email') return lead.emailMessageAttempts ?? 0
  if (channel === 'sms') return lead.smsMessageAttempts ?? 0
  return 0
}

export function channelsTouched(lead: Lead): Channel[] {
  const set = new Set<Channel>()
  for (const e of getChannelHistory(lead)) set.add(e.channel)
  for (const c of lead.verifiedChannels ?? []) set.add(c)
  if (lead.callAttempts > 0 || lead.recordings.length) set.add('voicebot')
  if ((lead.whatsappMessageAttempts ?? 0) > 0) set.add('whatsapp')
  if ((lead.emailMessageAttempts ?? 0) > 0) set.add('email')
  if ((lead.smsMessageAttempts ?? 0) > 0) set.add('sms')
  return (['voicebot', 'email', 'sms', 'whatsapp'] as Channel[]).filter((c) => set.has(c))
}

export function countByClientStatus(leads: Lead[]) {
  const active = leads.filter((l) => !l.archived)
  return {
    total: active.length,
    valid: active.filter((l) => l.phoneValid).length,
    invalid: active.filter((l) => !l.phoneValid).length,
    verified: active.filter((l) => l.clientStatus === 'verified').length,
    uninterested: active.filter((l) => l.clientStatus === 'uninterested').length,
    inProgress: active.filter((l) => l.clientStatus === 'in_progress').length,
  }
}
