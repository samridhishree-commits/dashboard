import { useEffect, useState, type ReactNode } from 'react'

/**
 * Defers chart mount one frame and fires a resize so Recharts ResponsiveContainer
 * measures correctly after client-side navigation (avoids blank charts until refresh).
 */
export function ChartReady({
  children,
  height = 260,
  remountKey,
}: {
  children: ReactNode
  height?: number
  remountKey?: string | number
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)
    const raf = requestAnimationFrame(() => {
      setReady(true)
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 40)
    })
    return () => cancelAnimationFrame(raf)
  }, [remountKey])

  return (
    <div className="chart-ready" style={{ width: '100%', height }}>
      {ready ? children : null}
    </div>
  )
}
