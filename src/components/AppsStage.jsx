import { useEffect, useRef, useState } from 'react'
import AppTimer from './AppTimer'
import { ColorButton, ColorPanel } from './ColorMode'
import NetworkIcon from './NetworkIcon'
import { APPS } from '../data'
import { bird } from '../bird'

// Main pane for an app: a small header (with a Customize panel when the app has
// tweaks), and below it the area where the desktop shell draws the official web
// app. We report that area's position so the shell can place the web view.
// In a browser we explain why the app isn't available.
export default function AppsStage({ network }) {
  const bodyRef = useRef(null)
  const [options, setOptions] = useState([])
  const [prefs, setPrefs] = useState({})
  const [panelOpen, setPanelOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)

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

  const net = APPS[network]
  return (
    <main className="chat apps-pane">
      <div className="app-bar">
        <NetworkIcon network={network} size={26} />
        <span className="app-bar-name">{net.name}</span>
        <AppTimer network={network} />
        <ColorButton open={colorOpen} onToggle={() => setColorOpen((o) => !o)} />
        {options.length > 0 && (
          <button
            className={`app-bar-btn ${panelOpen ? 'on' : ''}`}
            onClick={() => setPanelOpen((o) => !o)}
            aria-expanded={panelOpen}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
              <path
                d="M5 8h9M18 8h1M5 16h1M10 16h9M14 6v4M6 14v4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.800"
                strokeLinecap="round"
              />
            </svg>
            Customize
          </button>
        )}
      </div>

      {colorOpen && <ColorPanel network={network} />}

      {panelOpen && (
        <div className="customize-panel">
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
