import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import {
  getAnalyticsLeads,
  getAnalyticsSummary,
  getCampaignAnalytics,
  getRecentWebhooks,
  ingestWebhook,
} from './analytics.js'
import { addLead, archiveLead, fetchLeads, getCampaignId } from './convin.js'
import { isEncryptionEnabled } from './crypto.js'
import { dbPing, initDb } from './db.js'
import { renderDocsHtml } from './docs.js'

const app = express()
const PORT = Number(process.env.PORT || 8787)

const origins = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || origins.includes('*') || origins.includes(origin)) {
        cb(null, true)
        return
      }
      cb(new Error(`CORS blocked: ${origin}`))
    },
  }),
)
app.use(express.json({ limit: '2mb' }))

app.get('/', (_req, res) => {
  res.redirect(302, '/docs')
})

app.get('/docs', (_req, res) => {
  res.type('html').send(renderDocsHtml())
})

app.get('/health', async (_req, res) => {
  const db = await dbPing()
  res.json({
    ok: true,
    campaign_id: process.env.CONVIN_CAMPAIGN_ID || null,
    encryption: isEncryptionEnabled(),
    has_credentials: Boolean(process.env.CONVIN_API_KEY && process.env.CONVIN_API_TOKEN),
    database: db,
  })
})

/** Push many leads sequentially to Convin (fixed campaign). */
app.post('/api/leads/push', async (req, res) => {
  try {
    const leads = Array.isArray(req.body?.leads) ? req.body.leads : []
    if (!leads.length) {
      res.status(400).json({ status: 'error', message: 'leads[] is required' })
      return
    }

    const campaign_id = getCampaignId()
    const results = []
    let success = 0
    let duplicate = 0
    let failed = 0

    for (const lead of leads) {
      const external_id = String(lead.external_id || '').trim()
      const phone_number = String(lead.phone_number || '').trim()
      if (!external_id || !phone_number) {
        failed += 1
        results.push({
          external_id: external_id || null,
          status: 'error',
          message: 'external_id and phone_number required',
        })
        continue
      }

      try {
        const { httpStatus, data } = await addLead({
          external_id,
          phone_number,
          name: lead.name,
          first_name: lead.first_name,
          last_name: lead.last_name,
        })

        const status = data?.status || (httpStatus === 409 ? 'duplicate' : 'error')
        if (status === 'success' || httpStatus === 201) {
          success += 1
        } else if (status === 'duplicate' || httpStatus === 409) {
          duplicate += 1
        } else {
          failed += 1
        }

        results.push({
          external_id,
          httpStatus,
          status,
          lead_id: data?.lead_id ?? null,
          message: data?.message ?? null,
          data,
        })
      } catch (err) {
        failed += 1
        results.push({
          external_id,
          status: 'error',
          message: err instanceof Error ? err.message : 'Push failed',
        })
      }
    }

    res.json({
      status: 'success',
      campaign_id,
      totals: { success, duplicate, failed, total: leads.length },
      results,
    })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Push failed',
    })
  }
})

/** Archive one lead by our external_id. */
app.post('/api/leads/archive', async (req, res) => {
  try {
    const external_id = String(req.body?.external_id || '').trim()
    if (!external_id) {
      res.status(400).json({ status: 'error', message: 'external_id is required' })
      return
    }
    const { httpStatus, data, ok } = await archiveLead({
      external_id,
      reason: req.body?.reason,
    })
    res.status(ok || httpStatus === 200 || httpStatus === 201 ? 200 : httpStatus).json({
      httpStatus,
      ...data,
    })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Archive failed',
    })
  }
})

/** Pull leads from Convin (reconciliation). */
app.post('/api/leads/fetch', async (req, res) => {
  try {
    const { httpStatus, data, ok } = await fetchLeads(req.body || {})
    res.status(ok ? 200 : httpStatus).json({ httpStatus, ...data })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Fetch failed',
    })
  }
})

/**
 * Vendor webhook — Convin CRM Push.
 * Maps Hot/Warm/Cold → verified / uninterested / in_progress and upserts Postgres.
 */
app.post('/webhooks/convin', async (req, res) => {
  try {
    const result = await ingestWebhook(req.body, {
      'content-type': req.headers['content-type'],
      'x-convin-signature': req.headers['x-convin-signature'],
    })
    console.info(
      '[webhook/convin]',
      result.external_id,
      result.client_status,
      result.persisted ? 'saved' : 'no-db',
    )
    res.status(200).json({
      status: 'success',
      message: 'Webhook received',
      client_status: result.client_status,
      external_id: result.external_id,
      persisted: result.persisted,
    })
  } catch (err) {
    console.error('[webhook/convin]', err)
    // Still 200 so Convin does not endlessly retry on our bug — log and fix.
    // Change to 500 if you prefer vendor retries.
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Webhook failed',
    })
  }
})

app.get('/webhooks/convin/recent', async (req, res) => {
  try {
    const events = await getRecentWebhooks(req.query.limit)
    res.json({ count: events.length, events })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Failed to load webhooks',
    })
  }
})

/** Analytics KPIs for a campaign (defaults to fixed CONVIN_CAMPAIGN_ID). */
app.get('/api/analytics/campaign/:campaignId?', async (req, res) => {
  try {
    const campaignId = req.params.campaignId || req.query.campaign_id || process.env.CONVIN_CAMPAIGN_ID
    const data = await getCampaignAnalytics(campaignId)
    res.json({ status: 'success', ...data })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Analytics failed',
    })
  }
})

app.get('/api/analytics/campaign', async (req, res) => {
  try {
    const data = await getCampaignAnalytics(req.query.campaign_id || process.env.CONVIN_CAMPAIGN_ID)
    res.json({ status: 'success', ...data })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Analytics failed',
    })
  }
})

app.get('/api/analytics/leads', async (req, res) => {
  try {
    const data = await getAnalyticsLeads({
      campaign_id: req.query.campaign_id,
      external_id: req.query.external_id,
      limit: req.query.limit,
      offset: req.query.offset,
    })
    res.json({ status: 'success', ...data })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Leads analytics failed',
    })
  }
})

app.get('/api/analytics/summary', async (_req, res) => {
  try {
    const data = await getAnalyticsSummary()
    res.json({ status: 'success', ...data })
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Summary failed',
    })
  }
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ status: 'error', message: err.message || 'Server error' })
})

await initDb()
app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`)
  console.log(`Campaign: ${process.env.CONVIN_CAMPAIGN_ID || '(unset)'}`)
  console.log(`Encryption: ${isEncryptionEnabled() ? 'ON' : 'OFF'}`)
})
