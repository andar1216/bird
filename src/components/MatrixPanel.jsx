import { useEffect, useState } from 'react'
import { api } from '../api'

// Connect Bird to a Matrix account. Real chats (WhatsApp, Instagram, Discord,
// ...) arrive through bridges running on that homeserver; see infra/matrix.
export default function MatrixPanel({ onClose, onChanged }) {
  const [account, setAccount] = useState(undefined) // undefined = loading
  const [form, setForm] = useState({ homeserver: '', username: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let live = true
    api
      .matrixAccount()
      .then((r) => live && setAccount(r.account))
      .catch((err) => live && (setAccount(null), setError(err.message)))
    return () => {
      live = false
    }
  }, [])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const connect = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { account: next } = await api.connectMatrix(form)
      setAccount(next)
      setForm((f) => ({ ...f, password: '' }))
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.disconnectMatrix()
      setAccount(null)
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="chat usage-pane">
      <div className="app-bar">
        <span className="app-bar-name">Matrix and bridges</span>
        <button className="app-bar-btn" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="usage-scroll">
        <section className="usage-card matrix-card">
          <h3>Account</h3>
          {account === undefined ? (
            <p className="usage-note">Loading…</p>
          ) : account ? (
            <>
              <p className="matrix-who">{account.mxid}</p>
              <p className="usage-note">
                {account.status === 'syncing'
                  ? `Connected to ${account.homeserver}. New messages arrive in the background.`
                  : `Not syncing with ${account.homeserver}.`}
              </p>
              {account.status === 'error' && (
                <p className="auth-error" role="alert">
                  {account.lastError || 'Something went wrong.'} If it keeps failing, disconnect
                  and connect again.
                </p>
              )}
              <button className="matrix-danger" onClick={disconnect} disabled={busy}>
                Disconnect and remove these chats from Bird
              </button>
            </>
          ) : (
            <form className="auth-form" onSubmit={connect}>
              <input
                placeholder="Homeserver (e.g. matrix.example.com)"
                value={form.homeserver}
                onChange={set('homeserver')}
                autoComplete="off"
                spellCheck="false"
                required
              />
              <input
                placeholder="Matrix username"
                value={form.username}
                onChange={set('username')}
                autoComplete="off"
                spellCheck="false"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={set('password')}
                autoComplete="off"
                required
              />
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? 'Connecting…' : 'Connect'}
              </button>
              <p className="usage-note">
                Your password is used once to sign in. Bird stores an encrypted access token, not
                the password.
              </p>
            </form>
          )}
          {account && error && <p className="auth-error" role="alert">{error}</p>}
        </section>

        <section className="usage-card">
          <h3>How real chats get here</h3>
          <p className="usage-note">
            Bird reads chats from a Matrix homeserver. Bridges on that server (WhatsApp, Instagram,
            Messenger, Discord, Telegram, Slack, Google Messages) copy each app’s conversations
            into Matrix rooms, with full history, and Bird shows them in All chats and lets you
            reply. Set the server up with <code>infra/matrix</code> in the Bird repository, then
            sign in here.
          </p>
          <p className="usage-note">
            Bridged rooms must not be end-to-end encrypted; Bird cannot read encrypted rooms.
          </p>
        </section>
      </div>
    </main>
  )
}
