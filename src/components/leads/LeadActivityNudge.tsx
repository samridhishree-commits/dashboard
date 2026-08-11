import { Radio } from 'lucide-react'
import type { LeadActivity } from '../../utils/leadActivity'
import { channelLabel } from '../../utils/leadActivity'

/** True when we should show the activity nudge (active / multi-campaign). */
export function shouldShowLeadNudge(activity: LeadActivity): boolean {
  return (
    activity.locked ||
    activity.campaignCount > 1 ||
    activity.campaigns.some((c) => c.pushed || c.running)
  )
}

export function LeadActivityNudge({ activity }: { activity: LeadActivity }) {
  if (!shouldShowLeadNudge(activity)) {
    return <span className="lead-nudge-spacer" aria-hidden />
  }

  return (
    <span className="lead-nudge-wrap" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`lead-nudge ${activity.locked ? 'lead-nudge-live' : 'lead-nudge-multi'}`}
        aria-label={`${activity.campaignCount} campaigns, ${activity.channelCount} channels`}
      >
        <Radio size={12} />
      </button>
      <div className="lead-nudge-pop" role="tooltip">
        <strong>
          Active in {activity.campaignCount} campaign{activity.campaignCount === 1 ? '' : 's'} ·{' '}
          {activity.channelCount} channel{activity.channelCount === 1 ? '' : 's'}
        </strong>
        <ul>
          {activity.campaigns.map((c) => (
            <li key={c.campaignId}>
              <span>{c.campaignName}</span>
              <em>
                {channelLabel(c.channel)}
                {c.pushed ? ' · pushed' : ''}
                {c.running ? ' · live' : ` · ${c.status}`}
              </em>
            </li>
          ))}
        </ul>
        {activity.locked ? (
          <p className="lead-nudge-note">Cannot delete while this lead is active in a campaign.</p>
        ) : null}
      </div>
    </span>
  )
}
