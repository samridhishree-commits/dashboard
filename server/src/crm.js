/**
 * Our CRM persistence (NOT Convin campaign_id).
 * crm_campaigns.id / crm_leads.campaign_id = Collegedunia camp-* IDs.
 * Convin push still uses env CONVIN_CAMPAIGN_ID unchanged.
 */
import { getPool, hasDatabase } from './db.js'

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

export async function setCrmCampaignStatus(campaignId, status) {
  const pool = requireDb()
  await pool.query(
    `UPDATE crm_campaigns SET status = $2, updated_at = NOW() WHERE id = $1`,
    [campaignId, status],
  )
}

function rowToLead(row) {
  const raw = typeof row.raw === 'object' && row.raw ? row.raw : {}
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
    verified: Boolean(raw.verified),
    verifiedChannels: raw.verifiedChannels || [],
    verificationHistory: raw.verificationHistory || [],
    channelHistory: raw.channelHistory || [],
    clientStatus: row.client_status || 'in_progress',
    callAttempts: Number(raw.callAttempts ?? 0),
    callConnected: Number(raw.callConnected ?? 0),
    interactions: Number(raw.interactions ?? 0),
    lastActivity: raw.lastActivity || '',
    recordings: raw.recordings || [],
    archived: Boolean(row.archived),
    voicebotNote: raw.voicebotNote,
    source: row.source || 'CSV',
    country: row.country || 'India',
    currentState: row.current_state || undefined,
    lastConnectedAt: raw.lastConnectedAt,
    lastConnectedChannel: raw.lastConnectedChannel,
    convinLeadId: row.convin_lead_id || undefined,
    convinPushStatus: row.convin_push_status || undefined,
    convinPushMessage: row.convin_push_message || undefined,
  }
}

function rowToCampaign(row, leads) {
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
    minutesConsumed: row.minutes_consumed != null ? Number(row.minutes_consumed) : undefined,
    leads,
  }
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
    out.push(rowToCampaign(c, leadRows.map(rowToLead)))
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
  return rowToCampaign(rows[0], leadRows.map(rowToLead))
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
