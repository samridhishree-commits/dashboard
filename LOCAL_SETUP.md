# Run locally

Quick guide to start the CollegeDunia CRM on your machine.

**Also see:** [IMPROVEMENTS.md](./IMPROVEMENTS.md) — shipped UI changes and backend backlog.

## Prerequisites

- **Node.js 18+** (`node -v` to check)
- **npm** (comes with Node)
- **Git** (to pull updates)

## 1. Get the code

```powershell
cd "D:\office projects\voicebot"
git pull origin main
```

## 2. Install dependencies

Run in the **project root**, then in **server**:

```powershell
cd "D:\office projects\voicebot"
npm install

cd server
npm install
```

## 3. Start the app (two terminals)

You need **two terminals** — one for the API, one for the UI.

### Terminal 1 — API (backend)

```powershell
cd "D:\office projects\voicebot\server"
npm run dev
```

Wait until you see the server listening on port **8787**.

- Health check: http://localhost:8787/health
- API docs: http://localhost:8787/docs

### Terminal 2 — UI (frontend)

```powershell
cd "D:\office projects\voicebot"
npm run dev
```

Open **http://localhost:5173** in your browser.

> **Tip:** Do not run `cd ..` from the project folder before `npm run dev` — that moves you to `D:\office projects`, which has no `package.json`.

## URLs

| Service | URL |
|---------|-----|
| CRM UI | http://localhost:5173 |
| API | http://localhost:8787 |
| API health | http://localhost:8787/health |
| API docs | http://localhost:8787/docs |

In dev, Vite proxies `/api`, `/webhooks`, and `/health` to the API on port 8787. You do **not** need `VITE_API_BASE_URL` for local UI.

## Optional — Convin & database (real voicebot push)

For **UI-only** (mock data, dashboards, CSV upload): skip this section. Start only the UI if you like — Terminal 2 is enough.

For **real lead push to Convin** and webhook storage:

1. Copy env file in `server`:

   ```powershell
   cd "D:\office projects\voicebot\server"
   copy .env.example .env
   ```

2. Edit `server/.env` and set:

   | Variable | Required | Notes |
   |----------|----------|-------|
   | `CONVIN_API_KEY` | Yes | From Convin Activate |
   | `CONVIN_API_TOKEN` | Yes | From Convin Activate |
   | `CONVIN_CAMPAIGN_ID` | Yes | Default is in `.env.example` |
   | `CONVIN_AES_KEY` | No | Leave empty if encryption is off |
   | `CORS_ORIGINS` | No | `*` is fine for local dev |
   | `DATABASE_URL` | No | Postgres for webhook/analytics; API still runs without it |

3. Start **both** Terminal 1 (API) and Terminal 2 (UI).

## Quick smoke test

1. Open http://localhost:5173
2. Go to **Admin** → pick an institute → **Open dashboard**
3. Create a campaign, upload a CSV (template: `public/lead_import_template.csv`)
4. **Run Campaign** → **Voicebot** (needs API + Convin keys)

API only:

```powershell
curl http://localhost:8787/health
```

## Common issues

| Problem | Fix |
|---------|-----|
| `ENOENT` / no `package.json` | You are in the wrong folder. Use `cd "D:\office projects\voicebot"` |
| UI loads but push fails | Start the API in Terminal 1; check Convin keys in `server/.env` |
| Port 8787 in use | Stop the other process or change `PORT` in `server/.env` |
| Port 5173 in use | Vite will offer another port, or stop the other dev server |
| `npm install` errors after pull | Run `npm install` again in root and in `server` |

## After pulling new code from GitHub

```powershell
cd "D:\office projects\voicebot"
git pull origin main
npm install
cd server
npm install
```

Then restart both `npm run dev` processes.

## App flow (what to click)

1. **Admin** — select institute → Open dashboard
2. **Campaigns** — add campaign, upload CSV
3. **Run Campaign** — Email / SMS / WhatsApp / Voicebot
4. **Voicebot** — pick type, run, view leads, recordings, archive
