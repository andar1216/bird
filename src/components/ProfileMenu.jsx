import { useEffect, useRef, useState } from 'react'
import { MoonIcon, SunIcon } from './Icons'

function initialOf(user) {
  return (user.displayName || user.username).trim()[0]?.toUpperCase() ?? '?'
}

// Profile avatar (top right) and the settings dropdown it opens.
export default function ProfileMenu({ user, onSignOut, theme, toggleTheme, onOpenChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const dark = theme === 'dark'

  // Let the parent know, e.g. to hide the desktop shell's native web view,
  // which would otherwise draw over this menu.
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

  return (
    <div className="profile" ref={ref}>
      <button
        className={`profile-btn ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account and settings"
        title={`@${user.username}`}
      >
        {initialOf(user)}
      </button>

      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-card">
            <span className="profile-avatar" aria-hidden="true">{initialOf(user)}</span>
            <span className="profile-who">
              <span className="profile-name">{user.displayName}</span>
              <span className="profile-handle">@{user.username}</span>
            </span>
          </div>

          <div className="menu-sep" />

          <button
            className="menu-item"
            role="menuitemcheckbox"
            aria-checked={dark}
            onClick={toggleTheme}
          >
            {dark ? <MoonIcon width={18} height={18} /> : <SunIcon width={18} height={18} />}
            <span className="menu-label">Dark mode</span>
            <span className={`switch ${dark ? 'on' : ''}`} aria-hidden="true" />
          </button>

          <div className="menu-sep" />

          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M10 5H6.500A1.500 1.500 0 0 0 5 6.500v11A1.500 1.500 0 0 0 6.500 19H10M15 8l4 4-4 4M19 12H9.500"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.800"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="menu-label">Sign out</span>
          </button>
        </div>
      )}
    </div>
  )
}
