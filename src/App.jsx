import { useEffect, useState } from 'react'
import AuthGate from './components/AuthGate'
import UnifiedView from './components/UnifiedView'
import { useSession } from './useSession'
import { loadTheme, saveTheme } from './theme'
import './App.css'

export default function App() {
  const [theme, setTheme] = useState(loadTheme)
  useEffect(() => saveTheme(theme), [theme])
  const session = useSession()
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  // Everything (chats and the web apps) lives inside an account: nothing is
  // shown until someone signs in. Keyed by user id so signing out, or into a
  // different account, starts from a clean slate.
  const content =
    session.status === 'authed' ? (
      <UnifiedView
        key={session.user.id}
        user={session.user}
        onSignOut={session.signOut}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    ) : (
      <AuthGate session={session} />
    )

  return (
    <div className={`app ${theme}`}>
      <div className="backdrop" aria-hidden="true">
        <span className="blob b1" />
        <span className="blob b2" />
        <span className="blob b3" />
      </div>
      {content}
    </div>
  )
}
