const BASE = process.env.RENDER_EXTERNAL_URL || 'https://dashboard-85cy.onrender.com'

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/health',
    desc: 'Health check + DB ping + credential flags',
  },
  {
    method: 'GET',
    path: '/docs',
    desc: 'This API documentation page',
  },
  {
    method: 'POST',
    path: '/api/leads/push',
    desc: 'Upload leads to fixed Convin campaign',
    body: '{ "leads": [{ "external_id", "phone_number", "name?" }] }',
  },
  {
    method: 'POST',
    path: '/api/leads/archive',
    desc: 'Archive lead on Convin by our external_id',
    body: '{ "external_id", "reason?" }',
  },
  {
    method: 'POST',
    path: '/api/leads/fetch',
    desc: 'Proxy Convin leads/fetch (reconciliation)',
    body: '{ "campaign_id?" | "external_id?" | "lead_id?", "limit?", "offset?" }',
  },
  {
    method: 'POST',
    path: '/webhooks/convin',
    desc: 'Convin CRM Push webhook — maps Hot/Warm/Cold → verified/uninterested/in_progress, writes Postgres',
    body: 'CRM Push payload (external_id, interest_level, qualification_status, goal_achieved, …)',
  },
  {
    method: 'GET',
    path: '/webhooks/convin/recent',
    desc: 'Recent webhook events from Postgres',
  },
  {
    method: 'GET',
    path: '/api/analytics/campaign',
    desc: 'KPI totals for campaign (defaults to CONVIN_CAMPAIGN_ID)',
  },
  {
    method: 'GET',
    path: '/api/analytics/leads',
    desc: 'Lead rows with mapped client_status',
    query: '?campaign_id=&external_id=&limit=&offset=',
  },
  {
    method: 'GET',
    path: '/api/analytics/summary',
    desc: 'Overall + by-campaign analytics totals',
  },
  {
    method: 'GET',
    path: '/api/crm/campaigns',
    desc: 'List OUR CRM campaigns (camp-* ids) with leads — not Convin campaign_id',
    query: '?institute_id=',
  },
  {
    method: 'POST',
    path: '/api/crm/campaigns',
    desc: 'Upsert CRM campaign + optional leads[] into Postgres',
  },
  {
    method: 'POST',
    path: '/api/crm/campaigns/:id/leads',
    desc: 'Append uploaded CSV leads under OUR campaign id',
  },
  {
    method: 'POST',
    path: '/api/crm/campaigns/:id/push-results',
    desc: 'Save Convin push outcomes against OUR campaign (Convin /api/leads/push unchanged)',
  },
  {
    method: 'POST',
    path: '/api/crm/campaigns/:id/leads/delete',
    desc: 'Hard-delete CRM leads by id[] (removes from crm_leads)',
    body: '{ "leadIds": ["lead-…"] }',
  },
]

export function renderDocsHtml() {
  const rows = ENDPOINTS.map(
    (e) => `
    <tr>
      <td><code class="m ${e.method.toLowerCase()}">${e.method}</code></td>
      <td><a href="${e.method === 'GET' ? BASE + e.path : '#'}"><code>${e.path}</code></a></td>
      <td>${e.desc}${e.body ? `<div class="muted">Body: <code>${e.body}</code></div>` : ''}${
        e.query ? `<div class="muted">Query: <code>${e.query}</code></div>` : ''
      }</td>
    </tr>`,
  ).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Master DB API Docs</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; padding: 32px; background: #f6f8fb; color: #122033; }
    main { max-width: 920px; margin: 0 auto; background: #fff; border: 1px solid #e5ebf3; border-radius: 12px; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 1.5rem; }
    p { color: #516174; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6b7c90; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
    .m { padding: 2px 6px; border-radius: 4px; font-weight: 700; }
    .get { background: #e8f5ee; color: #0f7a45; }
    .post { background: #eaf1ff; color: #1d4ed8; }
    .muted { margin-top: 6px; color: #6b7c90; font-size: 12px; }
    .box { background: #f8fafc; border: 1px solid #e5ebf3; border-radius: 8px; padding: 12px 14px; margin-top: 16px; }
  </style>
</head>
<body>
  <main>
    <h1>Master DB API</h1>
    <p>Render backend for Convin lead push, archive, webhooks, and analytics.</p>
    <div class="box">
      <div><strong>Base URL</strong> · <code>${BASE}</code></div>
      <div style="margin-top:8px"><strong>Vendor webhook</strong> · <code>${BASE}/webhooks/convin</code></div>
      <div style="margin-top:8px"><strong>Fixed campaign</strong> · <code>eece2f26-e1dd-4af5-9732-46ff34b15667</code></div>
    </div>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="box" style="margin-top:24px">
      <strong>Status mapping</strong>
      <p style="margin:8px 0 0">Hot / goal_achieved → <code>verified</code> · Warm / Cold / Not Interested → <code>uninterested</code> · else → <code>in_progress</code></p>
    </div>
  </main>
</body>
</html>`
}
