const MODES = [
  { id: 'apps', label: 'Apps' },
  { id: 'unified', label: 'Unified' },
]

export default function ModeToggle({ mode, onChange }) {
  return (
    <div className="mode-toggle" role="tablist" aria-label="View mode">
      {MODES.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={mode === m.id}
          className={mode === m.id ? 'on' : ''}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
