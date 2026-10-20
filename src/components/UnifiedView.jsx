import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './Sidebar'
import ChatView from './ChatView'
import AppsStage from './AppsStage'
import TopBar from './TopBar'
import UsagePanel from './UsagePanel'
import MatrixPanel from './MatrixPanel'
import { api } from '../api'
import { bird } from '../bird'
import { useApps } from '../useApps'
import { useBirdStatus } from '../useBirdStatus'
import { GrayscaleContext, useGrayscale } from '../useGrayscale'
import { mergeChat, toUiChat, toUiMessage } from '../chatModel'
import { INBOX_PREFIX, useInbox } from '../useInbox'
import { useAllChatsScope } from '../useAllChatsScope'

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
  // A full-pane page: 'usage' (screen time) or 'matrix' (account setup).
  // The native web view steps aside while one is open.
  const [panel, setPanel] = useState(null)
  const usageOpen = panel === 'usage'
  const gray = useGrayscale(user.id)
  const appStatus = useBirdStatus()
  const appList = useApps(user.id)
  const { apps } = appList

  // Tell the desktop shell whose web sessions to use (so each Bird account keeps
  // its own app logins). Declared before the select effect so the shell knows
  // the account first; cleanup closes every web view on sign out.
  useEffect(() => {
    bird?.setUser(user.id)
    return () => bird?.setUser(null)
  }, [user.id])

  // Keep the apps on the bar running in the background so their notifications
  // (and unread counts) arrive even before you open them.
  useEffect(() => {
    bird?.setBackgroundApps?.(apps)
  }, [apps, user.id])

  useEffect(() => {
    bird?.selectNetwork(appOpen && !menuOpen && !panel ? network : null)
  }, [appOpen, menuOpen, panel, network, user.id])

  // The shell can ask us to show an app (e.g. a notification was clicked).
  useEffect(
    () =>
      bird?.onActiveNetwork((id) => {
        setNetwork(id)
        setAppOpen(true)
        setPanel(null)
      }),
    [],
  )

  // An app icon opens that app; "All" returns to the combined inbox.
  const selectNetwork = (id) => {
    setNetwork(id)
    setAppOpen(id !== 'all')
    setPanel(null)
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

  // Pick up changes made on the server in the background (the Matrix sync adds
  // chats and messages while Bird is open). Keeps loaded messages; if the open
  // chat got something new, reload its messages too.
  const chatsRef = useRef(chats)
  const activeRef = useRef(activeId)
  useEffect(() => {
    chatsRef.current = chats
    activeRef.current = activeId
  })

  const refreshChats = useCallback(async () => {
    try {
      const { chats: fresh } = await api.listChats()
      const old = new Map(chatsRef.current.map((c) => [c.id, c]))
      const open = activeRef.current
      const openChanged =
        open && old.has(open) && fresh.some((f) => f.id === open && f.lastMessageAt !== old.get(open).lastMessageAt)
      setChats(
        fresh.map((f) => {
          const was = old.get(f.id)
          const next = was ? mergeChat(was, f) : toUiChat(f)
          return f.id === open && openChanged ? { ...next, unread: 0, mention: false } : next
        }),
      )
      if (openChanged) {
        api.markRead(open).catch(() => {})
        const { messages } = await api.listMessages(open)
        setChats((cs) => cs.map((c) => (c.id === open ? { ...c, messages: messages.map(toUiMessage) } : c)))
      }
    } catch (err) {
      if (err.status === 401) onSignOut()
      // other failures are transient: try again on the next tick
    }
  }, [onSignOut])

  useEffect(() => {
    if (load.status !== 'ready') return undefined
    const timer = setInterval(() => {
      if (!document.hidden) refreshChats()
    }, 8000)
    return () => clearInterval(timer)
  }, [load.status, refreshChats])

  // Load this user's chats (and again on retry).
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

  // Conversations the apps told us about through notifications, next to the
  // server's chats. Opening one opens its app.
  const appChats = useInbox()
  const everyChat = useMemo(
    () => [...chats, ...appChats],
    [chats, appChats],
  )

  // Which apps All Chats includes (all of them down to none).
  const scope = useAllChatsScope(user.id)
  const scopeOptions = useMemo(
    () => [...new Set([...apps, ...everyChat.map((c) => c.network)])],
    [apps, everyChat],
  )
  const inScope = useMemo(() => everyChat.filter((c) => scope.isShown(c.network)), [everyChat, scope])

  const openFromApp = (chat) => {
    bird?.markInboxRead(chat.id.slice(INBOX_PREFIX.length))
    if (chat.openPath) bird?.openAppChat?.(chat.network, chat.openPath)
    selectNetwork(chat.network)
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return everyChat
      .filter(
        (c) =>
          matchesFilter(c, filter) &&
          (network === 'all' ? scope.isShown(c.network) : appOpen || c.network === network) &&
          (!q || c.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
  }, [everyChat, filter, network, appOpen, query, scope])

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

  const active = chats.find((c) => c.id === activeId)

  let pane
  if (panel === 'matrix') {
    pane = <MatrixPanel onClose={() => setPanel(null)} onChanged={refreshChats} />
  } else if (usageOpen) {
    pane = <UsagePanel onClose={() => setPanel(null)} />
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
      <Message title={appChats.length ? 'Pick a conversation' : 'No chats yet'}>
        <p>
          {appChats.length
            ? 'Choose a conversation on the left to open it in its app.'
            : 'Connect a Matrix account to bring in your recent conversations, or open an app from the icons on the left: when it notifies you of a new message, the conversation shows up here.'}
        </p>
        <button className="auth-submit" onClick={() => setPanel('matrix')}>
          Connect Matrix
        </button>
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
      onOpenUsage={() => setPanel((p) => (p === 'usage' ? null : 'usage'))}
      onOpenMatrix={() => setPanel('matrix')}
      onHome={() => selectNetwork('all')}
      appBar={{
        apps,
        limit: appList.limit,
        network,
        status: appStatus,
        onSelect: selectNetwork,
        onMove: appList.move,
        onShow: appList.show,
        onHide: (id) => {
          appList.hide(id)
          if (network === id) selectNetwork('all')
        },
        onLimit: appList.setLimit,
      }}
      onMenuOpenChange={setMenuOpen}
    />
    <div className={`shell ${mobileChatOpen ? 'show-chat' : ''}`}>
      <Sidebar
        chats={visible}
        allChats={inScope}
        scope={scope}
        scopeOptions={scopeOptions}
        activeId={activeId}
        onClearAppChats={appChats.length ? () => bird?.clearInbox() : undefined}
        onSelect={(id) => {
          const fromApp = appChats.find((c) => c.id === id)
          if (fromApp) return openFromApp(fromApp)
          setAppOpen(false)
          setPanel(null)
          openChat(id)
        }}
        filter={filter}
        setFilter={setFilter}
        network={network}
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
