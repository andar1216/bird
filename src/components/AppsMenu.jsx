import { useEffect, useMemo, useRef, useState } from 'react'
import NetworkIcon from './NetworkIcon'
import { APPS } from '../data'
import { LIMIT_CHOICES } from '../useApps'
import { addressFromQuery, hostOf, makeCustom, searchSuggestions } from '../customApps'

// The "+" button after the app icons: every app Bird knows, each with a
// Show/Hide button, how many apps the bar shows before "More", and a search that
// finds more services or takes any web address to add as an app.
export default function AppsMenu({
  shown,
  limit,
  custom = [],
  onShow,
  onHide,
  onLimit,
  onAddCustom,
  onRemoveCustom,
  onOpenChange,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
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

  const q = query.trim().toLowerCase()
  // APPS also holds the apps this account added, so read it fresh each time.
  const apps = Object.values(APPS).filter(
    (a) => !q || a.name.toLowerCase().includes(q) || (a.blurb ?? '').toLowerCase().includes(q),
  )
  const suggestions = useMemo(() => searchSuggestions(query, custom), [query, custom])
  const address = useMemo(() => addressFromQuery(query), [query])
  // A typed address is offered unless that site is already an app.
  const addressApp = useMemo(() => {
    if (!address) return null
    const app = makeCustom({ url: address })
    return custom.some((c) => c.id === app.id) ? null : app
  }, [address, custom])

  const add = (spec) => {
    onAddCustom?.(spec)
    setQuery('')
  }

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
          <input
            className="apps-search"
            type="search"
            placeholder="Search apps, or type a web address"
            aria-label="Search apps or type a web address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && addressApp) add(addressApp)
            }}
            autoFocus
          />
          {!q && (
            <>
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
            </>
          )}
          <ul>
            {apps.map((app) => {
              const on = shown.includes(app.id)
              return (
                <li key={app.id}>
                  <NetworkIcon network={app.id} size={34} />
                  <span className="app-menu-text">
                    <span className="app-menu-name">{app.name}</span>
                    <span className="app-menu-blurb">{app.blurb}</span>
                  </span>
                  {app.custom && (
                    <button
                      className="app-menu-btn"
                      title="Remove this app and sign out of it"
                      onClick={() => onRemoveCustom?.(app.id)}
                    >
                      Remove
                    </button>
                  )}
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

          {q && (suggestions.length > 0 || addressApp) && <h3 className="apps-sub">Add</h3>}
          {q && (
            <ul>
              {suggestions.map((s) => (
                <li key={s.url}>
                  <span className="net-icon suggest-icon" aria-hidden="true">
                    {s.name.charAt(0)}
                  </span>
                  <span className="app-menu-text">
                    <span className="app-menu-name">{s.name}</span>
                    <span className="app-menu-blurb">{hostOf(s.url)}</span>
                  </span>
                  <button className="app-menu-btn primary" onClick={() => add(s)}>
                    Add
                  </button>
                </li>
              ))}
              {addressApp && (
                <li>
                  <span className="net-icon suggest-icon" aria-hidden="true">
                    {addressApp.name.charAt(0)}
                  </span>
                  <span className="app-menu-text">
                    <span className="app-menu-name">{hostOf(addressApp.url)}</span>
                    <span className="app-menu-blurb">Add this website as an app</span>
                  </span>
                  <button className="app-menu-btn primary" onClick={() => add(addressApp)}>
                    Add
                  </button>
                </li>
              )}
            </ul>
          )}
          {q && apps.length === 0 && suggestions.length === 0 && !addressApp && (
            <p className="apps-hint">
              Nothing matches. Type a website (like notion.so) to add any site as an app.
            </p>
          )}
          {!q && (
            <p className="apps-hint">
              Hiding an app keeps you signed in. Search to find more apps, or type any web address to add it.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
