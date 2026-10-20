import { useCallback, useEffect, useState } from 'react'
import AppBar from './AppBar'
import ProfileMenu from './ProfileMenu'

export default function TopBar({
  user,
  onSignOut,
  theme,
  toggleTheme,
  usageOpen,
  onOpenUsage,
  onOpenMatrix,
  onHome,
  appBar,
  onMenuOpenChange,
}) {
  // Several menus can open from here; the native web view steps aside while any is.
  const [menus, setMenus] = useState({})
  const track = useCallback(
    (name, open) => setMenus((m) => (m[name] === open ? m : { ...m, [name]: open })),
    [],
  )
  const onProfileOpen = useCallback((open) => track('profile', open), [track])
  const onAppsOpen = useCallback((open) => track('apps', open), [track])
  const anyOpen = Object.values(menus).some(Boolean)
  useEffect(() => {
    onMenuOpenChange?.(anyOpen)
  }, [anyOpen, onMenuOpenChange])

  return (
    <header className="topbar">
      <button className="topbar-brand" onClick={onHome} title="All chats">
        <img src="/bird.png" alt="" width="30" height="30" />
        Bird
      </button>
      <AppBar {...appBar} onOpenChange={onAppsOpen} />
      <div className="topbar-right">
        <button
          className={`topbar-btn ${usageOpen ? 'on' : ''}`}
          onClick={onOpenUsage}
          aria-pressed={usageOpen}
          title="Screen time"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M5 19V11M12 19V5M19 19v-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.200"
              strokeLinecap="round"
            />
          </svg>
          Screen time
        </button>
        <ProfileMenu
          user={user}
          onSignOut={onSignOut}
          theme={theme}
          toggleTheme={toggleTheme}
          onOpenChange={onProfileOpen}
          onOpenMatrix={onOpenMatrix}
        />
      </div>
    </header>
  )
}
