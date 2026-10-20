import { useEffect, useRef } from 'react'
import NetworkIcon from './NetworkIcon'
import { NETWORKS } from '../data'
import { bird } from '../bird'

// Placeholder pane. In the desktop shell the selected network's web view is
// drawn on top of this element, sized from the bounds reported here.
export default function AppsStage({ network }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !bird) return undefined
    const report = () => {
      const r = el.getBoundingClientRect()
      bird.setBounds({ x: r.x, y: r.y, width: r.width, height: r.height })
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    window.addEventListener('resize', report)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [])

  let content
  if (!bird) {
    content = (
      <>
        <h2>Apps mode runs in the desktop app</h2>
        <p>
          Start it with <code>npm run electron:dev</code>. In a browser, switch to Unified.
        </p>
      </>
    )
  } else if (network) {
    content = (
      <>
        <NetworkIcon network={network} size={48} />
        <h2>Loading {NETWORKS[network].name}…</h2>
      </>
    )
  } else {
    content = (
      <>
        <div className="empty-art">
          <span className="orb o1" />
          <span className="orb o2" />
          <span className="orb o3" />
        </div>
        <h2>Pick an app</h2>
        <p>Sign in once and your session stays on this device.</p>
      </>
    )
  }

  return (
    <main className="chat empty-state apps-stage" ref={ref}>
      {content}
    </main>
  )
}
