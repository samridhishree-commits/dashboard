import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Scroll window (and any main page containers) to top on every navigation. */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    document.querySelectorAll('.page, .main-col, .app-shell').forEach((el) => {
      if (el instanceof HTMLElement) el.scrollTop = 0
    })
  }, [pathname, search, hash])

  return null
}
