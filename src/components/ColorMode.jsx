import { useGray } from '../useGrayscale'

const CHOICES = [
  { id: 'default', label: 'Default' },
  { id: 'on', label: 'Gray' },
  { id: 'off', label: 'Color' },
]

const ROWS = [
  { kind: 'icon', label: 'App icon', hint: 'The icon in Bird’s app row' },
  { kind: 'screen', label: 'App screen', hint: 'The app’s page inside Bird' },
]

// Header button that opens the grayscale panel for one app.
export function ColorButton({ open, onToggle }) {
  return (
    <button
      className={`app-bar-btn ${open ? 'on' : ''}`}
      onClick={onToggle}
      aria-expanded={open}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.800" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
      </svg>
      Grayscale
    </button>
  )
}

// Per-app grayscale: the icon and the screen are separate. "Default" follows
// the matching switch in the profile menu; Gray / Color override it for this app.
export function ColorPanel({ network }) {
  const { defaultOn, modeOf, setMode } = useGray()
  return (
    <div className="customize-panel">
      {ROWS.map(({ kind, label, hint }) => (
        <div className="customize-row color-row" key={kind}>
          <span className="customize-text">
            <span className="customize-label">{label}</span>
            <span className="customize-desc">
              {hint}. Default is {defaultOn(kind) ? 'gray' : 'color'}.
            </span>
          </span>
          <div className="color-mode" role="radiogroup" aria-label={`${label} grayscale`}>
            {CHOICES.map((c) => (
              <button
                key={c.id}
                role="radio"
                aria-checked={modeOf(network, kind) === c.id}
                className={modeOf(network, kind) === c.id ? 'on' : ''}
                onClick={() => setMode(network, kind, c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
