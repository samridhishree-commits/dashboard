import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  callActivityData,
  incompleteLeads,
  leadScoreData,
  leadOriginRows,
  verifiedTrendData,
} from '../../data/mockData'
import { DateRangeBtn, Panel } from '../ui/Panel'
import { Filter } from 'lucide-react'
import { VerifiedLeadsPanel } from '../leads/VerifiedLeadsPanel'
import { CHART, noPointEnds } from './chartTheme'

function FilterTools() {
  return (
    <>
      <DateRangeBtn />
      <button type="button" className="btn btn-ghost btn-sm" aria-label="Filter">
        <Filter size={14} />
      </button>
    </>
  )
}

export function AnalyticsSuite() {
  return (
    <div className="analytics-suite">
      <Panel
        title="Lead Origin Performance"
        tip="Breakdown of lead sources — verified, unverified, and in-progress rates"
        tools={<FilterTools />}
        bodyClassName="table-wrap"
      >
        <table className="data-table light">
          <thead>
            <tr>
              <th>Lead Origin</th>
              <th>Total Leads</th>
              <th>Verified Lead%</th>
              <th>Unverified Lead%</th>
              <th>Leads in Progress%</th>
            </tr>
          </thead>
          <tbody>
            {leadOriginRows.map((row) => (
              <tr key={row.origin}>
                <td>{row.origin}</td>
                <td>{row.total.toLocaleString('en-IN')}</td>
                <td>{row.verified}%</td>
                <td>{row.unverified}%</td>
                <td>{row.inProgress}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Lead Score" tip="Distribution of leads by L1 quality score" tools={<FilterTools />}>
        <div className="chart-box chart-box-score">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={leadScoreData}
              margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
              barCategoryGap="22%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
              <XAxis
                type="number"
                tick={CHART.tick}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) =>
                  Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v)
                }
              />
              <YAxis
                type="category"
                dataKey="score"
                tick={{ ...CHART.tick, fill: '#475569', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <Tooltip
                contentStyle={CHART.tooltip}
                cursor={{ fill: 'rgba(47, 111, 237, 0.06)' }}
                formatter={(value, _n, item) => {
                  const pct = (item?.payload as { pct?: number })?.pct
                  return [`${Number(value).toLocaleString('en-IN')} (${pct}%)`, 'Leads']
                }}
              />
              <Bar dataKey="count" radius={CHART.barRadiusH} barSize={22} background={{ fill: '#f1f5f9', radius: 4 }}>
                {leadScoreData.map((entry) => (
                  <Cell key={entry.score} fill={entry.color} />
                ))}
                <LabelList
                  dataKey="pct"
                  position="right"
                  formatter={(v) => `${v}%`}
                  style={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel
        title="Verified Leads Trend"
        tip="Monthly verified vs unverified vs in-progress L1 volumes"
        tools={<FilterTools />}
      >
        <div className="fx-legend" style={{ marginBottom: 4 }}>
          <span>
            <i style={{ background: CHART.colors.green }} /> Verified
          </span>
          <span>
            <i style={{ background: CHART.colors.orange }} /> Unverified
          </span>
          <span>
            <i style={{ background: CHART.colors.blue }} /> In progress
          </span>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={verifiedTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="asVer" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.colors.green} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART.colors.green} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="asUnv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.colors.orange} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={CHART.colors.orange} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="asProg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.colors.blue} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={CHART.colors.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="month" tick={CHART.tick} axisLine={false} tickLine={false} />
              <YAxis tick={CHART.tick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={CHART.tooltip} />
              <Area
                type={CHART.curve}
                dataKey="verified"
                name="Verified"
                stroke={CHART.colors.green}
                fill="url(#asVer)"
                strokeWidth={CHART.strokeWidth}
                strokeLinecap="round"
                {...noPointEnds}
              />
              <Area
                type={CHART.curve}
                dataKey="unverified"
                name="Unverified"
                stroke={CHART.colors.orange}
                fill="url(#asUnv)"
                strokeWidth={CHART.strokeWidth}
                strokeLinecap="round"
                {...noPointEnds}
              />
              <Area
                type={CHART.curve}
                dataKey="inProgress"
                name="In progress"
                stroke={CHART.colors.blue}
                fill="url(#asProg)"
                strokeWidth={CHART.strokeWidth}
                strokeLinecap="round"
                {...noPointEnds}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel
        title="Call Activity Trend"
        tip="Voicebot call attempts and connects over time"
        tools={<FilterTools />}
      >
        <div className="fx-legend" style={{ marginBottom: 4 }}>
          <span>
            <i style={{ background: CHART.colors.blue }} /> Attempts
          </span>
          <span>
            <i style={{ background: CHART.colors.orange }} /> Connected
          </span>
        </div>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={callActivityData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="asAtt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.colors.blue} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={CHART.colors.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="asConn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.colors.orange} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={CHART.colors.orange} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="month" tick={CHART.tick} axisLine={false} tickLine={false} />
              <YAxis tick={CHART.tick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={CHART.tooltip} />
              <Area
                type={CHART.curve}
                dataKey="attempts"
                name="Attempts"
                stroke={CHART.colors.blue}
                fill="url(#asAtt)"
                strokeWidth={CHART.strokeWidth}
                strokeLinecap="round"
                {...noPointEnds}
              />
              <Area
                type={CHART.curve}
                dataKey="connected"
                name="Connected"
                stroke={CHART.colors.orange}
                fill="url(#asConn)"
                strokeWidth={CHART.strokeWidth}
                strokeLinecap="round"
                {...noPointEnds}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Incomplete Leads" tip="Missing field distribution by state, city and course" tools={<FilterTools />}>
        <div className="donut-row">
          {(
            [
              ['State', incompleteLeads.state],
              ['City', incompleteLeads.city],
              ['Course', incompleteLeads.course],
            ] as const
          ).map(([label, data]) => (
            <div className="donut-cell fx-mini-donut" key={label}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={74}
                    paddingAngle={1}
                    stroke="#fff"
                    strokeWidth={1}
                  >
                    {data.map((entry, i) => (
                      <Cell key={entry.name} fill={CHART.donut[i % CHART.donut.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART.tooltip} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
                  <text
                    x="50%"
                    y="44%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fontSize: 12, fontWeight: 650, fill: '#475569' }}
                  >
                    {label}
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </Panel>

      <VerifiedLeadsPanel />
    </div>
  )
}
