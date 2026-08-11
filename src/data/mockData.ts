import type {
  Campaign,
  ChannelTouchEvent,
  ClientLeadStatus,
  Institute,
  Lead,
  VerifyChannel,
} from '../types'
import { withVerification } from '../utils/verification'
import { generateExternalId, validatePhoneNumber } from '../utils/leads'

export const ADMIN_USER = {
  label: 'Welcome CollegeDunia CRM',
  initials: 'CD',
}

/** Client institute accounts. */
export const institutes: Institute[] = [
  {
    id: 'jain-university',
    name: 'Jain University',
    username: 'jain.admin',
    createdAt: '2024-11-12',
    functional: true,
  },
  {
    id: 'horizon',
    name: 'Horizon Academy',
    username: 'horizon.ops',
    createdAt: '2025-02-03',
    functional: true,
  },
  {
    id: 'northstar',
    name: 'Northstar College',
    username: 'northstar.crm',
    createdAt: '2025-06-18',
    functional: true,
  },
  {
    id: 'amity',
    name: 'Amity University',
    username: 'amity.leads',
    createdAt: '2025-01-20',
    functional: true,
  },
]

function lead(
  partial: Omit<
    Lead,
    | 'recordings'
    | 'archived'
    | 'callAttempts'
    | 'callConnected'
    | 'interactions'
    | 'clientStatus'
    | 'lastActivity'
    | 'verified'
    | 'verifiedChannels'
    | 'verificationHistory'
    | 'channelHistory'
    | 'source'
    | 'country'
    | 'phoneValid'
  > &
    Partial<
      Pick<
        Lead,
        | 'recordings'
        | 'archived'
        | 'callAttempts'
        | 'callConnected'
        | 'interactions'
        | 'clientStatus'
        | 'lastActivity'
        | 'verified'
        | 'verifiedChannels'
        | 'verificationHistory'
        | 'channelHistory'
        | 'source'
        | 'country'
        | 'phoneValid'
        | 'phoneE164'
        | 'phoneInvalidReason'
        | 'clientLeadId'
      >
    >,
): Lead {
  const channels = partial.verifiedChannels ?? []
  const synced = withVerification(channels, partial.verificationHistory)
  const phone = validatePhoneNumber(partial.phone_number)
  return {
    clientStatus: 'in_progress',
    callAttempts: 0,
    callConnected: 0,
    interactions: 0,
    lastActivity: partial.createdAt,
    recordings: [],
    archived: false,
    source: 'API',
    country: 'India',
    phoneValid: partial.phoneValid ?? phone.valid,
    phoneE164: partial.phoneE164 ?? phone.e164,
    phoneInvalidReason: partial.phoneInvalidReason ?? (phone.valid ? undefined : phone.reason),
    ...partial,
    phone_number: phone.valid ? phone.display : partial.phone_number,
    ...synced,
    verified: partial.verified ?? synced.verified,
    verifiedChannels: channels,
    verificationHistory: synced.verificationHistory,
    channelHistory: partial.channelHistory ?? [],
  }
}

function enrichLifecycle(l: Lead, status: ClientLeadStatus, i: number): Lead {
  const connected = l.callConnected > 0
  const channelHistory: ChannelTouchEvent[] = [...(l.channelHistory ?? [])]

  for (const ch of l.verifiedChannels ?? []) {
    if (ch === 'email' || ch === 'sms' || ch === 'whatsapp') {
      const attempts = ch === 'email' ? 2 : ch === 'sms' ? 2 : 1
      for (let a = 0; a < attempts; a++) {
        channelHistory.push({
          id: `${l.id}-${ch}-msg-${a}`,
          channel: ch,
          at: `Jul ${14 + a}, 2026 · ${9 + a}:15 AM`,
          event: a === 0 ? 'message_sent' : 'delivered',
          status: a === 0 ? 'sent' : 'delivered',
          detail:
            a === 0
              ? `${ch.toUpperCase()} outreach sent`
              : `${ch.toUpperCase()} delivered / opened`,
          attemptNumber: a + 1,
        })
      }
    }
  }

  const recordings = (l.recordings ?? []).map((r) => ({
    ...r,
    transcript:
      r.transcript ||
      (r.outcome === 'answered' || r.outcome === 'completed'
        ? `Bot: Hello, calling about ${l.course}. Lead: shared basic interest.`
        : undefined),
    answeredBy: r.answeredBy || (r.outcome === 'answered' ? 'human' : undefined),
    failureReason:
      r.failureReason ||
      (r.outcome === 'no_answer' ? 'Customer did not pick up' : undefined),
  }))

  const isVerified = status === 'verified'
  return {
    ...l,
    clientStatus: status,
    recordings,
    channelHistory,
    verified: isVerified || (l.verifiedChannels?.length ?? 0) > 0,
    verifiedChannels: isVerified
      ? [...new Set([...(l.verifiedChannels ?? []), 'voicebot' as const])]
      : l.verifiedChannels,
    emailMessageAttempts: l.verifiedChannels?.includes('email') ? 2 : l.emailMessageAttempts ?? 0,
    smsMessageAttempts: l.verifiedChannels?.includes('sms') ? 2 : l.smsMessageAttempts ?? 0,
    whatsappMessageAttempts: l.verifiedChannels?.includes('whatsapp')
      ? 1
      : l.whatsappMessageAttempts ?? 0,
    currentState:
      !l.phoneValid
        ? 'Invalid phone'
        : status === 'verified'
          ? 'Verified'
          : status === 'uninterested'
            ? 'Not interested'
            : connected
              ? 'Call ongoing'
              : 'Not attempted',
    lastConnectedAt: connected ? l.lastActivity : undefined,
    lastConnectedChannel: connected ? 'voicebot' : l.verifiedChannels?.[0],
    agentName: i % 2 === 0 ? 'AI Voice Agent' : 'L1 Qualifier',
    callbackRequested: status === 'in_progress' && i % 3 === 1,
  }
}

