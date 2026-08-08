import type { ReactNode } from 'react'
import { Info } from 'lucide-react'

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-dot" title={text} aria-label={text}>
      <Info size={10} />
    </span>
  )
}

export function Panel({
  title,
  tip,
  tools,
  children,
  bodyClassName,
}: {
  title: string
  tip?: string
  tools?: ReactNode
  children: ReactNode
  bodyClassName?: string
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div className="panel-head-text">
          <h3 className="panel-title">
            {title}
            {tip ? <InfoTip text={tip} /> : null}
          </h3>
          {tip ? <p className="panel-sub">{tip}</p> : null}
        </div>
        {tools ? <div className="panel-tools">{tools}</div> : null}
      </div>
      <div className={`panel-body ${bodyClassName ?? ''}`}>{children}</div>
    </section>
  )
}

export function DateRangeBtn() {
  return (
    <button type="button" className="btn btn-ghost btn-sm">
      Date Range
    </button>
  )
}
