import { useEffect, useRef, useState } from 'react'
import NetworkIcon from './NetworkIcon'
import { LayersIcon } from './Icons'
import { APPS } from '../data'

const nameOf = (id) => APPS[id]?.name ?? (id === 'matrix' ? 'Matrix' : id)

// The button beside "All Chats" and the menu that picks which apps show there.
export default function ScopeMenu({ options, scope }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const shownCount = options.filter(scope.isShown).length
  const filtered = shownCount < options.length

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
    <div className="scope" ref={ref}>
      <button
        className={`icon-btn ${filtered ? 'scoped' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose which apps show in All Chats"
        aria-expanded={open}
        title={`Showing ${shownCount} of ${options.length} apps`}
      >
        <LayersIcon />
      </button>

      {open && (
        <div className="scope-menu" role="dialog" aria-label="Apps in All Chats">
          <h3>Show in All Chats</h3>
          <div className="scope-quick">
            <button className="pill" onClick={() => scope.setShown(options, true)}>
              All apps
            </button>
            <button className="pill" onClick={() => scope.setShown(options, false)}>
              No apps
            </button>
          </div>
          <ul>
            {options.map((id) => {
              const on = scope.isShown(id)
              return (
                <li key={id}>
                  <button
                    className="scope-row"
                    role="switch"
                    aria-checked={on}
                    onClick={() => scope.toggle(id)}
                  >
                    <NetworkIcon network={id} size={28} />
                    <span className="scope-name">{nameOf(id)}</span>
                    <span className={`switch ${on ? 'on' : ''}`} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
