/** Our CRM Postgres APIs (camp-* ids). Does not change Convin push. */

import type { Campaign, CampaignStatus, Lead } from '../types'

function apiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  return (raw || '').replace(/\/$/, '')
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBase()}${path}`
  let authHeader: Record<string, string> = {}
  try {
    const raw = localStorage.getItem('cd-crm-auth')
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string }
      if (parsed?.token) authHeader = { Authorization: `Bearer ${parsed.token}` }
    }
  } catch {
    /* ignore */
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(init?.headers || {}),
    },
  })
  const data = (await res.json().catch(() => ({}))) as T & { message?: string }
  if (!res.ok) throw new Error(data?.message || `API ${res.status}`)
  return data
}

export async function listCrmCampaigns(instituteId?: string): Promise<Campaign[]> {
  const q = instituteId ? `?institute_id=${encodeURIComponent(instituteId)}` : ''
  const res = await apiFetch<{ data: Campaign[] }>(`/api/crm/campaigns${q}`)
  return res.data || []
}

export async function saveCrmCampaign(campaign: Campaign): Promise<Campaign | null> {
  const res = await apiFetch<{ data: Campaign }>('/api/crm/campaigns', {
    method: 'POST',
    body: JSON.stringify(campaign),
  })
  return res.data ?? null
}

export async function saveCrmLeads(
  campaignId: string,
  leads: Lead[],
  campaign?: Campaign,
): Promise<Campaign | null> {
  const res = await apiFetch<{ data: Campaign }>(`/api/crm/campaigns/${campaignId}/leads`, {
    method: 'POST',
    body: JSON.stringify({ leads, campaign }),
  })
  return res.data ?? null
}

export async function saveCrmPushResults(
  campaignId: string,
  body: {
    results: unknown[]
    totals?: unknown
    leadCount?: number
    skippedInvalid?: number
    voicebotType?: string
    status?: CampaignStatus
    channel?: string
  },
): Promise<Campaign | null> {
  const res = await apiFetch<{ data: Campaign }>(
    `/api/crm/campaigns/${campaignId}/push-results`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
  return res.data ?? null
}

export async function archiveCrmLead(campaignId: string, leadId: string): Promise<void> {
  await apiFetch(`/api/crm/campaigns/${campaignId}/leads/${leadId}/archive`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function deleteCrmLeads(
  campaignId: string,
  leadIds: string[],
): Promise<{ deleted: number }> {
  const res = await apiFetch<{ deleted?: number }>(
    `/api/crm/campaigns/${campaignId}/leads/delete`,
    {
      method: 'POST',
      body: JSON.stringify({ leadIds }),
    },
  )
  return { deleted: res.deleted ?? leadIds.length }
}

export async function patchCrmCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
): Promise<void> {
  await apiFetch(`/api/crm/campaigns/${campaignId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}
