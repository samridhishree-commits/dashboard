import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { seedCampaigns, institutes as seedInstitutes } from '../data/mockData'
import type {
  Campaign,
  CampaignStatus,
  Channel,
  ClientLeadStatus,
  GlobalFilters,
  Institute,
  Lead,
  OpenTab,
  VoicebotType,
} from '../types'
import { archiveLeadOnConvin, pushLeadsToConvin } from '../services/backend'
import {
  archiveCrmLead,
  deleteCrmLeads,
  listCrmCampaigns,
  patchCrmCampaignStatus,
  saveCrmCampaign,
  saveCrmLeads,
  saveCrmPushResults,
} from '../services/crm'
import { filterConvinReadyLeads, toConvinPayload } from '../utils/leads'

const defaultFilters: GlobalFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  username: '',
  course: 'All Courses',
  status: 'All',
}

interface AppState {
  institutes: Institute[]
  campaigns: Campaign[]
  filters: GlobalFilters
  openTabs: OpenTab[]
  activeTabId: string | null
  activeCampaignId: string | null
  runningCampaignId: string | null
  runProgress: number
  setFilters: (patch: Partial<GlobalFilters>) => void
  resetFilters: () => void
  addInstitute: (name: string, username: string) => void
  createCampaign: (
    instituteId: string,
    name: string,
    course: string,
    leads: Lead[],
    channel?: Channel,
  ) => Campaign
  addLeadsToCampaign: (campaignId: string, leads: Lead[]) => void
  channelCampaigns: (instituteId: string, channel: Channel) => Campaign[]
  instituteCampaigns: (instituteId: string) => Campaign[]
  getCampaign: (id: string) => Campaign | undefined
  openCampaignTab: (campaign: Campaign) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string | null) => void
  setActiveCampaignId: (id: string | null) => void
  startVoicebotRun: (campaignId: string, type: VoicebotType) => Promise<void>
  archiveLead: (campaignId: string, leadId: string) => Promise<void>
  deleteLeads: (campaignId: string, leadIds: string[]) => Promise<void>
  setCampaignStatus: (campaignId: string, status: CampaignStatus) => void
  lastPushError: string | null
  clearLastPushError: () => void
}

