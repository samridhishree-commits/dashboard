# Master DB API (Render)

Thin Node proxy between the Vercel UI and Convin Activate.

## Endpoints for you / vendor

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health + config check |
| POST | `/api/leads/push` | Body `{ leads: [{ external_id, phone_number, name? }] }` → Convin `lead/add` |
| POST | `/api/leads/archive` | Body `{ external_id, reason? }` → Convin `lead/archive` |
| POST | `/api/leads/fetch` | Proxy to Convin `leads/fetch` |
| POST | `/webhooks/convin` | **Give this URL to Convin** for CRM push / call events |
| GET | `/webhooks/convin/recent` | Debug recent webhook payloads |

Fixed Convin campaign: `CONVIN_CAMPAIGN_ID` (default `eece2f26-e1dd-4af5-9732-46ff34b15667`).

## Env (Render dashboard)

Copy from `.env.example`:

- `CONVIN_API_KEY`
- `CONVIN_API_TOKEN`
- `CONVIN_CAMPAIGN_ID`
- `CONVIN_AES_KEY` — leave empty if encryption is OFF
- `CORS_ORIGINS` — `*` (default) or lock to `https://your-app.vercel.app`

## Deploy (Render)

1. New Web Service → root `master_dB/server`
2. Build: `npm install`
3. Start: `npm start`
4. Add env vars from `.env.example` (paste real keys in Render dashboard, not in git)
5. Vendor webhook URL: `https://<your-service>.onrender.com/webhooks/convin`

## Vercel UI

Set `VITE_API_BASE_URL=https://<your-service>.onrender.com` in Vercel env, then redeploy.
