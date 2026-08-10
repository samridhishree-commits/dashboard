import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Scroll window (and any main page containers) to top on every navigation.
 *  If URL has a hash (e.g. #analytics), scroll that element into view. */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const id = hash.replace(/^#/, '')
      let tries = 0
      const tryScroll = () => {
        const el = document.getElementById(id)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          window.dispatchEvent(new Event('resize'))
          return
        }
        tries += 1
        if (tries < 8) window.setTimeout(tryScroll, 50)
      }
      tryScroll()
      return
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    document.querySelectorAll('.page, .main-col, .app-shell').forEach((el) => {
      if (el instanceof HTMLElement) el.scrollTop = 0
    })
  }, [pathname, search, hash])

  return null
}
