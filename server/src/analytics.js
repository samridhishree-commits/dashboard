import { getPool, hasDatabase } from './db.js'
import { mapClientStatus, normalizeWebhookBody } from './mapStatus.js'

export async function ingestWebhook(body, meta = {}) {
  const normalized = normalizeWebhookBody(body)
  const client_status = mapClientStatus(normalized)
  const campaign_id =
    normalized.campaign_id ||
    process.env.CONVIN_CAMPAIGN_ID ||
    ''

  if (!hasDatabase()) {
    return {
      persisted: false,
      client_status,
      external_id: normalized.external_id,
      campaign_id,
      normalized,
    }
  }

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO webhook_events (event, external_id, campaign_id, lead_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        normalized.event,
        normalized.external_id,
        campaign_id,
        normalized.lead_id,
        JSON.stringify({ ...body, _meta: meta }),
      ],
    )

    if (normalized.external_id) {
      await client.query(
        `INSERT INTO leads (
          external_id, campaign_id, lead_id, name, phone, email,
          client_status, qualification_status, interest_level, goal_achieved,
          current_state, call_attempts, call_status, recording_url, transcript,
          last_connected_at, last_connected_channel, last_event, last_event_at, raw, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,
          $7,$8,$9,$10,
          $11,$12,$13,$14,$15,
          $16,$17,$18,$19,$20, NOW()
        )
        ON CONFLICT (external_id, campaign_id) DO UPDATE SET
          lead_id = COALESCE(EXCLUDED.lead_id, leads.lead_id),
          name = COALESCE(EXCLUDED.name, leads.name),
          phone = COALESCE(EXCLUDED.phone, leads.phone),
          email = COALESCE(EXCLUDED.email, leads.email),
          client_status = EXCLUDED.client_status,
          qualification_status = COALESCE(EXCLUDED.qualification_status, leads.qualification_status),
          interest_level = COALESCE(EXCLUDED.interest_level, leads.interest_level),
          goal_achieved = COALESCE(EXCLUDED.goal_achieved, leads.goal_achieved),
          current_state = COALESCE(EXCLUDED.current_state, leads.current_state),
          call_attempts = GREATEST(COALESCE(EXCLUDED.call_attempts, 0), COALESCE(leads.call_attempts, 0)),
          call_status = COALESCE(EXCLUDED.call_status, leads.call_status),
          recording_url = COALESCE(EXCLUDED.recording_url, leads.recording_url),
          transcript = COALESCE(EXCLUDED.transcript, leads.transcript),
          last_connected_at = COALESCE(EXCLUDED.last_connected_at, leads.last_connected_at),
          last_connected_channel = COALESCE(EXCLUDED.last_connected_channel, leads.last_connected_channel),
          last_event = COALESCE(EXCLUDED.last_event, leads.last_event),
          last_event_at = COALESCE(EXCLUDED.last_event_at, leads.last_event_at),
          raw = EXCLUDED.raw,
          updated_at = NOW()`,
        [
          normalized.external_id,
          campaign_id,
          normalized.lead_id,
          normalized.name,
          normalized.phone,
          normalized.email,
          client_status,
          normalized.qualification_status,
          normalized.interest_level,
          normalized.goal_achieved,
          normalized.current_state,
          normalized.call_attempts,
          normalized.call_status,
          normalized.recording_url,
          normalized.transcript,
          normalized.last_connected_at,
          normalized.last_connected_channel,
          normalized.event,
          normalized.timestamp || new Date().toISOString(),
          JSON.stringify(body),
        ],
      )
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  // Sync outcomes into OUR crm_leads by external_id (best-effort; table may not exist pre-deploy)
  if (normalized.external_id && hasDatabase()) {
    try {
      const pool2 = getPool()
      await pool2.query(
        `UPDATE crm_leads SET
           client_status = $2,
           current_state = COALESCE($3, current_state),
           convin_lead_id = COALESCE($4, convin_lead_id),
           raw = COALESCE(raw, '{}'::jsonb) || $5::jsonb,
           updated_at = NOW()
         WHERE external_id = $1`,
        [
          normalized.external_id,
          client_status,
          normalized.current_state ||
            (client_status === 'verified'
              ? 'Verified'
              : client_status === 'uninterested'
                ? 'Uninterested'
                : 'In Progress'),
          normalized.lead_id,
          JSON.stringify({
            lastWebhookAt: new Date().toISOString(),
            interest_level: normalized.interest_level,
            qualification_status: normalized.qualification_status,
            goal_achieved: normalized.goal_achieved,
            call_attempts: normalized.call_attempts,
            recording_url: normalized.recording_url,
            transcript: normalized.transcript,
            call_status: normalized.call_status,
          }),
        ],
      )
    } catch (err) {
      console.warn('[webhook] crm_leads sync skipped:', err instanceof Error ? err.message : err)
    }
  }

  return {
    persisted: true,
    client_status,
    external_id: normalized.external_id,
    campaign_id,
    lead_id: normalized.lead_id,
    normalized,
  }
}

