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
import { useConversationLimit } from '../useConversationLimit'
import { useListHidden } from '../useListHidden'
import { useListing } from '../useListing'
import { useHiddenChats } from '../useHiddenChats'
import { useChatPrefs } from '../useChatPrefs'
import { applyPrefs, matchesQuery } from '../chatPrefs'

function matchesFilter(c, filter) {
  switch (filter) {
    case 'unread':
      return c.unread > 0 && !c.archived
    // High Priority: unread messages from the people you starred.
    case 'priority':
      return c.starred === true && c.unread > 0 && !c.archived
    case 'archive':
      return c.archived
    default:
      return !c.archived
  }
}

function Message({ title, busy, children }) {
  return (
    <main className="chat empty-state">
      {busy && <span className="spinner" role="status" aria-label="Loading" />}
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

  // Which apps All Chats includes (all of them down to none).
  const scope = useAllChatsScope(user.id)

  // Keep the apps on the bar running in the background so their notifications
  // (and unread counts) arrive even before you open them. So do apps whose icon you
  // took off the bar while their chats still show in All Chats.
  const { quiet } = appList
  const { isShown } = scope
  const background = useMemo(() => [...apps, ...quiet.filter(isShown)], [apps, quiet, isShown])
  useEffect(() => {
    bird?.setBackgroundApps?.(background)
  }, [background, user.id])

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

  // Open an app, counting it for screen time: from its icon ("app") or through one of
  // its conversations ("chat").
  const openApp = (id, via) => {
    bird?.recordOpen?.(id, via)
    selectNetwork(id)
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
  const chatPrefs = useChatPrefs(user.id)
  const everyChat = useMemo(
    () => [...chats, ...appChats].map((c) => applyPrefs(c, chatPrefs.prefs)),
    [chats, appChats, chatPrefs.prefs],
  )

  const conversations = useConversationLimit(user.id)
  const list = useListHidden(user.id)
  const listing = useListing()
  const scopeOptions = useMemo(
    () => [...new Set([...apps, ...everyChat.map((c) => c.network)])],
    [apps, everyChat],
  )
  const inScope = useMemo(() => everyChat.filter((c) => scope.isShown(c.network)), [everyChat, scope])

  const openFromApp = (chat) => {
    bird?.markInboxRead(chat.id.slice(INBOX_PREFIX.length))
    if (chat.page) bird?.openAppChat?.(chat.network, chat.id.slice(INBOX_PREFIX.length))
    openApp(chat.network, 'chat')
  }

  // Conversations hidden from All Chats until something new happens in them.
  const hiding = useHiddenChats(user.id, everyChat)

  // In All Chats a hidden conversation is out of every list except the Archive's
  // "Hidden" section.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const inAll = network === 'all'
    return everyChat
      .filter((c) => {
        if (!matchesQuery(c, q)) return false
        // Inside an app, the list is just that app's conversations (by name).
        if (!inAll) return c.network === network && matchesFilter(c, filter)
        if (!scope.isShown(c.network)) return false
        // Hidden (until something new) and muted (until unmuted) chats live in the Archive.
        if (hiding.hidden.has(c.id) || c.mutedInAll) return filter === 'archive'
        return matchesFilter(c, filter)
      })
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
  }, [everyChat, filter, network, query, scope, hiding.hidden])
  const pinnable = useMemo(
    () => inScope.filter((c) => !hiding.hidden.has(c.id) && !c.mutedInAll),
    [inScope, hiding.hidden],
  )

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

  const activeRaw = chats.find((c) => c.id === activeId)
  const active = activeRaw && applyPrefs(activeRaw, chatPrefs.prefs)

  let pane
  if (panel === 'matrix') {
    pane = <MatrixPanel onClose={() => setPanel(null)} onChanged={refreshChats} />
  } else if (usageOpen) {
    pane = <UsagePanel onClose={() => setPanel(null)} />
  } else if (appOpen && network !== 'all') {
    pane = <AppsStage key={network} network={network} conversations={conversations} />
  } else if (load.status === 'loading') {
    pane = <Message title="Loading your chats…" busy />
  } else if (load.status === 'ready' && chats.length === 0 && appChats.length === 0 && listing) {
    // Just opened or refreshed: the apps are still being read, so don't say there are none.
    pane = (
      <Message title="Loading your chats…" busy>
        <p>Getting your recent conversations from your apps.</p>
      </Message>
    )
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
      listHidden={list.hidden}
      onToggleList={list.toggle}
      appBar={{
        apps,
        limit: appList.limit,
        network,
        status: appStatus,
        // Icon clicks that open an app are counted for screen time (going home isn't).
        onSelect: (id) => (id === 'all' ? selectNetwork(id) : openApp(id, 'app')),
        onMove: appList.move,
        // The icon and the chats are separate: hiding an icon leaves the app's chats in
        // All Chats (its own switch in the apps menu turns those off).
        onShow: appList.show,
        onHide: (id) => {
          appList.hide(id)
          if (network === id) selectNetwork('all')
        },
        isInAll: scope.isShown,
        onToggleInAll: scope.toggle,
        onLimit: appList.setLimit,
        custom: appList.custom,
        // A site added by name or address: put it on the bar, in All Chats, and open it.
        onAddCustom: (spec) => {
          const id = appList.addCustom(spec)
          scope.setShown([id], true)
          selectNetwork(id)
        },
        // Take an added app away and sign out of it (its stored login is wiped).
        onRemoveCustom: (id) => {
          appList.hide(id)
          if (network === id) selectNetwork('all')
          const done = () => appList.removeCustom(id)
          const wipe = bird?.unlinkApp?.(id)
          if (wipe) wipe.catch(() => {}).finally(done)
          else done()
        },
      }}
      onMenuOpenChange={setMenuOpen}
    />
    <div className={`shell ${mobileChatOpen ? 'show-chat' : ''} ${list.hidden ? 'list-hidden' : ''} ${gray.chatsGray && network === 'all' ? 'gray-chats' : ''}`}>
      <Sidebar
        chats={visible}
        allChats={pinnable}
        loading={listing}
        hiddenIds={hiding.hidden}
        onHide={hiding.hide}
        onToggleStar={chatPrefs.toggleStar}
        onToggleMute={chatPrefs.toggleMute}
        onRename={chatPrefs.rename}
        onUnhide={hiding.unhide}
        scope={scope}
        scopeOptions={scopeOptions}
        activeId={activeId}
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
