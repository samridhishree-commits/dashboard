import { type ReactNode } from 'react'
import {
  Users,
  Layers,
  ShieldCheck,
  ShieldAlert,
  BadgeCheck,
  Link2,
  X,
} from 'lucide-react'

const iconMap = {
  users: Users,
  layers: Layers,
  verified: ShieldCheck,
  unverified: ShieldAlert,
  multi: Link2,
  badge: BadgeCheck,
} as const

const colorMap = {
  blue: { fg: '#3b6ea5', bg: '#eef4f9' },
  purple: { fg: '#6b6578', bg: '#f3f2f5' },
  orange: { fg: '#b7791f', bg: '#faf4eb' },
  green: { fg: '#2f7d57', bg: '#eef7f2' },
  red: { fg: '#a85a5a', bg: '#f8eeee' },
  slate: { fg: '#5b6572', bg: '#f2f4f6' },
} as const

export function KpiCard({
  label,
  value,
  tip,
  hint,
  icon = 'users',
  color = 'blue',
  onClick,
  active,
}: {
  label: string
  value: number | string
  tip?: string
  hint?: string
  icon?: keyof typeof iconMap
  color?: keyof typeof colorMap
  onClick?: () => void
  active?: boolean
}) {
  const Icon = iconMap[icon]
  const tone = colorMap[color]
  const formatted =
    typeof value === 'number' ? value.toLocaleString('en-IN') : value
  const clickable = Boolean(onClick)

  const inner = (
    <>
      <div className="kpi-icon" style={{ color: tone.fg, background: tone.bg }}>
        <Icon size={18} strokeWidth={1.85} />
      </div>
      <div className="kpi-label">
        {label}
        {tip ? (
          <span className="info-dot" title={tip}>
            i
          </span>
        ) : null}
      </div>
      <div className="kpi-value">{formatted}</div>
      {hint ? <div className="kpi-hint">{hint}</div> : null}
    </>
  )

  if (clickable) {
    return (
      <button
        type="button"
        className={`kpi-card kpi-card-btn ${active ? 'is-active' : ''}`}
        onClick={onClick}
      >
        {inner}
      </button>
    )
  }

  return <div className="kpi-card">{inner}</div>
}

/** Detail panel under KPIs — can sit side-by-side with siblings */
export function KpiPopover({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null

  return (
    <div className="kpi-popover" role="dialog" aria-label={title}>
      <div className="kpi-popover-head">
        <strong>{title}</strong>
        <button
          type="button"
          className="kpi-popover-x"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={16} strokeWidth={2.25} />
        </button>
      </div>
      <div className="kpi-popover-body">{children}</div>
    </div>
  )
}
