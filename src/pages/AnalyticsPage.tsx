import { useNavigate, useParams } from 'react-router-dom'
import { AppShell, PageCrumb } from '../components/layout/AppShell'
import { AnalyticsSuite } from '../components/charts/AnalyticsSuite'
import { useApp } from '../context/AppContext'

const channelShortcuts = [
  { label: 'Calls', path: 'voicebot' },
  { label: 'SMS', path: 'sms' },
  { label: 'Email', path: 'email' },
  { label: 'WhatsApp', path: 'whatsapp' },
] as const

export function AnalyticsPage() {
  const { instituteId = '' } = useParams()
  const navigate = useNavigate()
  const { institutes } = useApp()
  const institute = institutes.find((i) => i.id === instituteId)

  if (!institute) {
    return (
      <AppShell showChannels>
        <h1 className="page-title">Institute not found</h1>
      </AppShell>
    )
  }

  return (
    <AppShell showChannels>
      <div className="page-header">
        <PageCrumb
          items={[
            { label: 'Dashboard', to: `/institute/${instituteId}` },
            { label: 'Analytics' },
          ]}
        />
        <h1 className="page-title">{institute.name} · Analytics</h1>
        <p className="page-sub">Lead origin, call activity, and channel performance</p>
      </div>

      <div className="section-gap" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {channelShortcuts.map((ch) => (
          <button
            key={ch.path}
            type="button"
            className="btn btn-outline"
            onClick={() => navigate(`/institute/${instituteId}/${ch.path}`)}
          >
            {ch.label}
          </button>
        ))}
      </div>

      <div className="section-gap">
        <AnalyticsSuite />
      </div>
    </AppShell>
  )
}
