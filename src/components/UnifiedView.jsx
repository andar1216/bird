import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar from './Sidebar'
import ChatView from './ChatView'
import AppsStage from './AppsStage'
import TopBar from './TopBar'
import UsagePanel from './UsagePanel'
import { api } from '../api'
import { bird } from '../bird'
import { useApps } from '../useApps'
import { useBirdStatus } from '../useBirdStatus'
import { GrayscaleContext, useGrayscale } from '../useGrayscale'
import { mergeChat, toUiChat, toUiMessage } from '../chatModel'
import { NETWORK_ORDER } from '../data'

function matchesFilter(c, filter) {
  switch (filter) {
    case 'unread':
      return c.unread > 0 && !c.archived
    case 'low':
      return c.lowPriority && !c.archived
    case 'archive':
      return c.archived
    default:
      return !c.archived && !c.lowPriority
  }
}

function Message({ title, children }) {
  return (
    <main className="chat empty-state">
      <h2>{title}</h2>
      {children}
    </main>
  )
}

export default function UnifiedView({ user, onSignOut, theme, toggleTheme }) {
  const [chats, setChats] = useState([])
  const [load, setLoad] = useState({ status: 'loading', error: null })
  const [attempt, setAttempt] = useState(0)
  const [activeId, setActiveId] = useState(null)
  const [filter, setFilter] = useState('inbox')
  const [network, setNetwork] = useState('all')
  const [query, setQuery] = useState('')
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  // True while the official web app for `network` fills the main pane.
  const [appOpen, setAppOpen] = useState(false)
  // The profile menu is open: the native web view must step aside so it shows.
  const [menuOpen, setMenuOpen] = useState(false)
  // The screen-time page fills the main pane (the web view steps aside too).
  const [usageOpen, setUsageOpen] = useState(false)
  const gray = useGrayscale(user.id)
  const appStatus = useBirdStatus()
  const { apps, extra: extraApps, add: addApp, remove: removeApp } = useApps(user.id)

  // Tell the desktop shell whose web sessions to use (so each Bird account keeps
  // its own app logins). Declared before the select effect so the shell knows
  // the account first; cleanup closes every web view on sign out.
  useEffect(() => {
    bird?.setUser(user.id)
    return () => bird?.setUser(null)
  }, [user.id])

  useEffect(() => {
    bird?.selectNetwork(appOpen && !menuOpen && !usageOpen ? network : null)
  }, [appOpen, menuOpen, usageOpen, network, user.id])

  // The shell can ask us to show an app (e.g. a notification was clicked).
  useEffect(
    () =>
      bird?.onActiveNetwork((id) => {
        setNetwork(id)
        setAppOpen(true)
        setUsageOpen(false)
      }),
    [],
  )

  // An app icon opens that app; "All" returns to the combined inbox.
  const selectNetwork = (id) => {
    setNetwork(id)
    setAppOpen(id !== 'all')
    setUsageOpen(false)
  }

  // A rejected token means the session is gone: go back to the sign-in screen.
  const fail = useCallback(
    (err) => {
      if (err.status === 401) onSignOut()
      else setNotice(err.message)
    },
    [onSignOut],
  )

  const openChat = useCallback(
    async (id, { mobile = true } = {}) => {
      setActiveId(id)
      if (mobile) setMobileChatOpen(true)
      setChats((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0, mention: false } : c)))
      api.markRead(id).catch(fail)
      try {
        const { messages } = await api.listMessages(id)
        setChats((cs) =>
          cs.map((c) => (c.id === id ? { ...c, messages: messages.map(toUiMessage) } : c)),
        )
      } catch (err) {
        fail(err)
      }
    },
    [fail],
  )

  // Load this user's chats (and again on retry / after loading demo data).
  useEffect(() => {
    let live = true
    api
      .listChats()
      .then(({ chats: list }) => {
        if (!live) return
        setChats(list.map(toUiChat))
        setLoad({ status: 'ready', error: null })
        if (list.length) openChat(list[0].id, { mobile: false })
      })
      .catch((err) => {
        if (!live) return
        if (err.status === 401) onSignOut()
        else setLoad({ status: 'error', error: err.message })
      })
    return () => {
      live = false
    }
  }, [attempt, onSignOut, openChat])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return chats
      .filter(
        (c) =>
          matchesFilter(c, filter) &&
          (network === 'all' || appOpen || c.network === network) &&
          (!q || c.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
  }, [chats, filter, network, appOpen, query])

  const send = async (id, text) => {
    try {
      const { message, chat } = await api.sendMessage(id, text)
      setChats((cs) =>
        cs.map((c) =>
          c.id === id
            ? { ...mergeChat(c, chat), messages: [...c.messages, toUiMessage(message)] }
            : c,
        ),
      )
    } catch (err) {
      fail(err)
    }
  }

  const loadDemo = async () => {
    setLoad({ status: 'loading', error: null })
    try {
      await Promise.all(NETWORK_ORDER.map((n) => api.connect(n, 'demo')))
      setAttempt((a) => a + 1)
    } catch (err) {
      setLoad({ status: 'error', error: err.message })
    }
  }

  const active = chats.find((c) => c.id === activeId)

  let pane
  if (usageOpen) {
    pane = <UsagePanel onClose={() => setUsageOpen(false)} />
  } else if (appOpen && network !== 'all') {
    pane = <AppsStage key={network} network={network} />
  } else if (load.status === 'loading') {
    pane = <Message title="Loading your chats…" />
  } else if (load.status === 'error') {
    pane = (
      <Message title="Couldn’t load your chats">
        <p>{load.error}</p>
        <button
          className="auth-submit"
          onClick={() => {
            setLoad({ status: 'loading', error: null })
            setAttempt((a) => a + 1)
          }}
        >
          Retry
        </button>
      </Message>
    )
  } else if (chats.length === 0) {
    pane = (
      <Message title="No chats yet">
        <p>Connect your networks to see conversations here. For now you can load demo chats.</p>
        <button className="auth-submit" onClick={loadDemo}>Load demo chats</button>
      </Message>
    )
  } else {
    pane = (
      <ChatView chat={active} onSend={send} onBack={() => setMobileChatOpen(false)} />
    )
  }

  return (
    <GrayscaleContext.Provider value={gray}>
    <div className="frame">
    <TopBar
      user={user}
      onSignOut={onSignOut}
      theme={theme}
      toggleTheme={toggleTheme}
      usageOpen={usageOpen}
      onOpenUsage={() => setUsageOpen((open) => !open)}
      onMenuOpenChange={setMenuOpen}
    />
    <div className={`shell ${mobileChatOpen ? 'show-chat' : ''}`}>
      <Sidebar
        chats={visible}
        allChats={chats}
        activeId={activeId}
        onSelect={(id) => {
          setAppOpen(false)
          setUsageOpen(false)
          openChat(id)
        }}
        filter={filter}
        setFilter={setFilter}
        network={network}
        setNetwork={selectNetwork}
        appStatus={appStatus}
        apps={apps}
        extraApps={extraApps}
        onAddApp={addApp}
        onRemoveApp={(id) => {
          removeApp(id)
          if (network === id) selectNetwork('all')
        }}
        query={query}
        setQuery={setQuery}
      />
      {pane}
      {notice && (
        <button className="toast" onClick={() => setNotice(null)} role="alert">
          {notice} <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
    </div>
    </GrayscaleContext.Provider>
  )
}