const sampleLeads: Lead[] = [
  lead({
    id: 'l1',
    phone_number: '+91 98765 43210',
    external_id: generateExternalId('Jain University', 1, new Date(2026, 6, 20)),
    clientLeadId: 'EXT001',
    first_name: 'Akshatha',
    last_name: 'N',
    email: 'akshatha@example.com',
    city: 'Bengaluru',
    state: 'Karnataka',
    course: 'Online MBA',
    createdAt: '20-07-2026',
    clientStatus: 'uninterested',
    callAttempts: 0,
    interactions: 2,
    lastActivity: 'Jul 20, 12:06 PM',
    source: 'API',
    ...withVerification(['voicebot', 'email']),
  }),
  lead({
    id: 'l2',
    phone_number: '+91 99887 76655',
    external_id: generateExternalId('Jain University', 2, new Date(2026, 6, 19)),
    clientLeadId: 'EXT002',
    first_name: 'Rakesh',
    last_name: 'M',
    email: 'rakesh@example.com',
    city: 'Hyderabad',
    state: 'Telangana',
    course: 'Online MBA',
    createdAt: '19-07-2026',
    clientStatus: 'uninterested',
    callAttempts: 0,
    interactions: 5,
    lastActivity: 'Jul 19, 4:22 PM',
    source: 'Widget',
    ...withVerification(['email', 'sms']),
  }),
  lead({
    id: 'l3',
    phone_number: '+91 80123 45678',
    external_id: generateExternalId('Jain University', 3, new Date(2026, 6, 18)),
    clientLeadId: 'EXT003',
    first_name: 'Gobindo',
    last_name: 'Das',
    email: 'gobindo@example.com',
    city: 'Kolkata',
    state: 'West Bengal',
    course: 'B.Tech',
    createdAt: '18-07-2026',
    clientStatus: 'in_progress',
    lastActivity: 'Jul 18, 9:10 AM',
    source: 'Organic',
    ...withVerification([]),
  }),
  lead({
    id: 'l4',
    phone_number: '+91 91234 56780',
    external_id: generateExternalId('Jain University', 4, new Date(2026, 6, 17)),
    clientLeadId: 'EXT004',
    first_name: 'Priya',
    last_name: 'Patel',
    email: 'priya@example.com',
    city: 'Ahmedabad',
    state: 'Gujarat',
    course: 'MBA',
    createdAt: '17-07-2026',
    clientStatus: 'verified',
    interactions: 8,
    lastActivity: 'Jul 17, 6:45 PM',
    source: 'Referral',
    ...withVerification(['voicebot', 'email', 'whatsapp']),
  }),
  lead({
    id: 'l5',
    phone_number: '+91 97654 32109',
    external_id: generateExternalId('Jain University', 5, new Date(2026, 6, 16)),
    first_name: 'Vikram',
    last_name: 'Singh',
    email: 'vikram@example.com',
    city: 'Jaipur',
    state: 'Rajasthan',
    course: 'B.Tech',
    createdAt: '16-07-2026',
    clientStatus: 'uninterested',
    lastActivity: 'Jul 16, 11:02 AM',
    source: 'API',
    ...withVerification([]),
  }),
  lead({
    id: 'l6',
    phone_number: '+91 96543 21098',
    external_id: generateExternalId('Jain University', 6, new Date(2026, 6, 15)),
    clientLeadId: 'CD-LEGACY-006',
    first_name: 'Neha',
    last_name: 'Gupta',
    email: 'neha@example.com',
    city: 'Noida',
    state: 'Uttar Pradesh',
    course: 'Online Courses',
    createdAt: '15-07-2026',
    clientStatus: 'uninterested',
    interactions: 3,
    lastActivity: 'Jul 15, 2:30 PM',
    source: 'CollegeDunia',
    ...withVerification(['voicebot']),
  }),
]

