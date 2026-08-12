import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AuthRole = 'admin' | 'institute'

export type AuthUser = {
  email: string
  role: AuthRole
  instituteId: string | null
  name: string
}

type AuthState = {
  user: AuthUser | null
  token: string | null
  ready: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => void
  homePath: string
}

const STORAGE_KEY = 'cd-crm-auth'

const AuthContext = createContext<AuthState | null>(null)

function apiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  return (raw || '').replace(/\/$/, '')
}

function loadStored(): { token: string; user: AuthUser } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { token?: string; user?: AuthUser }
    if (!parsed?.token || !parsed?.user?.email || !parsed?.user?.role) return null
    return { token: parsed.token, user: parsed.user }
  } catch {
    return null
  }
}

export function getAuthToken(): string | null {
  return loadStored()?.token ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = loadStored()
  const [token, setToken] = useState<string | null>(stored?.token ?? null)
  const [user, setUser] = useState<AuthUser | null>(stored?.user ?? null)

  const persist = useCallback((nextToken: string | null, nextUser: AuthUser | null) => {
    setToken(nextToken)
    setUser(nextUser)
    try {
      if (nextToken && nextUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${apiBase()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        status?: string
        message?: string
        token?: string
        user?: AuthUser
      }
      if (!res.ok || !data.token || !data.user) {
        throw new Error(data.message || 'Invalid email or password')
      }
      persist(data.token, data.user)
      return data.user
    },
    [persist],
  )

  const logout = useCallback(() => {
    persist(null, null)
  }, [persist])

  const homePath =
    user?.role === 'institute' && user.instituteId
      ? `/institute/${user.instituteId}`
      : '/admin'

  const value = useMemo(
    () => ({
      user,
      token,
      ready: true,
      login,
      logout,
      homePath,
    }),
    [user, token, login, logout, homePath],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
