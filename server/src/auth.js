/**
 * Fixed two-account auth (no user DB).
 * Admin + one institute user (Jain University).
 */
import crypto from 'crypto'

const AUTH_SECRET = process.env.AUTH_SECRET || 'cd-crm-dev-auth-secret-change-me'

/** @type {Array<{ email: string, password: string, role: 'admin' | 'institute', instituteId: string | null, name: string }>} */
const ACCOUNTS = [
  {
    email: 'pushp.ranjan@collegedunia.com',
    password: process.env.ADMIN_PASSWORD || 'Collegedunia@123',
    role: 'admin',
    instituteId: null,
    name: 'CollegeDunia Admin',
  },
  {
    email: 'jain.university@collegedunia.com',
    password: process.env.JAIN_PASSWORD || 'Jainuniversity@123',
    role: 'institute',
    instituteId: 'jain-university',
    name: 'Jain University',
  },
]

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64').toString('utf8')
}

export function findAccount(email, password) {
  const e = String(email || '')
    .trim()
    .toLowerCase()
  const p = String(password || '')
  const acct = ACCOUNTS.find((a) => a.email.toLowerCase() === e)
  if (!acct || acct.password !== p) return null
  return {
    email: acct.email,
    role: acct.role,
    instituteId: acct.instituteId,
    name: acct.name,
  }
}

export function issueToken(user) {
  const payload = {
    email: user.email,
    role: user.role,
    instituteId: user.instituteId,
    name: user.name,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  }
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(crypto.createHmac('sha256', AUTH_SECRET).update(body).digest())
  return `${body}.${sig}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expect = b64url(crypto.createHmac('sha256', AUTH_SECRET).update(body).digest())
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(fromB64url(body))
    if (!payload?.exp || payload.exp < Date.now()) return null
    if (!payload.email || !payload.role) return null
    return {
      email: payload.email,
      role: payload.role,
      instituteId: payload.instituteId ?? null,
      name: payload.name || payload.email,
    }
  } catch {
    return null
  }
}

/** Attach req.user when Bearer token is valid (does not 401). */
export function optionalAuth(req, _res, next) {
  const h = req.headers.authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  if (m) {
    const user = verifyToken(m[1].trim())
    if (user) req.user = user
  }
  next()
}

/** Require valid login token. */
export function requireAuth(req, res, next) {
  const h = req.headers.authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(h)
  const user = m ? verifyToken(m[1].trim()) : null
  if (!user) {
    res.status(401).json({ status: 'error', message: 'Login required' })
    return
  }
  req.user = user
  next()
}