export async function getRecentWebhooks(limit = 50) {
  if (!hasDatabase()) return []
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT id, received_at, event, external_id, campaign_id, lead_id, payload
     FROM webhook_events
     ORDER BY received_at DESC
     LIMIT $1`,
    [Math.min(Number(limit) || 50, 200)],
  )
  return rows
}

export async function getCampaignAnalytics(campaignId) {
  const cid = campaignId || process.env.CONVIN_CAMPAIGN_ID || ''
  if (!hasDatabase()) {
    return {
      campaign_id: cid,
      totals: emptyTotals(),
      db: false,
    }
  }
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE client_status = 'verified')::int AS verified,
       COUNT(*) FILTER (WHERE client_status = 'uninterested')::int AS uninterested,
       COUNT(*) FILTER (WHERE client_status = 'in_progress')::int AS in_progress,
       COALESCE(SUM(call_attempts), 0)::int AS call_attempts,
       COUNT(*) FILTER (WHERE recording_url IS NOT NULL AND recording_url <> '')::int AS with_recording,
       COUNT(*) FILTER (WHERE goal_achieved IS TRUE)::int AS goal_achieved
     FROM leads
     WHERE ($1 = '' OR campaign_id = $1)`,
    [cid],
  )
  const r = rows[0] || {}
  return {
    campaign_id: cid,
    db: true,
    totals: {
      total: r.total || 0,
      verified: r.verified || 0,
      uninterested: r.uninterested || 0,
      in_progress: r.in_progress || 0,
      call_attempts: r.call_attempts || 0,
      with_recording: r.with_recording || 0,
      goal_achieved: r.goal_achieved || 0,
    },
  }
}

export async function getAnalyticsLeads({ campaign_id, external_id, limit = 100, offset = 0 } = {}) {
  if (!hasDatabase()) return { db: false, count: 0, data: [] }
  const cid = campaign_id || process.env.CONVIN_CAMPAIGN_ID || ''
  const pool = getPool()
  const params = []
  const where = []

  if (cid) {
    params.push(cid)
    where.push(`campaign_id = $${params.length}`)
  }
  if (external_id) {
    params.push(external_id)
    where.push(`external_id = $${params.length}`)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  params.push(Math.min(Number(limit) || 100, 500))
  const lim = `$${params.length}`
  params.push(Math.max(Number(offset) || 0, 0))
  const off = `$${params.length}`

  const { rows } = await pool.query(
    `SELECT external_id, campaign_id, lead_id, name, phone, email,
            client_status, qualification_status, interest_level, goal_achieved,
            current_state, call_attempts, call_status, recording_url, transcript,
            last_connected_at, last_connected_channel, last_event, last_event_at,
            updated_at, created_at
     FROM leads
     ${whereSql}
     ORDER BY updated_at DESC
     LIMIT ${lim} OFFSET ${off}`,
    params,
  )

  return { db: true, count: rows.length, data: rows }
}

export async function getAnalyticsSummary() {
  if (!hasDatabase()) {
    return { db: false, totals: emptyTotals(), by_campaign: [] }
  }
  const pool = getPool()
  const { rows: totalsRows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE client_status = 'verified')::int AS verified,
       COUNT(*) FILTER (WHERE client_status = 'uninterested')::int AS uninterested,
       COUNT(*) FILTER (WHERE client_status = 'in_progress')::int AS in_progress,
       COALESCE(SUM(call_attempts), 0)::int AS call_attempts
     FROM leads`,
  )
  const { rows: byCampaign } = await pool.query(
    `SELECT campaign_id,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE client_status = 'verified')::int AS verified,
            COUNT(*) FILTER (WHERE client_status = 'uninterested')::int AS uninterested,
            COUNT(*) FILTER (WHERE client_status = 'in_progress')::int AS in_progress
     FROM leads
     GROUP BY campaign_id
     ORDER BY total DESC`,
  )
  const t = totalsRows[0] || {}
  return {
    db: true,
    totals: {
      total: t.total || 0,
      verified: t.verified || 0,
      uninterested: t.uninterested || 0,
      in_progress: t.in_progress || 0,
      call_attempts: t.call_attempts || 0,
    },
    by_campaign: byCampaign,
  }
}

function emptyTotals() {
  return {
    total: 0,
    verified: 0,
    uninterested: 0,
    in_progress: 0,
    call_attempts: 0,
    with_recording: 0,
    goal_achieved: 0,
  }
}
