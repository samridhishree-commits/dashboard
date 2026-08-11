import { useMemo, type ReactNode } from 'react'
import {
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import {
  Users,
  ShieldCheck,
  PhoneOff,
  Activity,
  IndianRupee,
  PhoneCall,
} from 'lucide-react'
import type { Campaign } from '../../types'
import { ChartReady } from '../charts/ChartReady'
import { CHART } from '../charts/chartTheme'
import { clientStatusLabels } from '../../utils/leads'

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
  const verified = leads.filter((l) => l.clientStatus === 'verified').length
  const uninterested = leads.filter((l) => l.clientStatus === 'uninterested').length
  const inProgress = leads.filter((l) => l.clientStatus === 'in_progress').length
  const attempted = leads.filter(
    (l) => l.callAttempts > 0 || (l.recordings && l.recordings.length > 0),
  ).length
  const withRecording = leads.filter((l) => (l.recordings?.length || 0) > 0).length
  const talkSeconds = leads.reduce(
    (s, l) => s + (l.recordings || []).reduce((a, r) => a + (Number(r.durationSec) || 0), 0),
    0,
  )
  const minutes =
    Math.round(
      Math.max(c.minutesConsumed ?? 0, talkSeconds / 60) * 10,
    ) / 10
  const totalCost = Math.round(minutes * COST_PER_MINUTE_INR * 10) / 10
  const costPerLead = total ? Math.round((totalCost / total) * 10) / 10 : 0
  const costPerInterested = verified
    ? Math.round((totalCost / verified) * 10) / 10
    : 0

  return {
    total,
    valid,
    invalid,
    verified,
    uninterested,
    inProgress,
    attempted,
    withRecording,
    minutes,
    totalCost,
    costPerLead,
    costPerInterested,
    verifyRate: pct(verified, total),
    uninterestedRate: pct(uninterested, total),
    inProgressRate: pct(inProgress, total),
    dialProgress: pct(attempted, valid || total),
    status: c.status,
  }
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
  tone: 'blue' | 'green' | 'orange' | 'violet'
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

  const mixData = [
    { name: clientStatusLabels.verified, value: m.verified, color: CHART.colors.green },
    {
      name: clientStatusLabels.uninterested,
      value: m.uninterested,
      color: CHART.colors.orange,
    },
    { name: clientStatusLabels.in_progress, value: m.inProgress, color: CHART.colors.slate },
  ].filter((d) => d.value > 0)

  const remaining = Math.max((m.valid || m.total) - m.attempted, 0)

  return (
    <div className="fx-analytics">
      <div className="fx-kpi-row">
        <RichKpi
          label="Total leads"
          value={m.total}
          hint="Everyone in this campaign"
          icon={<Users size={18} />}
          tone="blue"
        />
        <RichKpi
          label="Verified"
          value={m.verified}
          hint={`${m.verifyRate}% · interested / hot`}
          icon={<ShieldCheck size={18} />}
          tone="green"
        />
        <RichKpi
          label={clientStatusLabels.uninterested}
          value={m.uninterested}
          hint={`${m.uninterestedRate}% · declined interest`}
          icon={<PhoneOff size={18} />}
          tone="orange"
        />
        <RichKpi
          label="In Progress"
          value={m.inProgress}
          hint={`${m.inProgressRate}% · still open`}
          icon={<Activity size={18} />}
          tone="violet"
        />
      </div>

      <div className="fx-layout">
        <div className="fx-main">
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
                  <PhoneOff size={14} />
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
                  <p>One simple view of outcomes</p>
                </div>
              </div>
              <div className="fx-donut-wrap">
                <ChartReady height={210} remountKey={`${campaign.id}-mix`}>
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={
                          mixData.length ? mixData : [{ name: 'No leads yet', value: 1, color: '#e2e8f0' }]
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
                <strong>{m.verified ? inr(m.costPerInterested) : '—'}</strong>
                <span className="muted">
                  {m.verified ? `${m.verified} verified` : 'No verified leads yet'}
                </span>
              </div>
            </div>
            <div className="fx-balance-row" style={{ marginTop: 12 }}>
              <div>
                <em>Campaign</em>
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
                <h3>Quick summary</h3>
                <p>What the numbers mean</p>
              </div>
              <IndianRupee size={16} className="muted" />
            </div>
            <ul className="fx-list">
              <li>
                <span className="fx-list-dot" style={{ background: CHART.colors.green }} />
                <div>
                  <strong>Verified</strong>
                  <em>Interested / goal met</em>
                </div>
                <b>{m.verified}</b>
              </li>
              <li>
                <span className="fx-list-dot" style={{ background: CHART.colors.orange }} />
                <div>
                  <strong>{clientStatusLabels.uninterested}</strong>
                  <em>Warm / cold / declined</em>
                </div>
                <b>{m.uninterested}</b>
              </li>
              <li>
                <span className="fx-list-dot" style={{ background: CHART.colors.blue }} />
                <div>
                  <strong>In Progress</strong>
                  <em>Still being worked</em>
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
