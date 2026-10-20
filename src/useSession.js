import { useCallback, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api'

// status: 'loading' | 'anon' | 'authed' | 'offline' (server unreachable)
export function useSession() {
  const [state, setState] = useState({
    status: getToken() ? 'loading' : 'anon',
    user: null,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)

  // Restore the session from a saved token (and re-run on retry()).
  useEffect(() => {
    if (!getToken()) return undefined
    let live = true
    api
      .me()
      .then(({ user }) => live && setState({ status: 'authed', user, error: null }))
      .catch((err) => {
        if (!live) return
        if (err.status === 401) {
          setToken(null)
          setState({ status: 'anon', user: null, error: null })
        } else {
          setState({ status: 'offline', user: null, error: err.message })
        }
      })
    return () => {
      live = false
    }
  }, [attempt])

  // Actions are memoized: other effects depend on them and must not re-run.
  const retry = useCallback(() => {
    setState({ status: getToken() ? 'loading' : 'anon', user: null, error: null })
    setAttempt((a) => a + 1)
  }, [])

  // kind: 'login' | 'register'. Throws ApiError on failure (shown by the form).
  const signIn = useCallback(async (kind, fields) => {
    const res = kind === 'register' ? await api.register(fields) : await api.login(fields)
    setToken(res.token)
    setState({ status: 'authed', user: res.user, error: null })
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Token is dropped locally regardless; the server expires it on its own.
    }
    setToken(null)
    setState({ status: 'anon', user: null, error: null })
  }, [])

  return { ...state, retry, signIn, signOut }
}
