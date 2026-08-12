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
import {
  getHiddenDraftCampaignIds,
  hideDraftCampaignLocally,
  isUnusedDraftCampaign,
} from '../utils/campaignDraft'
import { filterConvinReadyLeads, toConvinPayload } from '../utils/leads'
import { buildLeadActivityIndex, leadsEligibleForConvinPush } from '../utils/leadActivity'
import { useAuth } from './AuthContext'

const defaultFilters: GlobalFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  username: '',
  course: 'All Courses',
  status: 'All',
}

export type PushNotice = {
  title: string
  summary: string
  lines?: string[]
  kind?: 'info' | 'error' | 'results'
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
  startVoicebotRun: (
    campaignId: string,
    type: VoicebotType,
    leadIds?: string[],
  ) => Promise<void>
  archiveLead: (campaignId: string, leadId: string) => Promise<void>
  deleteLeads: (campaignId: string, leadIds: string[]) => Promise<void>
  deleteDraftCampaign: (campaignId: string) => boolean
  setCampaignStatus: (campaignId: string, status: CampaignStatus) => void
  lastPushError: string | null
  lastPushNotice: PushNotice | null
  clearLastPushError: () => void
}

const AppContext = createContext<AppState | null>(null)

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [institutes, setInstitutes] = useState(seedInstitutes)
  const [campaigns, setCampaigns] = useState(seedCampaigns)
  const [filters, setFiltersState] = useState<GlobalFilters>(defaultFilters)
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null)
  const [runningCampaignId, setRunningCampaignId] = useState<string | null>(null)
  const [runProgress, setRunProgress] = useState(0)
  const [lastPushError, setLastPushError] = useState<string | null>(null)
  const [lastPushNotice, setLastPushNotice] = useState<PushNotice | null>(null)

  const clearLastPushError = useCallback(() => {
    setLastPushError(null)
    setLastPushNotice(null)
  }, [])

  const showNotice = useCallback((notice: PushNotice) => {
    setLastPushNotice(notice)
    setLastPushError(notice.summary)
  }, [])

  // Restore OUR CRM campaigns/leads from Postgres (camp-* ids). Never uses Convin campaign_id.
  // Re-poll so webhook outcomes (status, recordings, minutes) appear without a full refresh.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const scope =
          user?.role === 'institute' && user.instituteId ? user.instituteId : undefined
        const fromDb = await listCrmCampaigns(scope)
        if (cancelled || !fromDb.length) return
        const hidden = getHiddenDraftCampaignIds()
        setCampaigns((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]))
          for (const c of fromDb) {
            if (!hidden.has(c.id)) map.set(c.id, c)
          }
          return Array.from(map.values()).filter((c) => !hidden.has(c.id))
        })
      } catch (err) {
        console.warn('[crm] load campaigns failed', err)
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 20000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [user?.role, user?.instituteId])

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

  const startVoicebotRun = useCallback(async (
    campaignId: string,
    type: VoicebotType,
    leadIds?: string[],
  ) => {
    const campaign = campaigns.find((c) => c.id === campaignId)
    if (!campaign) return

    const wasAlreadyRunning = campaign.status === 'running'

    const eligible = leadsEligibleForConvinPush(filterConvinReadyLeads(campaign.leads))
    const idSet = leadIds?.length ? new Set(leadIds) : null
    const ready = idSet ? eligible.filter((l) => idSet.has(l.id)) : eligible
    const payload = ready
      .map((l) => toConvinPayload(l))
      .filter((p): p is NonNullable<typeof p> => p !== null)
    const skippedInvalid = campaign.leads.filter((l) => !l.archived && !l.phoneValid).length

    setLastPushError(null)
    setLastPushNotice(null)

    // Don't flip to running until Convin accepts at least one lead
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaignId
          ? {
              ...c,
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
      const alreadySuccess =
        filterConvinReadyLeads(campaign.leads).filter((l) => l.convinPushStatus === 'success')
          .length > 0
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                status: (alreadySuccess || wasAlreadyRunning
                  ? 'running'
                  : c.leads.length
                    ? 'ready'
                    : 'draft') as CampaignStatus,
                leads: c.leads.map((l) =>
                  !l.phoneValid
                    ? {
                        ...l,
                        currentState: 'Invalid phone · not dialed',
                        convinPushStatus: 'skipped_invalid' as const,
                        convinPushCode: 'invalid_phone' as const,
                        convinPushMessage: 'Invalid phone number',
                        voicebotNote: 'Skipped — invalid phone number.',
                      }
                    : l,
                ),
              }
            : c,
        ),
      )
      showNotice({
        kind: 'info',
        title: wasAlreadyRunning ? 'Campaign already running' : 'Nothing to upload',
        summary: wasAlreadyRunning
          ? 'This voicebot campaign is already running. No new valid leads were left to upload.'
          : alreadySuccess
            ? 'All valid leads were already uploaded for dialing.'
            : 'No valid leads to upload for dialing.',
        lines: skippedInvalid
          ? [`${skippedInvalid} lead(s) have invalid phone numbers and were not sent.`]
          : undefined,
      })
      setRunProgress(100)
      window.setTimeout(() => {
        setRunningCampaignId(null)
        setRunProgress(0)
      }, 600)
      return
    }

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

      const { success, duplicate, failed } = res.totals
      const nextStatus: CampaignStatus =
        success > 0 || wasAlreadyRunning
          ? 'running'
          : failed + duplicate > 0
            ? 'failed'
            : campaign.status === 'draft'
              ? 'ready'
              : campaign.status

      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                status: nextStatus,
                leads: c.leads.map((l) => {
                  if (!l.phoneValid) {
                    return {
                      ...l,
                      currentState: 'Invalid phone · not dialed',
                      convinPushStatus: 'skipped_invalid' as const,
                      convinPushCode: 'invalid_phone' as const,
                      convinPushMessage: 'Invalid phone number',
                      voicebotNote: 'Skipped — invalid phone number.',
                    }
                  }
                  const row = byExternal.get(l.external_id)
                  if (!row) return l

                  const code = (row.code ||
                    (row.status === 'duplicate'
                      ? 'duplicate_phone'
                      : row.status === 'success'
                        ? 'success'
                        : 'error')) as Lead['convinPushCode']

                  if (row.status === 'success') {
                    return {
                      ...l,
                      convinLeadId: row.lead_id || l.convinLeadId,
                      convinPushStatus: 'success' as const,
                      convinPushCode: 'success' as const,
                      convinPushMessage: row.message || 'Lead uploaded for dialing',
                      clientStatus: 'in_progress' as ClientLeadStatus,
                      currentState: 'Uploaded · In Progress',
                      voicebotNote:
                        'Lead uploaded for dialing. Outcomes will sync as calls complete.',
                      lastActivity: new Date().toISOString(),
                    }
                  }

                  const friendly =
                    code === 'duplicate_external_id'
                      ? 'Duplicate external ID'
                      : code === 'duplicate_phone' || row.status === 'duplicate'
                        ? 'Duplicate phone number'
                        : code === 'invalid_phone'
                          ? 'Invalid phone number'
                          : row.message || 'Upload failed'

                  return {
                    ...l,
                    convinPushStatus:
                      row.status === 'duplicate' ? ('duplicate' as const) : ('error' as const),
                    convinPushCode: code,
                    convinPushMessage: friendly,
                    // Do NOT mark as In Progress — Convin did not accept this lead for calling
                    currentState: friendly,
                    phoneValid: code === 'invalid_phone' ? false : l.phoneValid,
                    phoneInvalidReason:
                      code === 'invalid_phone' ? 'Invalid phone number' : l.phoneInvalidReason,
                    voicebotNote: friendly,
                    lastActivity: new Date().toISOString(),
                  }
                }),
              }
            : c,
        ),
      )

      const lines: string[] = []
      const dupPhone = res.results.filter(
        (r) => r.code === 'duplicate_phone' || (r.status === 'duplicate' && r.code !== 'duplicate_external_id'),
      ).length
      const dupExt = res.results.filter((r) => r.code === 'duplicate_external_id').length
      const invalid = res.results.filter((r) => r.code === 'invalid_phone').length
      const otherFail = res.results.filter(
        (r) => r.status === 'error' && r.code !== 'invalid_phone',
      ).length

      if (success) lines.push(`${success} lead(s) uploaded successfully`)
      if (dupPhone) lines.push(`${dupPhone} duplicate phone number(s)`)
      if (dupExt) lines.push(`${dupExt} duplicate external ID(s)`)
      if (invalid) lines.push(`${invalid} invalid phone number(s)`)
      if (otherFail) lines.push(`${otherFail} upload failed`)
      if (skippedInvalid) lines.push(`${skippedInvalid} invalid phone(s) skipped before upload`)
      if (wasAlreadyRunning) {
        lines.unshift('This voicebot campaign was already running.')
      }

      const title =
        success > 0 && duplicate + failed === 0
          ? wasAlreadyRunning
            ? 'Campaign already running'
            : 'Upload complete'
          : success > 0
            ? 'Upload finished with issues'
            : 'Upload failed'

      showNotice({
        kind: success > 0 && failed + duplicate === 0 ? 'results' : 'error',
        title,
        summary:
          success > 0
            ? `${success} uploaded · ${duplicate} duplicate · ${failed} failed`
            : 'No leads were accepted for dialing. See details below.',
        lines,
      })

      void saveCrmPushResults(campaignId, {
        results: res.results,
        totals: res.totals,
        leadCount: payload.length,
        skippedInvalid,
        voicebotType: type,
        channel: 'voicebot',
        status: nextStatus,
      }).catch((err) => console.warn('[crm] save push results failed', err))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      showNotice({
        kind: 'error',
        title: 'Upload failed',
        summary: msg,
      })
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                status: (wasAlreadyRunning ? 'running' : 'failed') as CampaignStatus,
              }
            : c,
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
  }, [campaigns, showNotice])

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
          : 'Archive failed',
      )
    }
  }, [campaigns])

  const deleteLeads = useCallback(async (campaignId: string, leadIds: string[]) => {
    const campaign = campaigns.find((c) => c.id === campaignId)
    const activity = buildLeadActivityIndex(campaigns)
    const ids = [
      ...new Set(
        leadIds.filter((id) => {
          const lead = campaign?.leads.find((l) => l.id === id)
          if (!lead) return false
          return !activity.forLead(lead).locked
        }),
      ),
    ]
    if (!ids.length) {
      setLastPushError('No deletable leads selected (active campaign leads are locked).')
      return
    }

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
  }, [campaigns])

  const deleteDraftCampaign = useCallback((campaignId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId)
    if (!campaign || !isUnusedDraftCampaign(campaign)) return false
    hideDraftCampaignLocally(campaignId)
    setCampaigns((prev) => prev.filter((c) => c.id !== campaignId))
    setOpenTabs((prev) => prev.filter((t) => t.campaignId !== campaignId))
    if (activeCampaignId === campaignId) setActiveCampaignId(null)
    if (activeTabId) {
      const tab = openTabs.find((t) => t.id === activeTabId)
      if (tab?.campaignId === campaignId) setActiveTabId(null)
    }
    return true
  }, [campaigns, activeCampaignId, activeTabId, openTabs])

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
      campaigns.filter((c) => {
        if (c.instituteId !== instituteId) return false
        // Exact channel match
        if (c.channel === channel) return true
        // Legacy: institute-created campaigns often had no channel set; Voicebot is the
        // only run path from the main dashboard, so treat unset as voicebot.
        if (channel === 'voicebot' && !c.channel) return true
        return false
      }),
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
      lastPushNotice,
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
      deleteDraftCampaign,
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
      lastPushNotice,
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
      deleteDraftCampaign,
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
