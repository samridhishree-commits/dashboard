/**
 * Our CRM persistence (NOT Convin campaign_id).
 * crm_campaigns.id / crm_leads.campaign_id = Collegedunia camp-* IDs.
 * Convin push still uses env CONVIN_CAMPAIGN_ID unchanged.
 * Webhook join key back into CRM: external_id (never Convin campaign UUID).
 */
import { getPool, hasDatabase } from './db.js'
import { mapClientStatus } from './mapStatus.js'
import {
  buildCrmRawPatch,
  hydrateLeadFields,
  mergeRecordings,
  normalizeStoredStatus,
  recordingFromWebhookPayload,
  STATUS_STATE,
} from './crmWebhookSync.js'

function requireDb() {
  const pool = getPool()
  if (!pool) throw new Error('DATABASE_URL not configured')
  return pool
}

export async function upsertCrmCampaign(campaign) {
  const pool = requireDb()
  await pool.query(
    `INSERT INTO crm_campaigns (
      id, institute_id, name, course, channel, voicebot_type, status,
      minutes_consumed, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz, NOW()), NOW())
    ON CONFLICT (id) DO UPDATE SET
      institute_id = EXCLUDED.institute_id,
      name = EXCLUDED.name,
      course = EXCLUDED.course,
      channel = COALESCE(EXCLUDED.channel, crm_campaigns.channel),
      voicebot_type = COALESCE(EXCLUDED.voicebot_type, crm_campaigns.voicebot_type),
      status = EXCLUDED.status,
      minutes_consumed = COALESCE(EXCLUDED.minutes_consumed, crm_campaigns.minutes_consumed),
      updated_at = NOW()`,
    [
      campaign.id,
      campaign.instituteId,
      campaign.name,
      campaign.course,
      campaign.channel ?? null,
      campaign.voicebotType ?? null,
      campaign.status,
      campaign.minutesConsumed ?? 0,
      campaign.createdAt ? new Date(campaign.createdAt).toISOString() : null,
    ],
  )
  return campaign
}

