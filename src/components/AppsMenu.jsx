import { useEffect, useRef, useState } from 'react'
import NetworkIcon from './NetworkIcon'
import { APPS } from '../data'
import { LIMIT_CHOICES } from '../useApps'

// The "+" button after the app icons: every app Bird knows, each with a
// Show/Hide button, and how many apps the bar shows before "More".
export default function AppsMenu({ shown, limit, onShow, onHide, onLimit, onOpenChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Let the parent hide the native web view, which would draw over this menu.
  useEffect(() => {
    onOpenChange?.(open)
    return () => onOpenChange?.(false)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="apps-menu-wrap">
      <button
        className={`app-tab app-tab-plain ${open ? 'on' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Apps"
        aria-label="Choose apps"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="apps-menu" role="dialog" aria-label="Apps">
          <h3>Apps in the top bar</h3>
          <div className="apps-limit" role="group" aria-label="How many apps to show">
            <span>Show</span>
            {LIMIT_CHOICES.map((n) => (
              <button
                key={n ?? 'all'}
                className={`pill ${limit === n ? 'on' : ''}`}
                onClick={() => onLimit(n)}
              >
                {n ?? 'All'}
              </button>
            ))}
          </div>
          <p className="apps-hint">The rest go under More. Drag icons in the bar to reorder.</p>
          <ul>
            {Object.values(APPS).map((app) => {
              const on = shown.includes(app.id)
              return (
                <li key={app.id}>
                  <NetworkIcon network={app.id} size={34} />
                  <span className="app-menu-text">
                    <span className="app-menu-name">{app.name}</span>
                    <span className="app-menu-blurb">{app.blurb}</span>
                  </span>
                  <button
                    className={`app-menu-btn ${on ? '' : 'primary'}`}
                    onClick={() => (on ? onHide(app.id) : onShow(app.id))}
                  >
                    {on ? 'Hide' : 'Show'}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="apps-hint">Hiding an app keeps you signed in. It just takes it off the bar.</p>
        </div>
      )}
    </div>
  )
}
