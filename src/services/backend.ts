/** Frontend → our Render/API backend (never Convin directly). */

export type PushLeadInput = {
  external_id: string
  phone_number: string
  name?: string
  first_name?: string
  last_name?: string
}

export type PushLeadResult = {
  external_id: string | null
  phone_number?: string
  httpStatus?: number
  status: string
  code?: string
  lead_id?: string | null
  message?: string | null
}

export type PushLeadsResponse = {
  status: string
  campaign_id: string
  totals: { success: number; duplicate: number; failed: number; total: number }
  results: PushLeadResult[]
  message?: string
}

function apiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  // Empty → same-origin / Vite proxy (dev) or relative paths
  return (raw || '').replace(/\/$/, '')
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = apiBase()
  const url = `${base}${path}`
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
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; status?: string }
  if (!res.ok) {
    throw new Error(data?.message || `API ${res.status}`)
  }
  return data
}

export async function pushLeadsToConvin(leads: PushLeadInput[]): Promise<PushLeadsResponse> {
  return apiFetch<PushLeadsResponse>('/api/leads/push', {
    method: 'POST',
    body: JSON.stringify({ leads }),
  })
}

export async function archiveLeadOnConvin(
  external_id: string,
  reason?: string,
): Promise<{ status?: string; message?: string; lead_id?: string }> {
  return apiFetch('/api/leads/archive', {
    method: 'POST',
    body: JSON.stringify({
      external_id,
      reason: reason || 'Archived from CRM',
    }),
  })
}

export async function fetchConvinLeads(filters: Record<string, unknown> = {}) {
  return apiFetch('/api/leads/fetch', {
    method: 'POST',
    body: JSON.stringify(filters),
  })
}

export function hasApiBaseUrl(): boolean {
  return Boolean(apiBase())
}
