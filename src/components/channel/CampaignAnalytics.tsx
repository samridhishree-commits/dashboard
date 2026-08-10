import { useMemo, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Users,
  ShieldCheck,
  PhoneOff,
  Timer,
  Activity,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import type { Campaign } from '../../types'
import { ChartReady } from '../charts/ChartReady'
import { CHART, noPointEnds } from '../charts/chartTheme'

function pct(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function metrics(c: Campaign) {
  const leads = c.leads.filter((l) => !l.archived)
  const total = leads.length
  const valid = leads.filter((l) => l.phoneValid).length
  const invalid = leads.filter((l) => !l.phoneValid).length
  const verified = leads.filter((l) => l.clientStatus === 'verified').length
  const uninterested = leads.filter((l) => l.clientStatus === 'uninterested').length
  const inProgress = leads.filter((l) => l.clientStatus === 'in_progress').length
  const connected = leads.filter((l) => l.callConnected > 0).length
  const attempted = leads.filter((l) => l.callAttempts > 0).length
  const minutes =
    c.minutesConsumed ??
    leads.reduce((s, l) => s + l.recordings.reduce((a, r) => a + r.durationSec, 0), 0) / 60

  return {
    total,
    valid,
    invalid,
    verified,
    uninterested,
    inProgress,
    connected,
    attempted,
    minutes: Math.round(minutes * 10) / 10,
    status: c.status,
    verifyRate: pct(verified, total),
    uninterestedRate: pct(uninterested, total),
    inProgressRate: pct(inProgress, total),
    dialProgress: pct(attempted, valid || total),
  }
}

/** Synthetic weekly trend derived from campaign metrics (demo-friendly) */
function trendSeries(m: ReturnType<typeof metrics>) {
  const baseV = Math.max(m.verified, 1)
  const baseC = Math.max(m.connected, 1)
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6']
  return weeks.map((week, i) => {
    const t = (i + 1) / weeks.length
    return {
      week,
      verified: Math.round(baseV * (0.35 + t * 0.75)),
      connected: Math.round(baseC * (0.4 + t * 0.7)),
      total: Math.round(m.total * (0.45 + t * 0.55)),
    }
  })
}

function RichKpi({
  label,
  value,
  percent,
  icon,
  tone,
  up,
}: {
  label: string
  value: number
  percent: number
  icon: ReactNode
  tone: 'blue' | 'green' | 'orange' | 'red' | 'violet'
  up?: boolean
}) {
  return (
    <article className={`fx-kpi fx-kpi-${tone}`}>
      <div className="fx-kpi-top">
        <span className="fx-kpi-icon">{icon}</span>
      </div>
      <span className="fx-kpi-label">{label}</span>
      <strong className="fx-kpi-value">{value.toLocaleString('en-IN')}</strong>
      <div className={`fx-kpi-delta ${up === false ? 'down' : 'up'}`}>
        {up === false ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
        <span>{percent}% of total</span>
      </div>
    </article>
  )
}

export function CampaignAnalytics({ campaign }: { campaign: Campaign }) {
  const m = useMemo(() => metrics(campaign), [campaign])
  const trend = useMemo(() => trendSeries(m), [m])

  const mixData = [
    { name: 'Verified', value: m.verified, color: CHART.colors.green },
    { name: 'Uninterested', value: m.uninterested, color: CHART.colors.orange },
    { name: 'In Progress', value: m.inProgress, color: CHART.colors.slate },
  ].filter((d) => d.value > 0)

  const outcomeData = [
    { name: 'Verified', value: m.verified, color: CHART.colors.green },
    { name: 'Uninterested', value: m.uninterested, color: CHART.colors.orange },
    { name: 'In Progress', value: m.inProgress, color: CHART.colors.blue },
    { name: 'Invalid phone', value: m.invalid, color: '#c5ced9' },
  ].filter((d) => d.value > 0)

  const remaining = Math.max(m.valid - m.attempted, 0)

  return (
    <div className="fx-analytics">
      <div className="fx-kpi-row">
        <RichKpi
          label="Total leads"
          value={m.total}
          percent={100}
          icon={<Users size={18} />}
          tone="blue"
          up
        />
        <RichKpi
          label="Verified"
          value={m.verified}
          percent={m.verifyRate}
          icon={<ShieldCheck size={18} />}
          tone="green"
          up={m.verifyRate >= 30}
        />
        <RichKpi
          label="Uninterested"
          value={m.uninterested}
          percent={m.uninterestedRate}
          icon={<PhoneOff size={18} />}
          tone="orange"
          up={false}
        />
        <RichKpi
          label="In Progress"
          value={m.inProgress}
          percent={m.inProgressRate}
          icon={<Activity size={18} />}
          tone="violet"
          up
        />
      </div>

      <div className="fx-layout">
        <div className="fx-main">
          <section className="fx-card fx-card-lg">
            <div className="fx-card-head">
              <div>
                <h3>Verified leads trend</h3>
                <p>Weekly verified vs connected volume</p>
              </div>
              <span className="fx-pill">Campaign</span>
            </div>
            <div className="fx-legend">
              <span>
                <i style={{ background: '#16a34a' }} /> Verified
              </span>
              <span>
                <i style={{ background: '#3b82f6' }} /> Connected
              </span>
              <span>
                <i style={{ background: '#94a3b8' }} /> Total
              </span>
            </div>
            <div className="fx-chart-tall">
              <ChartReady height={260} remountKey={campaign.id}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fxVer" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.colors.green} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={CHART.colors.green} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fxCon" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.colors.blue} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={CHART.colors.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="week" tick={CHART.tick} axisLine={false} tickLine={false} />
                  <YAxis tick={CHART.tick} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART.tooltip} />
                  <Area
                    type={CHART.curve}
                    dataKey="total"
                    stroke={CHART.colors.slate}
                    fill="transparent"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                    {...noPointEnds}
                  />
                  <Area
                    type={CHART.curve}
                    dataKey="connected"
                    stroke={CHART.colors.blue}
                    fill="url(#fxCon)"
                    strokeWidth={CHART.strokeWidth}
                    strokeLinecap="round"
                    {...noPointEnds}
                  />
                  <Area
                    type={CHART.curve}
                    dataKey="verified"
                    stroke={CHART.colors.green}
                    fill="url(#fxVer)"
                    strokeWidth={CHART.strokeWidth}
                    strokeLinecap="round"
                    {...noPointEnds}
                  />
                </AreaChart>
              </ResponsiveContainer>
              </ChartReady>
            </div>
          </section>

          <div className="fx-split">
            <section className="fx-card">
              <div className="fx-card-head">
                <div>
                  <h3>Dial progress</h3>
                  <p>{m.dialProgress}% of leads attempted</p>
                </div>
                <strong className="fx-big-pct">{m.dialProgress}%</strong>
              </div>
              <div className="fx-progress-track">
                <div className="fx-progress-fill" style={{ width: `${m.dialProgress}%` }} />
              </div>
              <div className="fx-progress-meta">
                <span>
                  Attempted <strong>{m.attempted}</strong>
                </span>
                <span>
                  Remaining <strong>{remaining}</strong>
                </span>
              </div>
              <div className="fx-stat-chips">
                <div className="fx-stat-chip">
                  <ShieldCheck size={14} />
                  <div>
                    <em>Verified</em>
                    <strong>{m.verified}</strong>
                  </div>
                </div>
                <div className="fx-stat-chip">
                  <Activity size={14} />
                  <div>
                    <em>In Progress</em>
                    <strong>{m.inProgress}</strong>
                  </div>
                </div>
                <div className="fx-stat-chip">
                  <PhoneOff size={14} />
                  <div>
                    <em>Invalid</em>
                    <strong>{m.invalid}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="fx-card">
              <div className="fx-card-head">
                <div>
                  <h3>Lead mix</h3>
                  <p>Verified · Uninterested · In Progress</p>
                </div>
              </div>
              <div className="fx-donut-wrap">
                <ChartReady height={210} remountKey={`${campaign.id}-mix`}>
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={mixData.length ? mixData : [{ name: 'None', value: 1, color: '#e2e8f0' }]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="70%"
                      startAngle={180}
                      endAngle={0}
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={1}
                      stroke="#fff"
                      strokeWidth={1}
                    >
                      {(mixData.length ? mixData : [{ color: '#e2e8f0' }]).map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                      <Label
                        position="center"
                        content={({ viewBox }) => {
                          const vb = viewBox as { cx?: number; cy?: number }
                          const cx = vb?.cx ?? 0
                          const cy = (vb?.cy ?? 0) + 8
                          return (
                            <text x={cx} y={cy} textAnchor="middle">
                              <tspan x={cx} dy="-4" fontSize="22" fontWeight="700" fill="#0f172a">
                                {m.total}
                              </tspan>
                              <tspan x={cx} dy="16" fontSize="11" fill="#94a3b8">
                                leads
                              </tspan>
                            </text>
                          )
                        }}
                      />
                    </Pie>
                    <Tooltip contentStyle={CHART.tooltip} />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                </ChartReady>
              </div>
            </section>
          </div>
        </div>

        <aside className="fx-side">
          <section className="fx-card fx-balance">
            <span className="fx-kpi-label">Minutes consumed</span>
            <strong className="fx-balance-value">{m.minutes}</strong>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
              Real-time voicebot dial time
            </p>
            <div className="fx-balance-row">
              <div>
                <em>Status</em>
                <span className={`status-pill status-${m.status}`}>{m.status}</span>
              </div>
              <div>
                <em>Verify rate</em>
                <strong>{m.verifyRate}%</strong>
              </div>
            </div>
          </section>

          <section className="fx-card">
            <div className="fx-card-head">
              <div>
                <h3>Outcome snapshot</h3>
                <p>Key counts this campaign</p>
              </div>
            </div>
            <ul className="fx-list">
              {outcomeData.map((row) => (
                <li key={row.name}>
                  <span className="fx-list-dot" style={{ background: row.color }} />
                  <div>
                    <strong>{row.name}</strong>
                    <em>{pct(row.value, m.total)}% of total</em>
                  </div>
                  <b>{row.value}</b>
                </li>
              ))}
            </ul>
          </section>

          <section className="fx-card fx-minutes-card">
            <div className="fx-card-head">
              <div>
                <h3>Phone quality</h3>
                <p>Valid vs invalid (Convin skip)</p>
              </div>
              <Timer size={16} className="muted" />
            </div>
            <div className="fx-health">
              <div>
                <span>Valid</span>
                <strong>{m.valid}</strong>
              </div>
              <div>
                <span>Invalid</span>
                <strong>{m.invalid}</strong>
              </div>
            </div>
            <div className="fx-dual-bar">
              <span
                style={{
                  width: `${m.total ? (m.valid / m.total) * 100 : 0}%`,
                  background: '#2f7d57',
                }}
              />
              <span
                style={{
                  width: `${m.total ? (m.invalid / m.total) * 100 : 0}%`,
                  background: '#a85a5a',
                }}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
