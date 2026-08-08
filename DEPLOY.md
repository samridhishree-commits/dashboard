# Deploy checklist (1-hour)

## Architecture

```
Vercel (UI)  →  Render (API)  →  Convin Activate
                     ↑
              vendor webhooks
```

## 1. Fill secrets

**Render (`master_dB/server`):**
- `CONVIN_API_KEY`
- `CONVIN_API_TOKEN`
- `CONVIN_CAMPAIGN_ID=eece2f26-e1dd-4af5-9732-46ff34b15667`
- `CONVIN_AES_KEY` — leave empty (encryption OFF)
- `CORS_ORIGINS=*` (or your Vercel URL only)

**Vercel (`master_dB`):**
- `VITE_API_BASE_URL=https://YOUR_RENDER_URL`

## 2. Deploy API first (Render)

- Root directory: `server`
- Start: `npm start`
- Confirm: `GET https://YOUR_RENDER_URL/health`

## 3. Give Convin this webhook URL

```
https://YOUR_RENDER_URL/webhooks/convin
```

## 4. Deploy UI (Vercel)

- Root: `master_dB` (parent of `src`)
- Build: `npm run build`
- Output: `dist`

## 5. Smoke test (2 min — recommended)

After keys are in Render env, Postman optional:

```bash
curl -X POST https://YOUR_RENDER_URL/api/leads/push \
  -H "Content-Type: application/json" \
  -d "{\"leads\":[{\"external_id\":\"TEST001\",\"phone_number\":\"+919876543210\",\"name\":\"Test Lead\"}]}"
```

Or click **Start Campaign** in the UI with a small CSV.
