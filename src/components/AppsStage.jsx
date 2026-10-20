import { useEffect, useRef } from 'react'
import NetworkIcon from './NetworkIcon'
import { APPS } from '../data'
import { bird } from '../bird'

// Main pane for an app. In the desktop shell the official web app is drawn
// over this element, so we report where it is; in a browser we explain why
// it's not available.
export default function AppsStage({ network }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
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

  const net = APPS[network]
  return (
    <main className="chat empty-state apps-stage" ref={ref}>
      <NetworkIcon network={network} size={72} />
      {bird ? (
        <>
          <h2>Opening {net.name}…</h2>
          <p>Sign in once on the official site and your session stays on this device.</p>
        </>
      ) : (
        <>
          <h2>{net.name} opens in the desktop app</h2>
          <p>Run Bird as a desktop app to use the official {net.name} site here.</p>
        </>
      )}
    </main>
  )
}
