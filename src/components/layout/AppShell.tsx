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
  LogOut,
} from 'lucide-react'
import { ADMIN_USER } from '../../data/mockData'
import { WhatsAppIcon } from '../icons/WhatsAppIcon'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'

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
  const { institutes } = useApp()
  const currentInstitute = institutes.find((i) => i.id === instituteId)
  const isInstituteUser = user?.role === 'institute'
  const base = instituteId ? `/institute/${instituteId}` : homePath
  const isAdminHome =
    !isInstituteUser &&
    (location.pathname === homePath ||
      location.pathname === '/admin' ||
      location.pathname === '/')
  const isInstituteDashboard =
    Boolean(instituteId) &&
    (location.pathname === base || location.pathname === `${base}/`)
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
            className="sidebar-brand"
            onClick={() => navigate(homePath)}
            title="CollegeDunia"
          >
            <img
              src="/collegedunia-logo.png"
              alt="CollegeDunia"
              className="sidebar-brand-img"
            />
          </button>
        </div>

        <nav className="sidebar-nav">
          {isInstituteUser ? (
            <NavLink
              to={homePath}
              end
              className={({ isActive }) => `side-item ${isActive ? 'active' : ''}`}
              title="Dashboard"
            >
              <Megaphone size={16} />
              <span className="side-label">Dashboard</span>
            </NavLink>
          ) : (
            <button
              type="button"
              className={`side-item ${isAdminHome ? 'active' : ''}`}
              onClick={() => navigate(homePath)}
              title="Home"
            >
              <Home size={16} />
              <span className="side-label">Home</span>
            </button>
          )}

          {!isInstituteUser ? (
            instituteId ? (
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
            )
          ) : null}

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
            <NavLink
              to={`${base}/analytics`}
              className={({ isActive }) => `side-item ${isActive ? 'active' : ''}`}
              title="Analytics"
            >
              <BarChart3 size={16} />
              <span className="side-label">Analytics</span>
            </NavLink>
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

        <div className="sidebar-foot">
          <button type="button" className="side-item settings-item" title="Settings">
            <Settings size={16} />
            <span className="side-label">Settings</span>
          </button>
          <button
            type="button"
            className="side-item sidebar-toggle"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            <span className="side-label">{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="topbar-left">
            {!isAdminHome && !isInstituteDashboard ? (
              <PageBack to={homePath} label="Back" />
            ) : null}
            {currentInstitute && user?.role === 'admin' ? (
              <span className="topbar-context">{currentInstitute.name}</span>
            ) : null}
          </div>
          <div className="topbar-user">
            <span className="topbar-user-name" title={user?.email || ''}>
              {displayName}
            </span>
            {showAdminBadge && user?.role === 'admin' ? (
              <span className="brand-badge">admin</span>
            ) : null}
            <div className="avatar" aria-hidden>
              {initials}
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm topbar-logout"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </header>
        <div className="page">{children}</div>
      </div>
    </div>
  )
}
