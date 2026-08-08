import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { addLead, archiveLead, fetchLeads, getCampaignId } from './convin.js'
import { isEncryptionEnabled } from './crypto.js'

const app = express()
const PORT = Number(process.env.PORT || 8787)

const origins = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, cb) {
      // No Origin header (server-to-server / health checks) always allowed
      if (!origin || origins.includes('*') || origins.includes(origin)) {
        cb(null, true)
        return
      }
      cb(new Error(`CORS blocked: ${origin}`))
    },
  }),
)
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    campaign_id: process.env.CONVIN_CAMPAIGN_ID || null,
    encryption: isEncryptionEnabled(),
    has_credentials: Boolean(process.env.CONVIN_API_KEY && process.env.CONVIN_API_TOKEN),
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
 * Vendor webhook endpoint — give this URL to Convin.
 * POST https://<your-render-host>/webhooks/convin
 */
const webhookEvents = []
app.post('/webhooks/convin', (req, res) => {
  const event = {
    receivedAt: new Date().toISOString(),
    headers: {
      'content-type': req.headers['content-type'],
      'x-convin-signature': req.headers['x-convin-signature'],
    },
    body: req.body,
  }
  webhookEvents.unshift(event)
  if (webhookEvents.length > 200) webhookEvents.length = 200
  console.info('[webhook/convin]', JSON.stringify(event).slice(0, 2000))
  res.status(200).json({ status: 'success', message: 'Webhook received' })
})

/** Debug: recent webhook payloads (remove in prod if sensitive). */
app.get('/webhooks/convin/recent', (_req, res) => {
  res.json({ count: webhookEvents.length, events: webhookEvents.slice(0, 50) })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ status: 'error', message: err.message || 'Server error' })
})

app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`)
  console.log(`Campaign: ${process.env.CONVIN_CAMPAIGN_ID || '(unset)'}`)
  console.log(`Encryption: ${isEncryptionEnabled() ? 'ON' : 'OFF'}`)
})
