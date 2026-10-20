import { useEffect, useRef, useState } from 'react'
import NetworkIcon from './NetworkIcon'
import { WEB_APPS } from '../data'

// The "+" button in the app row, and the menu of apps it adds.
export default function AddAppMenu({ extra, onAdd, onRemove }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

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
    <div ref={ref} className="add-app">
      <button
        className={`net-chip icon-only add-chip ${open ? 'on' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Add an app"
        aria-label="Add an app"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="app-menu" role="dialog" aria-label="Add an app">
          <h3>Add an app</h3>
          <ul>
            {Object.values(WEB_APPS).map((app) => {
              const added = extra.includes(app.id)
              return (
                <li key={app.id}>
                  <NetworkIcon network={app.id} size={36} />
                  <span className="app-menu-text">
                    <span className="app-menu-name">{app.name}</span>
                    <span className="app-menu-blurb">{app.blurb}</span>
                  </span>
                  <button
                    className={`app-menu-btn ${added ? '' : 'primary'}`}
                    onClick={() => (added ? onRemove(app.id) : onAdd(app.id))}
                  >
                    {added ? 'Remove' : 'Add'}
                  </button>
                </li>
              )
            })}
          </ul>
          <p>Each opens the official site. Logins stay on this device, per account.</p>
        </div>
      )}
    </div>
  )
}
