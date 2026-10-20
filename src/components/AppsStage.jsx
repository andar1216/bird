import { useEffect, useRef, useState } from 'react'
import AppTimer from './AppTimer'
import { ColorRows } from './ColorMode'
import NetworkIcon from './NetworkIcon'
import { APPS } from '../data'
import { bird } from '../bird'

// Main pane for an app: a small header (its settings icon opens a dropdown with\n// grayscale and any app tweaks), and below it the area where the desktop shell draws the official web
// app. We report that area's position so the shell can place the web view.
// In a browser we explain why the app isn't available.
export default function AppsStage({ network }) {
  const bodyRef = useRef(null)
  const [options, setOptions] = useState([])
  const [prefs, setPrefs] = useState({})
  // The per-app settings dropdown; closed until you ask for it.
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const el = bodyRef.current
    if (!bird || !el) return undefined
    const report = () => {
      const r = el.getBoundingClientRect()
      bird.setBounds({ x: r.x, y: r.y, width: r.width, height: r.height })
    }
    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    window.addEventListener('resize', report)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [])

  // What can be tweaked for this app, and what is currently on. (This component
  // is keyed by network, so a different app starts fresh.)
  useEffect(() => {
    if (!bird) return undefined
    let live = true
    Promise.all([bird.getCustomizations(), bird.getAppPrefs(network)]).then(([all, saved]) => {
      if (!live) return
      setOptions(all[network] ?? [])
      setPrefs(saved)
    })
    return () => {
      live = false
    }
  }, [network])

  const toggle = (option) => {
    const value = !prefs[option.id]
    setPrefs((p) => ({ ...p, [option.id]: value }))
    bird.setAppPref(network, option.id, value)
  }

  // Close the settings dropdown with Escape.
  useEffect(() => {
    if (!settingsOpen) return undefined
    const onKey = (e) => e.key === 'Escape' && setSettingsOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [settingsOpen])

  const net = APPS[network]
  const toggleSettings = () => setSettingsOpen((o) => !o)
  return (
    <main className="chat apps-pane">
      <div className="app-bar">
        <button
          className="app-bar-title"
          onClick={toggleSettings}
          aria-expanded={settingsOpen}
          title={`${net.name} settings`}
        >
          <NetworkIcon network={network} size={26} />
          <span className="app-bar-name">{net.name}</span>
          <svg className={`chevron ${settingsOpen ? 'up' : ''}`} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="app-bar-fill" />
        <AppTimer network={network} />
        <button
          className={`app-bar-icon ${settingsOpen ? 'on' : ''}`}
          onClick={toggleSettings}
          aria-expanded={settingsOpen}
          aria-label={`${net.name} settings`}
          title={`${net.name} settings`}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M12 15.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM19.400 13.500a7.700 7.700 0 0 0 0-3l1.900-1.500-2-3.400-2.300.9a7.700 7.700 0 0 0-2.600-1.500L14 2.500h-4l-.4 2.500a7.700 7.700 0 0 0-2.600 1.500l-2.300-.9-2 3.400 1.900 1.500a7.700 7.700 0 0 0 0 3l-1.900 1.500 2 3.400 2.300-.9c.8.700 1.700 1.200 2.600 1.500l.4 2.500h4l.4-2.500c1-.3 1.800-.8 2.600-1.500l2.300.9 2-3.400z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.600"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {settingsOpen && (
        <div className="settings-panel" role="region" aria-label={`${net.name} settings`}>
          <h4>Grayscale</h4>
          <ColorRows network={network} />

          {options.length > 0 && (
            <>
              <h4>Customize</h4>
              <div className="color-rows">
                {options.map((option) => (
                  <button
                    key={option.id}
                    className="customize-row"
                    role="switch"
                    aria-checked={Boolean(prefs[option.id])}
                    onClick={() => toggle(option)}
                  >
                    <span className="customize-text">
                      <span className="customize-label">{option.label}</span>
                      <span className="customize-desc">{option.description}</span>
                    </span>
                    <span className={`switch ${prefs[option.id] ? 'on' : ''}`} aria-hidden="true" />
                  </button>
                ))}
                <p className="customize-note">
                  These tweaks depend on how {net.name} is built and may stop working if it changes.
                </p>
              </div>
            </>
          )}
        </div>
      )}
      <div className="apps-stage-body" ref={bodyRef}>
        <NetworkIcon network={network} size={72} />
        {bird ? (
          <>
            <h2>{net.name}</h2>
            <p>Sign in once on the official site and your session stays on this device.</p>
          </>
        ) : (
          <>
            <h2>{net.name} opens in the desktop app</h2>
            <p>Run Bird as a desktop app to use the official {net.name} site here.</p>
          </>
        )}
      </div>
    </main>
  )
}