function applySeedVerify(l: Lead, i: number, forceVerified?: boolean): Lead {
  const presets: VerifyChannel[][] = [
    ['voicebot', 'email'],
    ['email', 'sms'],
    [],
    ['voicebot', 'email', 'whatsapp'],
    [],
    ['voicebot'],
    ['sms', 'whatsapp'],
    ['email'],
  ]
  let channels = forceVerified
    ? presets[i % presets.length].length
      ? presets[i % presets.length]
      : (['voicebot'] as VerifyChannel[])
    : presets[i % presets.length]
  if (forceVerified === false) channels = []
  const v = withVerification(channels)
  return { ...l, ...v }
}

export const seedCampaigns: Campaign[] = [
  {
    id: 'camp-online-mba',
    instituteId: 'jain-university',
    name: 'Online MBA · L1 Qualification',
    course: 'Online MBA',
    createdAt: '2026-07-12',
    status: 'running',
    channel: 'voicebot',
    voicebotType: 'online',
    minutesConsumed: 148.5,
    leads: sampleLeads.map((l, i) => {
      const status = (
        ['verified', 'uninterested', 'in_progress', 'uninterested', 'in_progress', 'verified'] as const
      )[i]
      const base = applySeedVerify(l, i)
      const withMaybeInvalid =
        i === 2
          ? {
              ...base,
              phone_number: '12345',
              phoneValid: false,
              phoneInvalidReason: 'Too short — need 10-digit Indian mobile',
              phoneE164: '12345',
            }
          : base
      return enrichLifecycle(
        {
          ...withMaybeInvalid,
          callAttempts: i === 2 || !withMaybeInvalid.phoneValid ? 0 : (i % 3) + 1,
          callConnected: withMaybeInvalid.phoneValid ? i % 2 : 0,
          recordings:
            i === 2 || !withMaybeInvalid.phoneValid
              ? []
              : Array.from({ length: (i % 3) + 1 }, (_, r) => ({
                  id: `seed-rec-${l.id}-${r}`,
                  timestamp: `Aug 5, ${10 + r}:${String(15 + r * 7).padStart(2, '0')} AM`,
                  durationSec: 28 + r * 14 + i,
                  outcome: (r === 0 ? 'no_answer' : 'answered') as 'no_answer' | 'answered',
                  url: '#',
                })),
        },
        !withMaybeInvalid.phoneValid ? 'in_progress' : status,
        i,
      )
    }),
  },
  {
    id: 'camp-btech-push',
    instituteId: 'jain-university',
    name: 'B.Tech Summer Push',
    course: 'B.Tech',
    createdAt: '2026-06-02',
    status: 'completed',
    channel: 'voicebot',
    voicebotType: 'btech',
    minutesConsumed: 312.2,
    leads: sampleLeads
      .filter((l) => l.course.includes('B.Tech') || l.id === 'l1' || l.id === 'l4')
      .map((l, i) => {
        const status = (['verified', 'uninterested', 'in_progress'] as const)[i % 3]
        const base = applySeedVerify({ ...l, id: `bt-${l.id}` }, i, true)
        return enrichLifecycle(
          {
            ...base,
            callAttempts: 2 + (i % 2),
            callConnected: 1,
            recordings: [
              {
                id: `bt-rec-${l.id}`,
                timestamp: 'Jul 28, 3:10 PM',
                durationSec: 55,
                outcome: 'completed' as const,
                url: '#',
              },
            ],
          },
          status,
          i,
        )
      }),
  },
  {
    id: 'camp-mba-paused',
    instituteId: 'jain-university',
    name: 'MBA Priority Dial',
    course: 'MBA',
    createdAt: '2026-07-29',
    status: 'paused',
    channel: 'voicebot',
    voicebotType: 'mba',
    minutesConsumed: 64,
    leads: sampleLeads.slice(0, 4).map((l, i) =>
      enrichLifecycle(
        {
          ...applySeedVerify({ ...l, id: `mba-${l.id}`, course: 'MBA' }, i),
          callAttempts: 1,
          callConnected: 0,
          recordings: [
            {
              id: `mba-rec-${l.id}`,
              timestamp: 'Jul 30, 11:05 AM',
              durationSec: 18,
              outcome: 'no_answer' as const,
              url: '#',
            },
          ],
        },
        'in_progress',
        i,
      ),
    ),
  },
  {
    id: 'camp-btech-empty',
    instituteId: 'jain-university',
    name: 'B.Tech Empty Campaign',
    course: 'B.Tech',
    createdAt: '2026-08-10',
    status: 'draft',
    channel: 'voicebot',
    voicebotType: 'btech',
    minutesConsumed: 0,
    leads: [],
  },
]

