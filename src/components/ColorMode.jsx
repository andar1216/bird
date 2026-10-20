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

// Per-app grayscale: the icon and the screen are separate. "Default" follows
// the matching switch in the profile menu; Gray / Color override it for this app.
export function ColorRows({ network }) {
  const { defaultOn, modeOf, setMode } = useGray()
  return (
    <div className="color-rows">
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
