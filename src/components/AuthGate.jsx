import AuthForm from './AuthForm'
import ModeToggle from './ModeToggle'

// Shown in Unified mode until the user is signed in (or when the server is down).
export default function AuthGate({ session, mode, setMode }) {
  return (
    <div className="shell gate-shell">
      <div className="gate">
        <ModeToggle mode={mode} onChange={setMode} />

        {session.status === 'loading' && <p className="gate-note">Loading…</p>}

        {session.status === 'offline' && (
          <div className="gate-offline">
            <h2>Can’t reach the Bird server</h2>
            <p>Start the database and the server, then retry:</p>
            <pre>{'npm run db\nnpm run server'}</pre>
            <button className="auth-submit" onClick={session.retry}>Retry</button>
          </div>
        )}

        {session.status === 'anon' && <AuthForm onSubmit={session.signIn} />}
      </div>
    </div>
  )
}
