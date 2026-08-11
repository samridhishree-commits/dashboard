export type VoicebotType = 'btech' | 'mbbs' | 'mba' | 'online'
export type Channel = 'voicebot' | 'sms' | 'email' | 'whatsapp'
export type CampaignStatus = 'draft' | 'ready' | 'running' | 'completed' | 'paused' | 'failed'
/** Client-facing status shown in CRM (not Convin interest taxonomy). */
export type ClientLeadStatus =
  | 'high_intent'
  | 'moderate_intent'
  | 'low_intent'
  | 'in_progress'
  /** @deprecated legacy — treated as high_intent */
  | 'verified'
  /** @deprecated legacy — treated as low_intent */
  | 'uninterested'
export type CallOutcome = 'answered' | 'no_answer' | 'busy' | 'completed' | 'failed'

export interface CallRecording {
  id: string
  timestamp: string
  durationSec: number
  outcome: CallOutcome
  url?: string
  transcript?: string
  failureReason?: string
  answeredBy?: string
}

export type VerifyChannel = Channel

export interface VerificationEvent {
  id: string
  channel: VerifyChannel
  at: string
  note?: string
}

export interface ChannelTouchEvent {
  id: string
  channel: Channel
  at: string
  event: string
  status?: string
  durationSec?: number
  detail?: string
  transcript?: string
  recordingUrl?: string
  attemptNumber?: number
}

export interface Institute {
  id: string
  name: string
  username: string
  createdAt: string
  functional: boolean
}

export interface Lead {
  id: string
  phone_number: string
  /** E.164-ish normalized phone for Convin */
  phoneE164?: string
  /** False → stored in CRM but never sent to Convin */
  phoneValid: boolean
  phoneInvalidReason?: string
  /** Always CRM-generated: institute code + date + numbers (sent to Convin). */
  external_id: string
  /** Convin lead_id returned from add / duplicate. */
  convinLeadId?: string
  /** Last push outcome to Convin: success | duplicate | error | skipped_invalid */
  convinPushStatus?: 'success' | 'duplicate' | 'error' | 'skipped_invalid'
  convinPushMessage?: string
  /** Optional ID from client sheet (lead_id / external_id / etc.) — display only. */
  clientLeadId?: string
  first_name: string
  last_name: string
  email: string
  city: string
  state: string
  course: string
  createdAt: string
  verified: boolean
  verifiedChannels: VerifyChannel[]
  verificationHistory: VerificationEvent[]
  channelHistory: ChannelTouchEvent[]
  /** CRM status from interest_level: High / Moderate / Low intent | In Progress */
  clientStatus: ClientLeadStatus
  callAttempts: number
  callConnected: number
  interactions: number
  lastActivity: string
  recordings: CallRecording[]
  archived: boolean
  voicebotNote?: string
  source: string
  country: string
  currentState?: string
  lastConnectedAt?: string
  lastConnectedChannel?: Channel
  whatsappMessageAttempts?: number
  emailMessageAttempts?: number
  smsMessageAttempts?: number
  agentName?: string
  callbackRequested?: boolean
  /** Convin interest_level (hot/warm/cold) */
  interestLevel?: string
  interestLevelReason?: string
  qualificationStatus?: string
  qualificationReason?: string
  goalAchieved?: boolean
  goalAchievedReason?: string
  /** Extracted entities from webhook (JEE %, 12th %, etc.) */
  extractedEntities?: Record<string, string>
}

export interface Campaign {
  id: string
  instituteId: string
  name: string
  course: string
  createdAt: string
  status: CampaignStatus
  channel?: Channel
  voicebotType?: VoicebotType
  leads: Lead[]
  minutesConsumed?: number
  /** Last Convin push payload (demo) */
  lastConvinPush?: {
    at: string
    leadCount: number
    skippedInvalid: number
    payload: { external_id: string; phone_number: string; name: string }[]
  }
}

export interface GlobalFilters {
  search: string
  dateFrom: string
  dateTo: string
  username: string
  course: string
  status: string
}

export interface OpenTab {
  id: string
  campaignId: string
  title: string
}