const AppContext = createContext<AppState | null>(null)

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [institutes, setInstitutes] = useState(seedInstitutes)
  const [campaigns, setCampaigns] = useState(seedCampaigns)
  const [filters, setFiltersState] = useState<GlobalFilters>(defaultFilters)
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null)
  const [runningCampaignId, setRunningCampaignId] = useState<string | null>(null)
  const [runProgress, setRunProgress] = useState(0)
  const [lastPushError, setLastPushError] = useState<string | null>(null)

  const clearLastPushError = useCallback(() => setLastPushError(null), [])

  // Restore OUR CRM campaigns/leads from Postgres (camp-* ids). Never uses Convin campaign_id.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const fromDb = await listCrmCampaigns()
        if (cancelled || !fromDb.length) return
        setCampaigns((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]))
          for (const c of fromDb) map.set(c.id, c)
          return Array.from(map.values())
        })
      } catch (err) {
        console.warn('[crm] load campaigns failed', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setFilters = useCallback((patch: Partial<GlobalFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }))
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters)
  }, [])

  const addInstitute = useCallback((name: string, username: string) => {
    setInstitutes((prev) => [
      ...prev,
      {
        id: uid('inst'),
        name,
        username,
        createdAt: new Date().toISOString().slice(0, 10),
        functional: true,
      },
    ])
  }, [])

  const createCampaign = useCallback(
    (
      instituteId: string,
      name: string,
      course: string,
      leads: Lead[],
      channel?: Channel,
    ) => {
      const campaign: Campaign = {
        id: uid('camp'),
        instituteId,
        name,
        course,
        createdAt: new Date().toISOString().slice(0, 10),
        // Stay draft/ready until user clicks Run Campaign (push to Convin)
        status: leads.length ? 'ready' : 'draft',
        channel,
        minutesConsumed: channel === 'voicebot' ? 0 : undefined,
        leads,
      }
      setCampaigns((prev) => [campaign, ...prev])
      setActiveCampaignId(campaign.id)
      void saveCrmCampaign(campaign).catch((err) =>
        console.warn('[crm] save campaign failed', err),
      )
      return campaign
    },
    [],
  )

  const addLeadsToCampaign = useCallback((campaignId: string, leads: Lead[]) => {
    if (!leads.length) return
    setCampaigns((prev) => {
      const next = prev.map((c) => {
        if (c.id !== campaignId) return c
        const nextLeads = [...c.leads, ...leads]
        const nextStatus: CampaignStatus =
          c.status === 'draft' || c.status === 'ready'
            ? nextLeads.length
              ? 'ready'
              : 'draft'
            : c.status
        return { ...c, leads: nextLeads, status: nextStatus }
      })
      const camp = next.find((c) => c.id === campaignId)
      if (camp) {
        void saveCrmLeads(campaignId, leads, camp).catch((err) =>
          console.warn('[crm] save leads failed', err),
        )
      }
      return next
    })
  }, [])

  const openCampaignTab = useCallback((campaign: Campaign) => {
    setActiveCampaignId(campaign.id)
  }, [])

  const closeTab = useCallback(
    (tabId: string) => {
      setOpenTabs((prev) => {
        const closing = prev.find((t) => t.id === tabId)
        const next = prev.filter((t) => t.id !== tabId)
        if (activeTabId === tabId) {
          const fallback = next[next.length - 1]
          setActiveTabId(fallback?.id ?? null)
          setActiveCampaignId(fallback?.campaignId ?? null)
        } else if (closing && activeCampaignId === closing.campaignId) {
          setActiveCampaignId(null)
        }
        return next
      })
    },
    [activeTabId, activeCampaignId],
  )

  const setActiveTab = useCallback(
    (tabId: string | null) => {
      setActiveTabId(tabId)
      if (!tabId) {
        setActiveCampaignId(null)
        return
      }
      const tab = openTabs.find((t) => t.id === tabId)
      if (tab) setActiveCampaignId(tab.campaignId)
    },
    [openTabs],
  )

  const startVoicebotRun = useCallback(async (campaignId: string, type: VoicebotType) => {
    const campaign = campaigns.find((c) => c.id === campaignId)
    if (!campaign) return

    const ready = filterConvinReadyLeads(campaign.leads).filter(
      (l) => l.convinPushStatus !== 'success' && l.convinPushStatus !== 'duplicate',
    )
    const payload = ready
      .map((l) => toConvinPayload(l))
      .filter((p): p is NonNullable<typeof p> => p !== null)
    const skippedInvalid = campaign.leads.filter((l) => !l.archived && !l.phoneValid).length

    setLastPushError(null)
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId
          ? {
              ...c,
              status: 'running' as CampaignStatus,
              channel: 'voicebot' as Channel,
              voicebotType: type,
              lastConvinPush: {
                at: new Date().toISOString(),
                leadCount: payload.length,
                skippedInvalid,
                payload,
              },
            }
          : c,
      ),
    )
    setRunningCampaignId(campaignId)
    setRunProgress(8)

    if (!payload.length) {
      const already =
        filterConvinReadyLeads(campaign.leads).filter(
          (l) => l.convinPushStatus === 'success' || l.convinPushStatus === 'duplicate',
        ).length > 0
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                status: (already ? 'running' : c.leads.length ? 'ready' : 'draft') as CampaignStatus,
                leads: c.leads.map((l) =>
                  !l.phoneValid
                    ? {
                        ...l,
                        clientStatus: 'in_progress' as ClientLeadStatus,
                        currentState: 'Invalid phone · not sent to Convin',
                        convinPushStatus: 'skipped_invalid' as const,
                        voicebotNote: 'Skipped — invalid phone number.',
                      }
                    : l,
                ),
              }
            : c,
        ),
      )
      setLastPushError(
        already
          ? 'All valid leads were already uploaded to Convin. Add new leads to push again.'
          : 'No valid leads to upload to Convin.',
      )
      setRunProgress(100)
      window.setTimeout(() => {
        setRunningCampaignId(null)
        setRunProgress(0)
      }, 600)
      return
    }

    // Indeterminate progress while backend pushes sequentially
    const tick = window.setInterval(() => {
      setRunProgress((p) => (p >= 90 ? 90 : p + 4))
    }, 400)

    try {
      const res = await pushLeadsToConvin(
        payload.map((p) => ({
          external_id: p.external_id,
          phone_number: p.phone_number,
          name: p.name,
        })),
      )

      const byExternal = new Map(
        res.results.map((r) => [r.external_id || '', r] as const),
      )

      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                status: 'running' as CampaignStatus,
                leads: c.leads.map((l) => {
                  if (!l.phoneValid) {
                    return {
                      ...l,
                      clientStatus: 'in_progress' as ClientLeadStatus,
                      currentState: 'Invalid phone · not sent to Convin',
                      convinPushStatus: 'skipped_invalid' as const,
                      voicebotNote: 'Skipped — invalid phone number.',
                    }
                  }
                  const row = byExternal.get(l.external_id)
                  if (!row) {
                    return {
                      ...l,
                      clientStatus: 'in_progress' as ClientLeadStatus,
                      currentState: 'Not sent',
                    }
                  }
                  const ok = row.status === 'success' || row.status === 'duplicate'
                  return {
                    ...l,
                    convinLeadId: row.lead_id || l.convinLeadId,
                    convinPushStatus:
                      row.status === 'duplicate'
                        ? ('duplicate' as const)
                        : row.status === 'success'
                          ? ('success' as const)
                          : ('error' as const),
                    convinPushMessage: row.message || undefined,
                    clientStatus: 'in_progress' as ClientLeadStatus,
                    currentState: ok
                      ? row.status === 'duplicate'
                        ? 'Uploaded (already in Convin)'
                        : 'Uploaded to Convin · In Progress'
                      : `Upload failed: ${row.message || 'error'}`,
                    voicebotNote: ok
                      ? 'Lead uploaded to Convin. Outcomes will sync via webhook / fetch.'
                      : row.message || 'Convin upload failed.',
                    lastActivity: new Date().toLocaleString(),
                  }
                }),
              }
            : c,
        ),
      )

      const { success, duplicate, failed } = res.totals
      if (failed > 0 && success + duplicate === 0) {
        setLastPushError(`All uploads failed (${failed}). Check API credentials / encryption.`)
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === campaignId ? { ...c, status: 'failed' as CampaignStatus } : c,
          ),
        )
      } else if (failed > 0) {
        setLastPushError(
          `Uploaded ${success + duplicate}/${res.totals.total} (${duplicate} duplicate, ${failed} failed).`,
        )
      }

      // Persist push outcomes under OUR campaign id (Convin push API unchanged above)
      void saveCrmPushResults(campaignId, {
        results: res.results,
        totals: res.totals,
        leadCount: payload.length,
        skippedInvalid,
        voicebotType: type,
        status:
          failed > 0 && success + duplicate === 0
            ? 'failed'
            : 'running',
      }).catch((err) => console.warn('[crm] save push results failed', err))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setLastPushError(msg)
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId ? { ...c, status: 'failed' as CampaignStatus } : c,
        ),
      )
    } finally {
      window.clearInterval(tick)
      setRunProgress(100)
      window.setTimeout(() => {
        setRunningCampaignId(null)
        setRunProgress(0)
      }, 700)
    }
  }, [campaigns])

  const archiveLead = useCallback(async (campaignId: string, leadId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId)
    const lead = campaign?.leads.find((l) => l.id === leadId)
    if (!lead) return

    // Optimistic local archive
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId
          ? {
              ...c,
              leads: c.leads.map((l) =>
                l.id === leadId ? { ...l, archived: true } : l,
              ),
            }
          : c,
      ),
    )

    // Always persist archive on OUR CRM DB
    void archiveCrmLead(campaignId, leadId).catch((err) =>
      console.warn('[crm] archive lead failed', err),
    )

    // Only call Convin if lead was (or may have been) pushed
    if (!lead.phoneValid || lead.convinPushStatus === 'skipped_invalid') return

    try {
      await archiveLeadOnConvin(lead.external_id, 'Archived from CRM')
    } catch (err) {
      console.error('[archive]', err)
      // Roll back local archive on API failure
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                leads: c.leads.map((l) =>
                  l.id === leadId ? { ...l, archived: false } : l,
                ),
              }
            : c,
        ),
      )
      setLastPushError(
        err instanceof Error
          ? `Archive failed: ${err.message}`
          : 'Archive failed on Convin',
      )
    }
  }, [campaigns])

  const deleteLeads = useCallback(async (campaignId: string, leadIds: string[]) => {
    const ids = [...new Set(leadIds.filter(Boolean))]
    if (!ids.length) return

    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId
          ? { ...c, leads: c.leads.filter((l) => !ids.includes(l.id)) }
          : c,
      ),
    )

    try {
      await deleteCrmLeads(campaignId, ids)
    } catch (err) {
      console.error('[crm] delete leads failed', err)
      setLastPushError(
        err instanceof Error
          ? `Delete failed: ${err.message}. Push the latest server code to Render, then retry.`
          : 'Failed to delete leads from database',
      )
      // Reload CRM from API if available so UI matches DB
      try {
        const remote = await listCrmCampaigns()
        if (remote.length) {
          setCampaigns((prev) => {
            const byId = new Map(remote.map((c) => [c.id, c]))
            return prev.map((c) => byId.get(c.id) ?? c)
          })
        }
      } catch {
        /* ignore */
      }
    }
  }, [])

  const setCampaignStatus = useCallback((campaignId: string, status: CampaignStatus) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === campaignId ? { ...c, status } : c)),
    )
    void patchCrmCampaignStatus(campaignId, status).catch((err) =>
      console.warn('[crm] status patch failed', err),
    )
  }, [])

  const getCampaign = useCallback(
    (id: string) => campaigns.find((c) => c.id === id),
    [campaigns],
  )

  const instituteCampaigns = useCallback(
    (instituteId: string) => campaigns.filter((c) => c.instituteId === instituteId),
    [campaigns],
  )

  const channelCampaigns = useCallback(
    (instituteId: string, channel: Channel) =>
      campaigns.filter((c) => c.instituteId === instituteId && c.channel === channel),
    [campaigns],
  )

  const value = useMemo(
    () => ({
      institutes,
      campaigns,
      filters,
      openTabs,
      activeTabId,
      activeCampaignId,
      runningCampaignId,
      runProgress,
      lastPushError,
      clearLastPushError,
      setFilters,
      resetFilters,
      addInstitute,
      createCampaign,
      addLeadsToCampaign,
      openCampaignTab,
      closeTab,
      setActiveTab,
      setActiveCampaignId,
      startVoicebotRun,
      archiveLead,
      deleteLeads,
      setCampaignStatus,
      getCampaign,
      instituteCampaigns,
      channelCampaigns,
    }),
    [
      institutes,
      campaigns,
      filters,
      openTabs,
      activeTabId,
      activeCampaignId,
      runningCampaignId,
      runProgress,
      lastPushError,
      clearLastPushError,
      setFilters,
      resetFilters,
      addInstitute,
      createCampaign,
      addLeadsToCampaign,
      openCampaignTab,
      closeTab,
      setActiveTab,
      startVoicebotRun,
      archiveLead,
      deleteLeads,
      setCampaignStatus,
      getCampaign,
      instituteCampaigns,
      channelCampaigns,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
