import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { AlertCircle, Building2, Eye, EyeOff, Loader2, Shield } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type LoginMode = 'user' | 'admin'

const LAST_ROLE_KEY = 'cd-crm-login-role'
const LAST_EMAIL_KEY = 'cd-crm-login-email'

const DEMO_EMAIL: Record<LoginMode, string> = {
  user: 'jain.university@collegedunia.com',
  admin: 'pushp.ranjan@collegedunia.com',
}

const MODE_COPY: Record<LoginMode, { title: string; hint: string; placeholder: string }> = {
  user: {
    title: 'Institute sign in',
    hint: 'Use your institute account to manage campaigns and leads.',
    placeholder: 'you@institute.edu',
  },
  admin: {
    title: 'Admin sign in',
    hint: 'CollegeDunia operators can open any institute dashboard.',
    placeholder: 'you@collegedunia.com',
  },
}

function readLastRole(): LoginMode {
  try {
    const stored = localStorage.getItem(LAST_ROLE_KEY)
    if (stored === 'user' || stored === 'admin') return stored
  } catch {
    /* ignore */
  }
  return 'user'
}

function readLastEmail(mode: LoginMode): string {
  try {
    const raw = localStorage.getItem(LAST_EMAIL_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<LoginMode, string>>
      const saved = parsed[mode]?.trim()
      if (saved) return saved
    }
  } catch {
    /* ignore */
  }
  return DEMO_EMAIL[mode]
}

function writeLastRole(mode: LoginMode) {
  try {
    localStorage.setItem(LAST_ROLE_KEY, mode)
  } catch {
    /* ignore */
  }
}

function writeLastEmail(mode: LoginMode, email: string) {
  try {
    const raw = localStorage.getItem(LAST_EMAIL_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<LoginMode, string>>) : {}
    parsed[mode] = email
    localStorage.setItem(LAST_EMAIL_KEY, JSON.stringify(parsed))
  } catch {
    /* ignore */
  }
}

export function LoginPage() {
  const { user, login, homePath } = useAuth()
  const navigate = useNavigate()
  const passwordRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<LoginMode>(readLastRole)
  const [email, setEmail] = useState(() => readLastEmail(readLastRole()))
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (email.trim()) passwordRef.current?.focus()
  }, [])

  if (user) {
    return <Navigate to={homePath} replace />
  }

  const switchMode = (next: LoginMode) => {
    if (busy || next === mode) return
    setMode(next)
    writeLastRole(next)
    setError(null)
    setPassword('')
    setShowPassword(false)
    setCapsOn(false)
    const nextEmail = readLastEmail(next)
    setEmail(nextEmail)
    if (nextEmail.trim()) window.setTimeout(() => passwordRef.current?.focus(), 0)
  }

  const onToggleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    switchMode(e.key === 'ArrowLeft' ? 'user' : 'admin')
  }

  const onPasswordKey = (e: KeyboardEvent<HTMLInputElement>) => {
    setCapsOn(e.getModifierState('CapsLock'))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const trimmed = email.trim()
    try {
      writeLastRole(mode)
      writeLastEmail(mode, trimmed)
      const logged = await login(trimmed, password)
      const dest =
        logged.role === 'institute' && logged.instituteId
          ? `/institute/${logged.instituteId}`
          : '/admin'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  const copy = MODE_COPY[mode]

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/collegedunia-logo.png" alt="Collegedunia" />
          <p className="login-product">CollegeDunia CRM</p>
          <h1>{copy.title}</h1>
          <p className="login-hint">{copy.hint}</p>
        </div>

        <div
          className="login-tabs"
          role="radiogroup"
          aria-label="Sign in as"
          onKeyDown={onToggleKeyDown}
        >
          <button
            type="button"
            role="radio"
            className={mode === 'user' ? 'active' : ''}
            aria-checked={mode === 'user'}
            disabled={busy}
            onClick={() => switchMode('user')}
          >
            <Building2 size={15} />
            Institute user
          </button>
          <button
            type="button"
            role="radio"
            className={mode === 'admin' ? 'active' : ''}
            aria-checked={mode === 'admin'}
            disabled={busy}
            onClick={() => switchMode('admin')}
          >
            <Shield size={15} />
            Admin
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="login-form">
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="login-input"
              type="email"
              autoComplete="username"
              placeholder={copy.placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              required
              aria-invalid={Boolean(error)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <div className="login-password-wrap">
              <input
                ref={passwordRef}
                id="login-password"
                className="login-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={onPasswordKey}
                onKeyDown={onPasswordKey}
                disabled={busy}
                required
                aria-invalid={Boolean(error)}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={busy}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {capsOn ? <p className="login-caps">Caps Lock is on</p> : null}
          </div>
          {error ? (
            <p className="login-error" role="alert">
              <AlertCircle size={15} />
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <Loader2 size={16} className="login-spinner" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="login-foot">
          {mode === 'user'
            ? 'Need access? Ask your CollegeDunia account manager.'
            : 'Admin access is limited to CollegeDunia operators.'}
        </p>
      </div>
    </div>
  )
}
