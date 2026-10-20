import { useState } from 'react'

export default function AuthForm({ onSubmit }) {
  const [kind, setKind] = useState('login')
  const [fields, setFields] = useState({ email: '', password: '', displayName: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const register = kind === 'register'

  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(kind, {
        email: fields.email,
        password: fields.password,
        ...(register ? { displayName: fields.displayName } : {}),
      })
    } catch (err) {
      const first = err.details?.[0]
      setError(first ? `${first.path}: ${first.message}` : err.message)
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <h2>{register ? 'Create your account' : 'Welcome back'}</h2>
      <p className="auth-sub">
        {register
          ? 'Your chats are stored privately, per account.'
          : 'Sign in to see your unified inbox.'}
      </p>

      {register && (
        <input
          placeholder="Display name"
          autoComplete="name"
          value={fields.displayName}
          onChange={set('displayName')}
          required
        />
      )}
      <input
        type="email"
        placeholder="Email"
        autoComplete="email"
        value={fields.email}
        onChange={set('email')}
        required
      />
      <input
        type="password"
        placeholder="Password (8+ characters)"
        autoComplete={register ? 'new-password' : 'current-password'}
        value={fields.password}
        onChange={set('password')}
        minLength={register ? 8 : undefined}
        required
      />

      {error && <p className="auth-error" role="alert">{error}</p>}

      <button className="auth-submit" type="submit" disabled={busy}>
        {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
      </button>
      <button
        type="button"
        className="auth-switch"
        onClick={() => {
          setKind(register ? 'login' : 'register')
          setError(null)
        }}
      >
        {register ? 'Have an account? Sign in' : 'New here? Create an account'}
      </button>
    </form>
  )
}
