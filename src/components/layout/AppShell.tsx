import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  Megaphone,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Mic,
  MessageSquare,
  Mail,
  Home,
  ArrowLeft,
  Users,
} from 'lucide-react'
import { ADMIN_USER } from '../../data/mockData'
import { WhatsAppIcon } from '../icons/WhatsAppIcon'
import { useAuth } from '../../context/AuthContext'

const channels = [
  { id: 'voicebot', label: 'Voicebot', icon: 'mic' as const },
  { id: 'sms', label: 'SMS', icon: 'sms' as const },
  { id: 'email', label: 'Email', icon: 'email' as const },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' as const },
]

function ChannelIcon({ type, size = 16 }: { type: (typeof channels)[number]['icon']; size?: number }) {
  if (type === 'whatsapp') return <WhatsAppIcon size={size} />
  if (type === 'mic') return <Mic size={size} />
  if (type === 'sms') return <MessageSquare size={size} />
  return <Mail size={size} />
}

const COLLAPSE_KEY = 'cd-sidebar-collapsed'

/** Back control — use on every page. */
export function PageBack({
  to = '/admin',
  label = 'Back',
}: {
  to?: string
  label?: string
}) {
  const navigate = useNavigate()
  return (
    <button type="button" className="btn btn-ghost btn-sm page-back" onClick={() => navigate(to)}>
      <ArrowLeft size={14} /> {label}
    </button>
  )
}

/** Compact breadcrumb — sits under/with the title, no empty nav row */
export function PageCrumb({
  items,
}: {
  items: { label: string; to?: string }[]
}) {
  const navigate = useNavigate()
  return (
    <nav className="page-crumb" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="page-crumb-seg">
          {i > 0 ? <span className="page-crumb-sep">/</span> : null}
          {item.to ? (
            <button type="button" className="page-crumb-link" onClick={() => navigate(item.to!)}>
              {item.label}
            </button>
          ) : (
            <span className="page-crumb-current">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

export function AppShell({
  children,
  showAdminBadge = false,
  showChannels = false,
  activeChannel,
}: {
  children: ReactNode
  showAdminBadge?: boolean
  showChannels?: boolean
  activeChannel?: string
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { instituteId } = useParams()
  const { user, logout, homePath } = useAuth()
  const base = instituteId ? `/institute/${instituteId}` : homePath
  const isHome =
    location.pathname === homePath ||
    location.pathname === '/admin' ||
    location.pathname === '/'
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const displayName = user?.name || ADMIN_USER.label
  const initials =
    user?.role === 'admin'
      ? 'CD'
      : (user?.name || 'U')
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar-one">
        <div className="sidebar-top">
          <button
            type="button"
            className="rail-logo"
            onClick={() => navigate(homePath)}
            title="Home"
          >
            <img
              src="/collegedunia-logo.png"
              alt="Collegedunia"
              className="rail-logo-img"
            />
          </button>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            type="button"
            className={`side-item ${isHome ? 'active' : ''}`}
            onClick={() => navigate(homePath)}
            title="Home"
          >
            <Home size={16} />
            <span className="side-label">Home</span>
          </button>

          {instituteId ? (
            <NavLink
              to={base}
              end
              className={({ isActive }) => `side-item ${isActive ? 'active' : ''}`}
              title="Dashboard"
            >
              <Megaphone size={16} />
              <span className="side-label">Dashboard</span>
            </NavLink>
          ) : (
            <span className="side-item muted-item" title="Dashboard">
              <Megaphone size={16} />
              <span className="side-label">Dashboard</span>
            </span>
          )}

          {instituteId ? (
            <NavLink
              to={`${base}/leads`}
              className={({ isActive }) => `side-item ${isActive ? 'active' : ''}`}
              title="All Leads"
            >
              <Users size={16} />
              <span className="side-label">All Leads</span>
            </NavLink>
          ) : (
            <span className="side-item muted-item" title="All Leads">
              <Users size={16} />
              <span className="side-label">All Leads</span>
            </span>
          )}

          {instituteId ? (
            <button
              type="button"
              className={`side-item ${location.pathname === base && location.hash === '#analytics' ? 'active' : ''}`}
              title="Analytics"
              onClick={() => {
                const go = () => {
                  const el = document.getElementById('analytics')
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                if (location.pathname === base) {
                  navigate(`${base}#analytics`, { replace: true })
                  // Same route: force scroll (hash-only nav can skip remount)
                  window.setTimeout(go, 30)
                  window.setTimeout(go, 120)
                } else {
                  navigate(`${base}#analytics`)
                }
              }}
            >
              <BarChart3 size={16} />
              <span className="side-label">Analytics</span>
            </button>
          ) : (
            <span className="side-item muted-item" title="Analytics">
              <BarChart3 size={16} />
              <span className="side-label">Analytics</span>
            </span>
          )}

          {showChannels && instituteId ? (
            <>
              <div className="side-divider">
                <span className="side-label">Channels</span>
              </div>
              {channels.map((ch) => (
                <NavLink
                  key={ch.id}
                  to={`${base}/${ch.id}`}
                  title={ch.label}
                  className={({ isActive }) =>
                    `side-item ${isActive || activeChannel === ch.id ? 'active' : ''}`
                  }
                >
                  <ChannelIcon type={ch.icon} />
                  <span className="side-label">{ch.label}</span>
                </NavLink>
              ))}
            </>
          ) : null}
        </nav>

        <button type="button" className="side-item settings-item" title="Settings">
          <Settings size={16} />
          <span className="side-label">Settings</span>
        </button>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="stack-h">
            <div className="brand">
              <button
                type="button"
                className="brand-home"
                onClick={() => navigate(homePath)}
                title="Collegedunia home"
              >
                <img
                  src="/collegedunia-logo.png"
                  alt="collegedunia"
                  className="brand-logo-img"
                />
              </button>
              {showAdminBadge && user?.role === 'admin' ? (
                <span className="brand-badge">admin</span>
              ) : null}
            </div>
            {!isHome ? <PageBack to={homePath} label="Back" /> : null}
          </div>
          <div className="welcome">
            <span title={user?.email || ''}>{displayName}</span>
            <div className="avatar">{initials}</div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              Logout
            </button>
          </div>
        </header>
        <div className="page">{children}</div>
      </div>
    </div>
  )
}
