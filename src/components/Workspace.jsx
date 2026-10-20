import { useEffect, useState } from 'react'
import AppsSidebar from './AppsSidebar'
import AppsStage from './AppsStage'
import UnifiedView from './UnifiedView'
import { bird } from '../bird'
import { useBirdStatus } from '../useBirdStatus'

// Everything a signed-in account can see. Mounted once per sign-in (keyed by
// user id in App), so mode and the open app reset when the account changes.
export default function Workspace({ user, onSignOut, theme, toggleTheme }) {
  // "apps": official web apps in the desktop shell.
  // "unified": the Bird chat UI, backed by the per-user Bird server.
  const [mode, setMode] = useState(bird ? 'apps' : 'unified')
  const [activeNetwork, setActiveNetwork] = useState(null)
  const status = useBirdStatus()

  // Tell the desktop shell whose web sessions to use. Declared before the
  // selectNetwork effect so the shell knows the account first. Cleanup closes
  // every web view on sign out.
  useEffect(() => {
    bird?.setUser(user.id)
    return () => bird?.setUser(null)
  }, [user.id])

  // ...and which web view (if any) to show.
  useEffect(() => {
    bird?.selectNetwork(mode === 'apps' ? activeNetwork : null)
  }, [mode, activeNetwork])

  // The shell can ask us to switch network (e.g. a notification was clicked).
  useEffect(
    () =>
      bird?.onActiveNetwork((id) => {
        setActiveNetwork(id)
        setMode('apps')
      }),
    [],
  )

  const account = { user, onSignOut }

  return (
    <div className={`workspace mode-${mode}`}>
      {mode === 'apps' ? (
        <div className="shell">
          <AppsSidebar
            activeNetwork={activeNetwork}
            onSelect={setActiveNetwork}
            status={status}
            mode={mode}
            setMode={setMode}
            theme={theme}
            toggleTheme={toggleTheme}
            account={account}
          />
          <AppsStage network={activeNetwork} />
        </div>
      ) : (
        <UnifiedView
          user={user}
          onSignOut={onSignOut}
          mode={mode}
          setMode={setMode}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      )}
    </div>
  )
}
