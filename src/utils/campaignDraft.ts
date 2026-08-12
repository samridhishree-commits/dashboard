import type { Campaign } from '../types'
import { campaignHasSuccessfulRun } from './leadActivity'

const HIDDEN_DRAFT_KEY = 'cd-crm-hidden-draft-campaigns'

/** Unused empty draft — never had leads added and never pushed to Convin. */
export function isUnusedDraftCampaign(campaign: Campaign): boolean {
  if (campaign.status !== 'draft') return false
  const activeLeads = campaign.leads.filter((l) => !l.archived)
  if (activeLeads.length > 0) return false
  if (campaignHasSuccessfulRun(campaign)) return false
  return true
}

export function draftCampaignHint(campaign: Campaign): string {
  if (isUnusedDraftCampaign(campaign)) {
    return 'Draft · upload leads or delete if unused'
  }
  if (campaign.status === 'draft') return 'Draft'
  return ''
}

export function getHiddenDraftCampaignIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_DRAFT_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(parsed.filter(Boolean))
  } catch {
    return new Set()
  }
}

export function hideDraftCampaignLocally(campaignId: string): void {
  const hidden = getHiddenDraftCampaignIds()
  hidden.add(campaignId)
  localStorage.setItem(HIDDEN_DRAFT_KEY, JSON.stringify([...hidden]))
}
