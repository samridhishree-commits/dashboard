import { Check, Circle, Play, Upload } from 'lucide-react'
import type { Campaign } from '../../types'
import { campaignHasSuccessfulRun } from '../../utils/leadActivity'

export type CampaignFlowPhase = 'upload' | 'ready' | 'running' | 'completed'

export function getCampaignFlowPhase(campaign: Campaign): CampaignFlowPhase {
  const activeLeads = campaign.leads.filter((l) => !l.archived)
  if (campaignHasSuccessfulRun(campaign) || campaign.status === 'completed') return 'completed'
  if (campaign.status === 'running' || campaign.status === 'paused') return 'running'
  if (activeLeads.length > 0) return 'ready'
  return 'upload'
}

type StepDef = {
  id: string
  label: string
  description: string
}

const STEPS: StepDef[] = [
  {
    id: 'create',
    label: 'Create campaign',
    description: 'Name and course saved',
  },
  {
    id: 'upload',
    label: 'Add leads',
    description: 'Upload CSV to your campaign',
  },
  {
    id: 'run',
    label: 'Run campaign',
    description: 'Push leads to start dialing',
  },
]

function stepState(
  stepId: string,
  phase: CampaignFlowPhase,
): 'done' | 'current' | 'upcoming' {
  if (stepId === 'create') return 'done'
  if (stepId === 'upload') {
    if (phase === 'upload') return 'current'
    return 'done'
  }
  if (stepId === 'run') {
    if (phase === 'completed') return 'done'
    if (phase === 'ready' || phase === 'running') return 'current'
    return 'upcoming'
  }
  return 'upcoming'
}

function currentStepMeta(phase: CampaignFlowPhase): { index: number; label: string } {
  switch (phase) {
    case 'upload':
      return { index: 2, label: 'Add leads' }
    case 'ready':
      return { index: 3, label: 'Run campaign' }
    case 'running':
      return { index: 3, label: 'Campaign running' }
    case 'completed':
      return { index: 3, label: 'All steps complete' }
  }
}

function stepIcon(stepId: string, state: 'done' | 'current' | 'upcoming') {
  if (state === 'done') return <Check size={14} strokeWidth={3} />
  if (state === 'upcoming') return <Circle size={12} />
  if (stepId === 'upload') return <Upload size={14} />
  if (stepId === 'run') return <Play size={14} />
  return <Circle size={12} />
}

type CampaignFlowHeaderProps = {
  campaign: Campaign
  phase: CampaignFlowPhase
  freshLeadCount: number
}

export function CampaignFlowHeader({ campaign, phase, freshLeadCount }: CampaignFlowHeaderProps) {
  const activeLeads = campaign.leads.filter((l) => !l.archived)
  const validLeads = activeLeads.filter((l) => l.phoneValid).length

  const phaseMessage: Record<CampaignFlowPhase, { title: string; detail: string }> = {
    upload: {
      title: 'Upload leads to continue',
      detail: 'Your campaign is saved as a draft. Add a CSV file to reach step 3 — Run campaign.',
    },
    ready: {
      title: 'Ready to run',
      detail: `${freshLeadCount} fresh lead(s) ready. Click Run Campaign below to push leads and start dialing.`,
    },
    running: {
      title: 'Campaign in progress',
      detail: 'Leads are being dialed. Outcomes and metrics update as calls complete.',
    },
    completed: {
      title: 'Campaign has run',
      detail: 'Review lead outcomes, recordings, and intent metrics below.',
    },
  }

  const msg = phaseMessage[phase]
  const stepMeta = currentStepMeta(phase)

  return (
    <div className="campaign-flow-shell">
      <div className="campaign-flow-summary">
        <div className="campaign-flow-summary-grid">
          <div className="campaign-flow-summary-item">
            <span className="campaign-flow-summary-label">Course</span>
            <strong>{campaign.course}</strong>
          </div>
          <div className="campaign-flow-summary-item">
            <span className="campaign-flow-summary-label">Status</span>
            <span className={`status-pill status-${campaign.status}`}>{campaign.status}</span>
          </div>
          <div className="campaign-flow-summary-item">
            <span className="campaign-flow-summary-label">Leads</span>
            <strong>{activeLeads.length}</strong>
          </div>
          <div className="campaign-flow-summary-item">
            <span className="campaign-flow-summary-label">Valid phones</span>
            <strong>{validLeads}</strong>
          </div>
          <div className="campaign-flow-summary-item">
            <span className="campaign-flow-summary-label">Created</span>
            <strong>{campaign.createdAt}</strong>
          </div>
        </div>
      </div>

      <div className="campaign-flow-stepper" aria-label="Campaign setup progress">
        <p className="campaign-flow-stepper-label">
          Step {stepMeta.index} of {STEPS.length} · {stepMeta.label}
        </p>
        <ol className="campaign-flow-stepper-track">
          {STEPS.map((step, index) => {
            const state = stepState(step.id, phase)
            const isLast = index === STEPS.length - 1
            return (
              <li
                key={step.id}
                className={`campaign-flow-stepper-item campaign-flow-stepper-item--${state}`}
              >
                <div className="campaign-flow-stepper-node">
                  <span className="campaign-flow-stepper-icon" aria-hidden>
                    {stepIcon(step.id, state)}
                  </span>
                  <div className="campaign-flow-stepper-text">
                    <strong>{step.label}</strong>
                    <span>{step.description}</span>
                  </div>
                </div>
                {!isLast ? (
                  <div
                    className={`campaign-flow-stepper-connector ${
                      state === 'done' ? 'campaign-flow-stepper-connector--done' : ''
                    }`}
                    aria-hidden
                  />
                ) : null}
              </li>
            )
          })}
        </ol>
      </div>

      {phase !== 'upload' ? (
        <div className={`campaign-flow-callout campaign-flow-callout--${phase}`}>
          <strong>{msg.title}</strong>
          <p>{msg.detail}</p>
        </div>
      ) : null}
    </div>
  )
}
