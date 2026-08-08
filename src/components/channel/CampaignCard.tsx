import type { Campaign } from '../../types'
import { countByClientStatus } from '../../utils/lifecycle'

function formatStarted(createdAt: string) {
  if (createdAt.includes('-') && createdAt.length === 10 && createdAt[4] === '-') {
    const [y, m, d] = createdAt.split('-')
    return `${d}/${m}/${y}`
  }
  return createdAt
}

export function CampaignCard({
  campaign,
  onOpen,
}: {
  campaign: Campaign
  onOpen: () => void
}) {
  const stats = countByClientStatus(campaign.leads)
  const minutes = Math.round((campaign.minutesConsumed ?? 0) * 10) / 10

  return (
    <button type="button" className="campaign-item" onClick={onOpen}>
      <div>
        <h4>
          {campaign.name}{' '}
          <span className={`status-pill status-${campaign.status}`}>{campaign.status}</span>
        </h4>
        <p className="muted" style={{ margin: 0 }}>
          {campaign.course} · {stats.total} leads · {stats.verified} verified ·{' '}
          {stats.uninterested} uninterested · {stats.inProgress} in progress
          {stats.invalid ? ` · ${stats.invalid} invalid` : ''} · {minutes} min ·{' '}
          {formatStarted(campaign.createdAt)}
        </p>
      </div>
      <span className="btn btn-outline btn-sm" style={{ pointerEvents: 'none' }}>
        Open
      </span>
    </button>
  )
}
