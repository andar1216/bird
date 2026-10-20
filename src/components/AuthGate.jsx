import AuthForm from './AuthForm'

// Shown until someone signs in (or when the server can't be reached).
export default function AuthGate({ session }) {
  return (
    <div className="shell gate-shell">
      <div className="gate">
        <h1 className="gate-brand">Bird</h1>

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
