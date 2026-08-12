import { FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { user, login, homePath } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'admin' | 'user'>('admin')
  const [email, setEmail] = useState('pushp.ranjan@collegedunia.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) {
    return <Navigate to={homePath} replace />
  }

  const switchMode = (next: 'admin' | 'user') => {
    setMode(next)
    setError(null)
    setPassword('')
    setEmail(
      next === 'admin'
        ? 'pushp.ranjan@collegedunia.com'
        : 'jain.university@collegedunia.com',
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const logged = await login(email.trim(), password)
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

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/collegedunia-logo.png" alt="Collegedunia" />
          <h1>CRM Login</h1>
          <p className="muted">Lead qualification dashboard</p>
        </div>

        <div className="login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={mode === 'admin' ? 'active' : ''}
            aria-selected={mode === 'admin'}
            onClick={() => switchMode('admin')}
          >
            Admin
          </button>
          <button
            type="button"
            role="tab"
            className={mode === 'user' ? 'active' : ''}
            aria-selected={mode === 'user'}
            onClick={() => switchMode('user')}
          >
            Institute user
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="login-form">
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="login-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
