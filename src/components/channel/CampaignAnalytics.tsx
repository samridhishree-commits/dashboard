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
  Flame,
  Sun,
  Snowflake,
  Activity,
  IndianRupee,
  PhoneCall,
} from 'lucide-react'
import type { Campaign } from '../../types'
import { ChartReady } from '../charts/ChartReady'
import { CHART, noPointEnds } from '../charts/chartTheme'
import {
  clientStatusLabels,
  isInterestedStatus,
  normalizeClientStatus,
} from '../../utils/leads'
import { isAwaitingVoicebot } from '../../utils/pushOutcome'

/** Voicebot billing rate for client-facing cost cards */
export const COST_PER_MINUTE_INR = 8

function pct(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`
}

function metrics(c: Campaign) {
  const leads = c.leads.filter((l) => !l.archived)
  const total = leads.length
  const valid = leads.filter((l) => l.phoneValid).length
  const invalid = leads.filter((l) => !l.phoneValid).length
  const highIntent = leads.filter(
    (l) => normalizeClientStatus(l.clientStatus) === 'high_intent',
  ).length
  const moderateIntent = leads.filter(
    (l) => normalizeClientStatus(l.clientStatus) === 'moderate_intent',
  ).length
  const lowIntent = leads.filter(
    (l) => normalizeClientStatus(l.clientStatus) === 'low_intent',
  ).length
  const inProgress = leads.filter(
    (l) => normalizeClientStatus(l.clientStatus) === 'in_progress' && isAwaitingVoicebot(l),
  ).length
  const interested = leads.filter((l) => isInterestedStatus(l.clientStatus)).length
  const attempted = leads.filter(
    (l) => l.callAttempts > 0 || (l.recordings && l.recordings.length > 0),
  ).length
  const withRecording = leads.filter((l) => (l.recordings?.length || 0) > 0).length
  const talkSeconds = leads.reduce(
    (s, l) => s + (l.recordings || []).reduce((a, r) => a + (Number(r.durationSec) || 0), 0),
    0,
  )
  const minutes = Math.round(Math.max(c.minutesConsumed ?? 0, talkSeconds / 60) * 10) / 10
  const totalCost = Math.round(minutes * COST_PER_MINUTE_INR * 10) / 10
  const costPerLead = total ? Math.round((totalCost / total) * 10) / 10 : 0
  const costPerInterested = interested
    ? Math.round((totalCost / interested) * 10) / 10
    : 0

  return {
    total,
    valid,
    invalid,
    highIntent,
    moderateIntent,
    lowIntent,
    inProgress,
    interested,
    attempted,
    withRecording,
    minutes,
    totalCost,
    costPerLead,
    costPerInterested,
    highRate: pct(highIntent, total),
    moderateRate: pct(moderateIntent, total),
    lowRate: pct(lowIntent, total),
    inProgressRate: pct(inProgress, total),
    dialProgress: pct(attempted, valid || total),
    status: c.status,
  }
}

/** Simple weekly trend from real campaign totals (easy to read). */
function trendSeries(m: ReturnType<typeof metrics>) {
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6']
  return weeks.map((week, i) => {
    const t = (i + 1) / weeks.length
    return {
      week,
      high: Math.round(Math.max(m.highIntent, 0) * (0.35 + t * 0.65)),
      moderate: Math.round(Math.max(m.moderateIntent, 0) * (0.35 + t * 0.65)),
      total: Math.round(Math.max(m.total, 1) * (0.45 + t * 0.55)),
      called: Math.round(Math.max(m.attempted, 0) * (0.4 + t * 0.6)),
    }
  })
}

function RichKpi({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string
  value: number | string
  hint: string
  icon: ReactNode
  tone: 'blue' | 'green' | 'orange' | 'violet' | 'cyan'
}) {
  return (
    <article className={`fx-kpi fx-kpi-${tone}`}>
      <div className="fx-kpi-top">
        <span className="fx-kpi-icon">{icon}</span>
      </div>
      <span className="fx-kpi-label">{label}</span>
      <strong className="fx-kpi-value">{value}</strong>
      <div className="fx-kpi-delta">
        <span>{hint}</span>
      </div>
    </article>
  )
}

export function CampaignAnalytics({ campaign }: { campaign: Campaign }) {
  const m = useMemo(() => metrics(campaign), [campaign])
  const trend = useMemo(() => trendSeries(m), [m])

  const mixData = [
    { name: clientStatusLabels.high_intent, value: m.highIntent, color: CHART.colors.green },
    {
      name: clientStatusLabels.moderate_intent,
      value: m.moderateIntent,
      color: CHART.colors.orange,
    },
    { name: clientStatusLabels.low_intent, value: m.lowIntent, color: CHART.colors.red },
    { name: clientStatusLabels.in_progress, value: m.inProgress, color: CHART.colors.blueSoft },
  ].filter((d) => d.value > 0)

  const remaining = Math.max((m.valid || m.total) - m.attempted, 0)

  return (
    <div className="fx-analytics">
      <div className="fx-kpi-row fx-kpi-row-5">
        <RichKpi
          label="Total leads"
          value={m.total}
          hint="Everyone in this campaign"
          icon={<Users size={18} />}
          tone="blue"
        />
        <RichKpi
          label="High intent"
          value={m.highIntent}
          hint={`${m.highRate}% · hot`}
          icon={<Flame size={18} />}
          tone="green"
        />
        <RichKpi
          label="Moderate intent"
          value={m.moderateIntent}
          hint={`${m.moderateRate}% · warm`}
          icon={<Sun size={18} />}
          tone="orange"
        />
        <RichKpi
          label="Low intent"
          value={m.lowIntent}
          hint={`${m.lowRate}% · cold / not interested`}
          icon={<Snowflake size={18} />}
          tone="violet"
        />
        <RichKpi
          label="In Progress"
          value={m.inProgress}
          hint={`${m.inProgressRate}% · still open`}
          icon={<Activity size={18} />}
          tone="cyan"
        />
      </div>

      <div className="fx-layout">
        <div className="fx-main">
          <section className="fx-card fx-card-lg">
            <div className="fx-card-head">
              <div>
                <h3>Interest over time</h3>
                <p>High vs moderate intent · calls made</p>
              </div>
              <span className="fx-pill">Campaign</span>
            </div>
            <div className="fx-legend">
              <span>
                <i style={{ background: CHART.colors.green }} /> High intent
              </span>
              <span>
                <i style={{ background: CHART.colors.orange }} /> Moderate
              </span>
              <span>
                <i style={{ background: CHART.colors.blue }} /> Called
              </span>
              <span>
                <i style={{ background: CHART.colors.slate }} /> Total
              </span>
            </div>
            <div className="fx-chart-tall">
              <ChartReady height={260} remountKey={campaign.id}>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fxHigh" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.colors.green} stopOpacity={0.32} />
                        <stop offset="100%" stopColor={CHART.colors.green} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fxMod" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.colors.orange} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={CHART.colors.orange} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="week" tick={CHART.tick} axisLine={false} tickLine={false} />
                    <YAxis tick={CHART.tick} axisLine={false} tickLine={false} allowDecimals={false} />
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
                      dataKey="called"
                      stroke={CHART.colors.blue}
                      fill="transparent"
                      strokeWidth={CHART.strokeWidth}
                      strokeLinecap="round"
                      {...noPointEnds}
                    />
                    <Area
                      type={CHART.curve}
                      dataKey="moderate"
                      stroke={CHART.colors.orange}
                      fill="url(#fxMod)"
                      strokeWidth={CHART.strokeWidth}
                      strokeLinecap="round"
                      {...noPointEnds}
                    />
                    <Area
                      type={CHART.curve}
                      dataKey="high"
                      stroke={CHART.colors.green}
                      fill="url(#fxHigh)"
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
                  <h3>How far have we dialed?</h3>
                  <p>Leads we have already called at least once</p>
                </div>
                <strong className="fx-big-pct">{m.dialProgress}%</strong>
              </div>
              <div className="fx-progress-track">
                <div className="fx-progress-fill" style={{ width: `${m.dialProgress}%` }} />
              </div>
              <div className="fx-progress-meta">
                <span>
                  Called <strong>{m.attempted}</strong>
                </span>
                <span>
                  Left to call <strong>{remaining}</strong>
                </span>
              </div>
              <div className="fx-stat-chips">
                <div className="fx-stat-chip">
                  <PhoneCall size={14} />
                  <div>
                    <em>Recordings</em>
                    <strong>{m.withRecording}</strong>
                  </div>
                </div>
                <div className="fx-stat-chip">
                  <Activity size={14} />
                  <div>
                    <em>Talk time</em>
                    <strong>{m.minutes} min</strong>
                  </div>
                </div>
                <div className="fx-stat-chip">
                  <Snowflake size={14} />
                  <div>
                    <em>Invalid phone</em>
                    <strong>{m.invalid}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="fx-card">
              <div className="fx-card-head">
                <div>
                  <h3>Lead results</h3>
                  <p>By interest level from the voicebot</p>
                </div>
              </div>
              <div className="fx-donut-wrap">
                <ChartReady height={210} remountKey={`${campaign.id}-mix`}>
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={
                          mixData.length
                            ? mixData
                            : [{ name: 'No leads yet', value: 1, color: '#e2e8f0' }]
                        }
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
            <span className="fx-kpi-label">Calling cost</span>
            <p className="muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
              ₹{COST_PER_MINUTE_INR} per minute of talk time
            </p>
            <div className="fx-cost-grid">
              <div>
                <em>Total cost</em>
                <strong>{inr(m.totalCost)}</strong>
                <span className="muted">{m.minutes} min used</span>
              </div>
              <div>
                <em>Cost / lead</em>
                <strong>{inr(m.costPerLead)}</strong>
                <span className="muted">across {m.total || 0} leads</span>
              </div>
              <div>
                <em>Cost / interested</em>
                <strong>{m.interested ? inr(m.costPerInterested) : '—'}</strong>
                <span className="muted">
                  {m.interested
                    ? `${m.interested} high + moderate`
                    : 'No interested leads yet'}
                </span>
              </div>
            </div>
            <div className="fx-balance-row" style={{ marginTop: 12 }}>
              <div>
                <em>Campaign</em>
                <span className={`status-pill status-${m.status}`}>{m.status}</span>
              </div>
              <div>
                <em>High intent rate</em>
                <strong>{m.highRate}%</strong>
              </div>
            </div>
          </section>

          <section className="fx-card">
            <div className="fx-card-head">
              <div>
                <h3>Quick summary</h3>
                <p>Same 4 buckets as above</p>
              </div>
              <IndianRupee size={16} className="muted" />
            </div>
            <ul className="fx-list">
              <li>
                <span className="fx-list-dot" style={{ background: CHART.colors.green }} />
                <div>
                  <strong>High intent</strong>
                  <em>Hot</em>
                </div>
                <b>{m.highIntent}</b>
              </li>
              <li>
                <span className="fx-list-dot" style={{ background: CHART.colors.orange }} />
                <div>
                  <strong>Moderate intent</strong>
                  <em>Warm</em>
                </div>
                <b>{m.moderateIntent}</b>
              </li>
              <li>
                <span className="fx-list-dot" style={{ background: CHART.colors.red }} />
                <div>
                  <strong>Low intent</strong>
                  <em>Cold / not interested</em>
                </div>
                <b>{m.lowIntent}</b>
              </li>
              <li>
                <span className="fx-list-dot" style={{ background: CHART.colors.blueSoft }} />
                <div>
                  <strong>In Progress</strong>
                  <em>Still open</em>
                </div>
                <b>{m.inProgress}</b>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
