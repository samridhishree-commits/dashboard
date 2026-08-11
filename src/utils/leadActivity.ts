import type { Campaign, Channel, Lead } from '../types'
import { channelLifecycleLabels } from './lifecycle'
import { normalizePhoneDigits } from './leads'

export type LeadCampaignHit = {
  campaignId: string
  campaignName: string
  channel: Channel | 'unassigned'
  status: Campaign['status']
  pushed: boolean
  running: boolean
}

export type LeadActivity = {
  /** Cannot delete from CRM while active elsewhere / already pushed in a live campaign */
  locked: boolean
  campaignCount: number
  channelCount: number
  campaigns: LeadCampaignHit[]
  channels: (Channel | 'unassigned')[]
}

function isPushed(lead: Lead) {
  return lead.convinPushStatus === 'success' || lead.convinPushStatus === 'duplicate'
}

/** Campaign is actively working leads (running or paused mid-flight). */
function isLiveCampaign(status: Campaign['status']) {
  return status === 'running' || status === 'paused'
}

function leadKeys(lead: Lead): string[] {
  const keys: string[] = []
  if (lead.external_id) keys.push(`ext:${lead.external_id}`)
  const phone = normalizePhoneDigits(lead.phoneE164 || lead.phone_number || '')
  if (phone.length >= 10) keys.push(`ph:${phone.slice(-10)}`)
  return keys
}

/**
 * Index of activity for every lead key (external_id + phone).
 * Used for nudges on institute campaign table + All Leads (not channel views).
 */
export function buildLeadActivityIndex(campaigns: Campaign[]): {
  byKey: Map<string, LeadActivity>
  forLead: (lead: Lead) => LeadActivity
} {
  const hitsByKey = new Map<string, LeadCampaignHit[]>()

  for (const c of campaigns) {
    for (const l of c.leads) {
      if (l.archived) continue
      const hit: LeadCampaignHit = {
        campaignId: c.id,
        campaignName: c.name,
        channel: c.channel ?? 'unassigned',
        status: c.status,
        pushed: isPushed(l),
        running: isLiveCampaign(c.status),
      }
      for (const key of leadKeys(l)) {
        const list = hitsByKey.get(key) || []
        if (!list.some((h) => h.campaignId === hit.campaignId)) list.push(hit)
        hitsByKey.set(key, list)
      }
    }
  }

  const byKey = new Map<string, LeadActivity>()
  for (const [key, hits] of hitsByKey) {
    byKey.set(key, summarize(hits))
  }

  const forLead = (lead: Lead): LeadActivity => {
    const merged = new Map<string, LeadCampaignHit>()
    for (const key of leadKeys(lead)) {
      const hits = hitsByKey.get(key) || []
      for (const h of hits) merged.set(h.campaignId, h)
    }
    return summarize([...merged.values()])
  }

  return { byKey, forLead }
}

function summarize(hits: LeadCampaignHit[]): LeadActivity {
  const channels = [...new Set(hits.map((h) => h.channel))]
  const locked = hits.some(
    (h) => (h.pushed && (h.running || h.status === 'running' || h.status === 'paused')) || h.running,
  )
  // Also lock if pushed into any campaign that is still not completed/failed/draft-only idle
  const lockedAlt = hits.some(
    (h) => h.pushed && h.status !== 'completed' && h.status !== 'failed' && h.status !== 'draft',
  )
  return {
    locked: locked || lockedAlt,
    campaignCount: hits.length,
    channelCount: channels.length,
    campaigns: hits,
    channels,
  }
}

export function channelLabel(ch: Channel | 'unassigned'): string {
  if (ch === 'unassigned') return 'Unassigned'
  return channelLifecycleLabels[ch] || ch
}

/** Skip re-push: already success/duplicate, or same phone already pushed in this campaign. */
export function leadsEligibleForConvinPush(campaignLeads: Lead[]): Lead[] {
  const pushedPhones = new Set<string>()
  for (const l of campaignLeads) {
    if (!isPushed(l)) continue
    const ph = normalizePhoneDigits(l.phoneE164 || l.phone_number || '')
    if (ph.length >= 10) pushedPhones.add(ph.slice(-10))
  }

  return campaignLeads.filter((l) => {
    if (l.archived || !l.phoneValid) return false
    if (isPushed(l)) return false
    const ph = normalizePhoneDigits(l.phoneE164 || l.phone_number || '')
    if (ph.length >= 10 && pushedPhones.has(ph.slice(-10))) return false
    return true
  })
}