export async function addCrmLeads(campaignId, leads) {
  if (!leads?.length) return { inserted: 0 }
  const pool = requireDb()
  const client = await pool.connect()
  let inserted = 0
  try {
    await client.query('BEGIN')
    for (const lead of leads) {
      await client.query(
        `INSERT INTO crm_leads (
          id, campaign_id, external_id, client_lead_id, first_name, last_name,
          phone_number, phone_e164, phone_valid, phone_invalid_reason, email,
          city, state, course, country, source, client_status, archived,
          convin_lead_id, convin_push_status, convin_push_message, raw, updated_at, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,$11,
          $12,$13,$14,$15,$16,$17,$18,
          $19,$20,$21,$22, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          phone_number = EXCLUDED.phone_number,
          phone_e164 = EXCLUDED.phone_e164,
          phone_valid = EXCLUDED.phone_valid,
          phone_invalid_reason = EXCLUDED.phone_invalid_reason,
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          client_status = COALESCE(EXCLUDED.client_status, crm_leads.client_status),
          archived = EXCLUDED.archived,
          raw = EXCLUDED.raw,
          updated_at = NOW()`,
        [
          lead.id,
          campaignId,
          lead.external_id,
          lead.clientLeadId ?? null,
          lead.first_name ?? '',
          lead.last_name ?? '',
          lead.phone_number ?? '',
          lead.phoneE164 ?? null,
          lead.phoneValid !== false,
          lead.phoneInvalidReason ?? null,
          lead.email ?? '',
          lead.city ?? '',
          lead.state ?? '',
          lead.course ?? '',
          lead.country ?? 'India',
          lead.source ?? 'CSV',
          lead.clientStatus ?? 'in_progress',
          Boolean(lead.archived),
          lead.convinLeadId ?? null,
          lead.convinPushStatus ?? null,
          lead.convinPushMessage ?? null,
          JSON.stringify(lead),
        ],
      )
      inserted += 1
    }
    // Bump campaign status to ready if it had leads and was draft
    await client.query(
      `UPDATE crm_campaigns
       SET status = CASE WHEN status = 'draft' THEN 'ready' ELSE status END,
           updated_at = NOW()
       WHERE id = $1`,
      [campaignId],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  return { inserted }
}

export async function updateCrmLeadPushResults(campaignId, results = []) {
  if (!results.length) return
  const pool = requireDb()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const r of results) {
      if (!r.external_id) continue
      const status =
        r.status === 'success' || r.status === 'duplicate'
          ? r.status
          : r.status || 'error'
      await client.query(
        `UPDATE crm_leads SET
           convin_lead_id = COALESCE($3, convin_lead_id),
           convin_push_status = $4,
           convin_push_message = $5,
           current_state = CASE
             WHEN $4 IN ('success','duplicate') THEN 'Uploaded to Convin · In Progress'
             ELSE COALESCE(current_state, 'Upload failed')
           END,
           updated_at = NOW()
         WHERE campaign_id = $1 AND external_id = $2`,
        [
          campaignId,
          r.external_id,
          r.lead_id ?? null,
          status,
          r.message ?? null,
        ],
      )
    }
    await client.query(
      `UPDATE crm_campaigns SET status = 'running', updated_at = NOW() WHERE id = $1`,
      [campaignId],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function logCrmPushRun(campaignId, payload) {
  const pool = requireDb()
  await pool.query(
    `INSERT INTO crm_push_runs (campaign_id, lead_count, skipped_invalid, totals, results, payload)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      campaignId,
      payload.leadCount ?? 0,
      payload.skippedInvalid ?? 0,
      JSON.stringify(payload.totals ?? {}),
      JSON.stringify(payload.results ?? []),
      JSON.stringify(payload),
    ],
  )
}

export async function setCrmLeadArchived(campaignId, leadId, archived = true) {
  const pool = requireDb()
  await pool.query(
    `UPDATE crm_leads SET archived = $3, updated_at = NOW()
     WHERE campaign_id = $1 AND id = $2`,
    [campaignId, leadId, archived],
  )
}

/** Hard-delete CRM leads (e.g. invalid phones). Does not touch Convin `leads` table. */
export async function deleteCrmLeads(campaignId, leadIds) {
  const ids = Array.isArray(leadIds) ? leadIds.filter(Boolean) : []
  if (!ids.length) return { deleted: 0 }
  const pool = requireDb()
  const { rowCount } = await pool.query(
    `DELETE FROM crm_leads WHERE campaign_id = $1 AND id = ANY($2::text[])`,
    [campaignId, ids],
  )
  return { deleted: rowCount || 0 }
}

export async function setCrmCampaignStatus(campaignId, status) {
  const pool = requireDb()
  await pool.query(
    `UPDATE crm_campaigns SET status = $2, updated_at = NOW() WHERE id = $1`,
    [campaignId, status],
  )
}

function rowToLead(row, convinLead, webhookRecordings = []) {
  const raw = typeof row.raw === 'object' && row.raw ? row.raw : {}
  // Merge leftover Convin `leads` row (by external_id) so UI shows calls already received
  let mergedRaw = { ...raw }
  if (convinLead) {
    mergedRaw = {
      ...mergedRaw,
      call_attempts: mergedRaw.call_attempts ?? convinLead.call_attempts,
      call_status: mergedRaw.call_status ?? convinLead.call_status,
      recording_url: mergedRaw.recording_url ?? convinLead.recording_url,
      transcript: mergedRaw.transcript ?? convinLead.transcript,
      duration_sec: mergedRaw.duration_sec ?? convinLead.duration_sec,
      interest_level: mergedRaw.interest_level ?? convinLead.interest_level,
      interest_level_reason:
        mergedRaw.interest_level_reason ?? convinLead.interest_level_reason,
      qualification_status:
        mergedRaw.qualification_status ?? convinLead.qualification_status,
      qualification_reason:
        mergedRaw.qualification_reason ?? convinLead.qualification_reason,
      goal_achieved: mergedRaw.goal_achieved ?? convinLead.goal_achieved,
      goal_achieved_reason:
        mergedRaw.goal_achieved_reason ?? convinLead.goal_achieved_reason,
      jee_percentile: mergedRaw.jee_percentile ?? convinLead.jee_percentile,
      '12th_percentage':
        mergedRaw['12th_percentage'] ?? convinLead.twelfth_percentage,
      lastWebhookAt: mergedRaw.lastWebhookAt || convinLead.updated_at,
    }
  }
  // Source of truth for multi-call: webhook_events (one row per attempt) ∪ stored recordings
  const fromConvinLatest =
    convinLead && (convinLead.recording_url || convinLead.transcript || convinLead.duration_sec)
      ? [
          {
            id: convinLead.lead_id || `convin-${convinLead.external_id}`,
            timestamp: convinLead.last_event_at || convinLead.updated_at || '',
            durationSec: Number(convinLead.duration_sec) || 0,
            outcome: convinLead.call_status || 'completed',
            url: convinLead.recording_url || undefined,
            transcript: convinLead.transcript || undefined,
          },
        ]
      : []

  const h = hydrateLeadFields(
    mergedRaw,
    mergeRecordings(webhookRecordings, fromConvinLatest),
  )
  const clientStatus = h.interestLevel
    ? mapClientStatus({ interest_level: h.interestLevel })
    : normalizeStoredStatus(
        row.client_status || convinLead?.client_status || 'in_progress',
      )
  return {
    id: row.id,
    phone_number: row.phone_number,
    phoneE164: row.phone_e164 || undefined,
    phoneValid: row.phone_valid,
    phoneInvalidReason: row.phone_invalid_reason || undefined,
    external_id: row.external_id,
    clientLeadId: row.client_lead_id || undefined,
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    email: row.email || '',
    city: row.city || '',
    state: row.state || '',
    course: row.course || '',
    createdAt: row.created_at
      ? new Date(row.created_at).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    verified: h.verified || clientStatus === 'high_intent',
    verifiedChannels: h.verifiedChannels,
    verificationHistory: h.verificationHistory,
    channelHistory: h.channelHistory,
    clientStatus,
    callAttempts: h.callAttempts,
    callConnected: h.callConnected,
    interactions: h.interactions,
    lastActivity: h.lastActivity,
    recordings: h.recordings,
    archived: Boolean(row.archived),
    voicebotNote: h.voicebotNote,
    source: row.source || 'CSV',
    country: row.country || 'India',
    currentState: row.current_state || STATUS_STATE[clientStatus] || undefined,
    lastConnectedAt: h.lastConnectedAt,
    lastConnectedChannel: h.lastConnectedChannel,
    agentName: h.agentName,
    interestLevel: h.interestLevel,
    interestLevelReason: h.interestLevelReason,
    qualificationStatus: h.qualificationStatus,
    qualificationReason: h.qualificationReason,
    goalAchieved: h.goalAchieved,
    goalAchievedReason: h.goalAchievedReason,
    extractedEntities: h.extractedEntities,
    convinLeadId: row.convin_lead_id || convinLead?.lead_id || undefined,
    convinPushStatus: row.convin_push_status || undefined,
    convinPushMessage: row.convin_push_message || undefined,
  }
}

function rowToCampaign(row, leads) {
  const fromLeads =
    leads.reduce(
      (s, l) => s + (l.recordings || []).reduce((a, r) => a + (Number(r.durationSec) || 0), 0),
      0,
    ) / 60
  const stored = row.minutes_consumed != null ? Number(row.minutes_consumed) : 0
  return {
    id: row.id,
    instituteId: row.institute_id,
    name: row.name,
    course: row.course,
    createdAt: row.created_at
      ? new Date(row.created_at).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    status: row.status,
    channel: row.channel || undefined,
    voicebotType: row.voicebot_type || undefined,
    minutesConsumed: Math.round(Math.max(stored, fromLeads) * 10) / 10,
    leads,
  }
}

async function convinLeadsByExternalIds(externalIds) {
  if (!externalIds?.length) return new Map()
  const pool = requireDb()
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (external_id)
       external_id, lead_id, client_status, call_attempts, call_status,
       recording_url, transcript, last_event_at, updated_at,
       COALESCE(duration_sec, NULLIF((raw->>'duration_sec')::float, 0), 0) AS duration_sec,
       raw->>'interest_level' AS interest_level,
       raw->>'interest_level_reason' AS interest_level_reason,
       COALESCE(raw->>'qualification_status', qualification_status) AS qualification_status,
       raw->>'qualification_reason' AS qualification_reason,
       COALESCE(
         CASE
           WHEN raw ? 'goal_achieved' THEN (raw->>'goal_achieved')::boolean
           ELSE goal_achieved
         END,
         goal_achieved
       ) AS goal_achieved,
       raw->>'goal_achieved_reason' AS goal_achieved_reason,
       raw->>'jee_percentile' AS jee_percentile,
       raw->>'12th_percentage' AS twelfth_percentage
     FROM leads
     WHERE external_id = ANY($1::text[])
     ORDER BY external_id, updated_at DESC`,
    [externalIds],
  )
  return new Map(rows.map((r) => [r.external_id, r]))
}

/**
 * Every webhook for these external_ids → recordings[] (one entry per call_id).
 * This is how we support multiple attempts on the same CRM lead.
 */
async function webhookRecordingsByExternalIds(externalIds) {
  if (!externalIds?.length) return new Map()
  const pool = requireDb()
  const { rows } = await pool.query(
    `SELECT id, external_id, payload, received_at
     FROM webhook_events
     WHERE external_id = ANY($1::text[])
     ORDER BY received_at ASC`,
    [externalIds],
  )
  const map = new Map()
  for (const row of rows) {
    const rec = recordingFromWebhookPayload(row.payload, `we-${row.id}`)
    if (!rec) continue
    const list = map.get(row.external_id) || []
    list.push(rec)
    map.set(row.external_id, list)
  }
  for (const [ext, list] of map) {
    map.set(ext, mergeRecordings(list))
  }
  return map
}

/** Apply webhook outcome onto crm_leads matched by external_id; bump campaign minutes. */
export async function syncCrmLeadFromWebhook(normalized, client_status) {
  if (!normalized?.external_id) return { updated: 0 }
  const pool = requireDb()
  const client = await pool.connect()
  let updated = 0
  const campaignIds = new Set()
  const status = normalizeStoredStatus(client_status)
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `SELECT id, campaign_id, raw FROM crm_leads WHERE external_id = $1 FOR UPDATE`,
      [normalized.external_id],
    )
    if (!rows.length) {
      await client.query('COMMIT')
      return { updated: 0 }
    }

    for (const row of rows) {
      const patch = buildCrmRawPatch(normalized, status, row.raw)
      await client.query(
        `UPDATE crm_leads SET
           client_status = $2,
           current_state = COALESCE($3, current_state),
           convin_lead_id = COALESCE($4, convin_lead_id),
           raw = $5::jsonb,
           updated_at = NOW()
         WHERE id = $1`,
        [
          row.id,
          status,
          normalized.current_state || STATUS_STATE[status] || null,
          normalized.lead_id,
          JSON.stringify(patch),
        ],
      )
      campaignIds.add(row.campaign_id)
      updated += 1
    }

    for (const cid of campaignIds) {
      await client.query(
        `UPDATE crm_campaigns c SET
           minutes_consumed = COALESCE((
             SELECT SUM(COALESCE((l.raw->>'talkSeconds')::float, 0)) / 60.0
             FROM crm_leads l WHERE l.campaign_id = c.id
           ), c.minutes_consumed, 0),
           updated_at = NOW()
         WHERE c.id = $1`,
        [cid],
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return { updated }
}

export async function listCrmCampaigns(instituteId) {
  if (!hasDatabase()) return []
  const pool = requireDb()
  const params = []
  let where = ''
  if (instituteId) {
    params.push(instituteId)
    where = `WHERE institute_id = $1`
  }
  const { rows: camps } = await pool.query(
    `SELECT * FROM crm_campaigns ${where} ORDER BY updated_at DESC`,
    params,
  )
  const out = []
  for (const c of camps) {
    const { rows: leadRows } = await pool.query(
      `SELECT * FROM crm_leads WHERE campaign_id = $1 ORDER BY created_at ASC`,
      [c.id],
    )
    const byExt = await convinLeadsByExternalIds(leadRows.map((r) => r.external_id))
    const byWebhook = await webhookRecordingsByExternalIds(leadRows.map((r) => r.external_id))
    out.push(
      rowToCampaign(
        c,
        leadRows.map((r) =>
          rowToLead(r, byExt.get(r.external_id), byWebhook.get(r.external_id) || []),
        ),
      ),
    )
  }
  return out
}

export async function getCrmCampaign(campaignId) {
  if (!hasDatabase()) return null
  const pool = requireDb()
  const { rows } = await pool.query(`SELECT * FROM crm_campaigns WHERE id = $1`, [campaignId])
  if (!rows[0]) return null
  const { rows: leadRows } = await pool.query(
    `SELECT * FROM crm_leads WHERE campaign_id = $1 ORDER BY created_at ASC`,
    [campaignId],
  )
  const byExt = await convinLeadsByExternalIds(leadRows.map((r) => r.external_id))
  const byWebhook = await webhookRecordingsByExternalIds(leadRows.map((r) => r.external_id))
  return rowToCampaign(
    rows[0],
    leadRows.map((r) =>
      rowToLead(r, byExt.get(r.external_id), byWebhook.get(r.external_id) || []),
    ),
  )
}

/** Backfill crm_leads push info from webhook_events / convin leads table when possible. */
export async function restorePushHintsFromLogs(campaignId) {
  if (!hasDatabase()) return { updated: 0 }
  const pool = requireDb()
  const { rowCount } = await pool.query(
    `UPDATE crm_leads cl SET
       convin_lead_id = COALESCE(cl.convin_lead_id, l.lead_id),
       client_status = CASE
         WHEN l.client_status IS NOT NULL THEN l.client_status
         ELSE cl.client_status
       END,
       updated_at = NOW()
     FROM leads l
     WHERE cl.campaign_id = $1
       AND cl.external_id = l.external_id`,
    [campaignId],
  )
  return { updated: rowCount || 0 }
}
