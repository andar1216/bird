import { useEffect, useState } from 'react'
import AppsSidebar from './components/AppsSidebar'
import AppsStage from './components/AppsStage'
import AuthGate from './components/AuthGate'
import UnifiedView from './components/UnifiedView'
import { bird } from './bird'
import { useBirdStatus } from './useBirdStatus'
import { useSession } from './useSession'
import './App.css'

export default function App() {
  const [theme, setTheme] = useState(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  // "apps": official web apps in the desktop shell (no account needed).
  // "unified": the Bird chat UI, backed by the per-user Bird server.
  const [mode, setMode] = useState(bird ? 'apps' : 'unified')
  const [activeNetwork, setActiveNetwork] = useState(null)
  const status = useBirdStatus()
  const session = useSession()

  // Tell the desktop shell which web view (if any) to show.
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

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  let content
  if (mode === 'apps') {
    content = (
      <div className="shell">
        <AppsSidebar
          activeNetwork={activeNetwork}
          onSelect={setActiveNetwork}
          status={status}
          mode={mode}
          setMode={setMode}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        <AppsStage network={activeNetwork} />
      </div>
    )
  } else if (session.status === 'authed') {
    content = (
      <UnifiedView
        key={session.user.id}
        user={session.user}
        onSignOut={session.signOut}
        mode={mode}
        setMode={setMode}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    )
  } else {
    content = <AuthGate session={session} mode={mode} setMode={setMode} />
  }

  return (
    <div className={`app ${theme} mode-${mode}`}>
      <div className="backdrop" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>
      {content}
    </div>
  )
}