export const leadOriginRows = [
  { origin: 'API', total: 41812, verified: 59.74, unverified: 40.26, inProgress: 18.4 },
  { origin: 'Widget', total: 739, verified: 72.53, unverified: 27.47, inProgress: 11.2 },
  { origin: 'Organic', total: 2140, verified: 48.1, unverified: 51.9, inProgress: 22.6 },
  { origin: 'Referral', total: 980, verified: 81.2, unverified: 18.8, inProgress: 9.5 },
]

/** Monthly verified / unverified / in-progress L1 volumes (no publisher benchmarks) */
export const verifiedTrendData = [
  { month: 'Nov-2025', verified: 3100, unverified: 2100, inProgress: 980 },
  { month: 'Dec-2025', verified: 3800, unverified: 2300, inProgress: 1120 },
  { month: 'Jan-2026', verified: 4200, unverified: 1900, inProgress: 1350 },
  { month: 'Feb-2026', verified: 5100, unverified: 2100, inProgress: 1480 },
  { month: 'Mar-2026', verified: 5800, unverified: 1800, inProgress: 1620 },
  { month: 'Apr-2026', verified: 6400, unverified: 1700, inProgress: 1750 },
  { month: 'May-2026', verified: 7100, unverified: 1600, inProgress: 1890 },
  { month: 'Jun-2026', verified: 7800, unverified: 1450, inProgress: 2010 },
]

/** Call attempts & connects over time */
export const callActivityData = [
  { month: 'Nov-2025', attempts: 4200, connected: 2100 },
  { month: 'Dec-2025', attempts: 5100, connected: 2550 },
  { month: 'Jan-2026', attempts: 5600, connected: 2900 },
  { month: 'Feb-2026', attempts: 6400, connected: 3400 },
  { month: 'Mar-2026', attempts: 7200, connected: 3900 },
  { month: 'Apr-2026', attempts: 7800, connected: 4300 },
  { month: 'May-2026', attempts: 8500, connected: 4800 },
  { month: 'Jun-2026', attempts: 9100, connected: 5200 },
]

export const leadScoreData = [
  { score: 'Hot', count: 33320, pct: 78.38, color: '#2f6fed' },
  { score: 'Warm', count: 5420, pct: 12.75, color: '#6b93e8' },
  { score: 'Cold', count: 2810, pct: 6.61, color: '#8fa3bf' },
  { score: 'Unknown', count: 1001, pct: 2.26, color: '#c5ced9' },
]

export const incompleteLeads = {
  state: [
    { name: 'Karnataka', value: 34 },
    { name: 'Bihar', value: 22 },
    { name: 'Gujarat', value: 18 },
    { name: 'Other', value: 26 },
  ],
  city: [
    { name: 'Bengaluru', value: 28 },
    { name: 'Patna', value: 20 },
    { name: 'Ahmedabad', value: 16 },
    { name: 'Other', value: 36 },
  ],
  course: [
    { name: 'B.Tech', value: 42 },
    { name: 'MBA', value: 24 },
    { name: 'Online', value: 18 },
    { name: 'Other', value: 16 },
  ],
}

export const CSV_HEADERS =
  'phone_number*,external_id,first_name,last_name,email,city,state,course,consent_email,consent_sms,consent_whatsapp'

export const CSV_SAMPLE = `${CSV_HEADERS}
9876543210,EXT001,Akshatha,N,akshatha@example.com,Bengaluru,Karnataka,Online MBA,true,true,false
9988776655,,Rakesh,M,rakesh@example.com,Hyderabad,Telangana,Online MBA,true,false,true
12345,EXT003,Gobindo,Das,gobindo@example.com,Kolkata,West Bengal,B.Tech,false,true,false
9123456780,EXT004,Priya,Patel,priya@example.com,Ahmedabad,Gujarat,MBA,true,true,true
`

export const voicebotTypeLabels: Record<string, string> = {
  btech: 'B.Tech',
  mbbs: 'MBBS',
  mba: 'MBA',
  online: 'Online Courses',
}

export const channelLabels: Record<string, string> = {
  voicebot: 'Voicebot',
  sms: 'SMS',
  email: 'Email',
  whatsapp: 'WhatsApp',
}
