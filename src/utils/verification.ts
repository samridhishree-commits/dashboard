import type { Channel, Lead, VerifyChannel, VerificationEvent } from '../types'

const CHANNEL_ORDER: VerifyChannel[] = ['voicebot', 'email', 'sms', 'whatsapp']

export const channelVerifyLabels: Record<VerifyChannel, string> = {
  voicebot: 'Voicebot',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
}

/** Sorted combo key e.g. "email+sms" or "voicebot+email+whatsapp" */
export function verificationComboKey(channels: VerifyChannel[]): string {
  if (!channels.length) return 'none'
  return [...new Set(channels)]
    .sort((a, b) => CHANNEL_ORDER.indexOf(a) - CHANNEL_ORDER.indexOf(b))
    .join('+')
}

export function verificationComboLabel(channels: VerifyChannel[]): string {
  if (!channels.length) return 'Not verified'
  return verificationComboKey(channels)
    .split('+')
    .map((c) => channelVerifyLabels[c as VerifyChannel] ?? c)
    .join(' + ')
}

export function isLeadVerified(l: Lead): boolean {
  return (
    (l.verifiedChannels?.length ?? 0) > 0 ||
    l.verified ||
    l.clientStatus === 'high_intent' ||
    l.clientStatus === 'verified'
  )
}

export function withVerification(
  channels: VerifyChannel[],
  history?: VerificationEvent[],
): Pick<Lead, 'verified' | 'verifiedChannels' | 'verificationHistory'> {
  const unique = [...new Set(channels)]
  const verificationHistory =
    history ??
    unique.map((channel, i) => ({
      id: `vh-${channel}-${i}`,
      channel,
      at: `Jul ${15 + i}, 2026 · ${10 + i}:30 AM`,
      note: `Verified via ${channelVerifyLabels[channel]}`,
    }))
  return {
    verified: unique.length > 0,
    verifiedChannels: unique,
    verificationHistory,
  }
}

/** Count verified leads grouped by channel combo (for KPI popup). */
export function countByVerificationCombo(leads: Lead[]): { key: string; label: string; count: number }[] {
  const map = new Map<string, number>()
  for (const l of leads) {
    if (!isLeadVerified(l)) continue
    const key = verificationComboKey(l.verifiedChannels ?? [])
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({
      key,
      label: key
        .split('+')
        .map((c) => channelVerifyLabels[c as VerifyChannel] ?? c)
        .join(' + '),
      count,
    }))
    .sort((a, b) => b.count - a.count)
}

/** Per-channel verified counts (a lead with 2 channels counts in both). */
export function countVerifiedByChannel(leads: Lead[]): { channel: Channel; label: string; count: number }[] {
  const counts: Record<VerifyChannel, number> = {
    voicebot: 0,
    email: 0,
    sms: 0,
    whatsapp: 0,
  }
  for (const l of leads) {
    for (const c of l.verifiedChannels ?? []) {
      counts[c] += 1
    }
  }
  return CHANNEL_ORDER.map((channel) => ({
    channel,
    label: channelVerifyLabels[channel],
    count: counts[channel],
  }))
}
