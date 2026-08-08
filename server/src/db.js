import pg from 'pg'

const { Pool } = pg

let pool = null

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function getPool() {
  if (!hasDatabase()) return null
  if (!pool) {
    const connectionString = process.env.DATABASE_URL.trim()
    const isLocal =
      connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 5,
    })
  }
  return pool
}

export async function initDb() {
  const p = getPool()
  if (!p) {
    console.warn('[db] DATABASE_URL not set — analytics persistence disabled')
    return false
  }

  await p.query(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id BIGSERIAL PRIMARY KEY,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      event TEXT,
      external_id TEXT,
      campaign_id TEXT,
      lead_id TEXT,
      payload JSONB NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_webhook_events_received
      ON webhook_events (received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_external
      ON webhook_events (external_id);

    CREATE TABLE IF NOT EXISTS leads (
      external_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL DEFAULT '',
      lead_id TEXT,
      name TEXT,
      phone TEXT,
      email TEXT,
      client_status TEXT NOT NULL DEFAULT 'in_progress',
      qualification_status TEXT,
      interest_level TEXT,
      goal_achieved BOOLEAN,
      current_state TEXT,
      call_attempts INTEGER DEFAULT 0,
      call_status TEXT,
      recording_url TEXT,
      transcript TEXT,
      last_connected_at TIMESTAMPTZ,
      last_connected_channel TEXT,
      last_event TEXT,
      last_event_at TIMESTAMPTZ,
      raw JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (external_id, campaign_id)
    );

    CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads (campaign_id);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (client_status);
    CREATE INDEX IF NOT EXISTS idx_leads_updated ON leads (updated_at DESC);
  `)

  console.log('[db] schema ready')
  return true
}

export async function dbPing() {
  const p = getPool()
  if (!p) return { ok: false, reason: 'no DATABASE_URL' }
  try {
    await p.query('SELECT 1')
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'db error' }
  }
}
