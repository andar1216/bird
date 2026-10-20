import Avatar from './Avatar'
import ScopeMenu from './ScopeMenu'
import { ComposeIcon, MuteIcon, SearchIcon } from './Icons'

const FILTERS = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'unread', label: 'Unread' },
  { id: 'low', label: 'Low Priority' },
  { id: 'archive', label: 'Archive' },
]

function preview(chat) {
  const last = chat.lastMessage
  if (!last) return ''
  if (last.type === 'voice') return '🎤 Voice message'
  if (last.type === 'image') return '📷 Photo'
  const who = last.from === 'me' ? 'You: ' : last.sender ? `${last.sender}: ` : ''
  return who + last.text
}

function Badge({ chat }) {
  if (chat.unread > 0) {
    const label = chat.mention ? `@${chat.unread}` : chat.unread
    return <span className={`badge ${chat.muted ? 'badge-muted' : ''}`}>{label}</span>
  }
  return null
}

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M2 12s3.600-7 10-7 10 7 10 7-3.600 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
)

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M3 3l18 18M10.600 6.100A10 10 0 0 1 12 5c6.400 0 10 7 10 7a17 17 0 0 1-3 3.800M6.600 6.600A17 17 0 0 0 2 12s3.600 7 10 7c1.800 0 3.400-.5 4.800-1.200M9.900 9.900a3 3 0 0 0 4.200 4.200" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function Sidebar({
  chats,
  allChats,
  scope,
  scopeOptions,
  activeId,
  onSelect,
  filter,
  setFilter,
  network,
  onClearAppChats,
  hiddenIds,
  loading,
  onHide,
  onUnhide,
  query,
  setQuery,
}) {
  const pinned = allChats.filter((c) => c.pinned && !c.archived)
  const list = chats

  const isHiddenChat = (c) => hiddenIds?.has(c.id) === true
  const row = (c) => {
    const isHidden = isHiddenChat(c)
    return (
        <li key={c.id} className="chat-li">
          <button
            className={`chat-row ${c.id === activeId ? 'active' : ''} ${isHidden && network !== 'all' ? 'is-hidden' : ''}`}
            onClick={() => onSelect(c.id)}
          >
            <Avatar chat={c} size={46} />
            <div className="chat-main">
              <div className="chat-top">
                <span className="chat-name">{c.name}</span>
                {c.muted && <MuteIcon width={13} height={13} className="muted-ic" />}
                <span className="chat-time">{c.time}</span>
              </div>
              <div className="chat-bottom">
                {c.typing ? (
                  <span className="typing-line">
                    <i /><i /><i />
                  </span>
                ) : (
                  <span className="chat-preview">{preview(c)}</span>
                )}
                <Badge chat={c} />
              </div>
            </div>
          </button>
          {onHide && (
            <button
              className="row-hide"
              title={isHidden ? 'Show in All Chats again' : 'Hide until there is something new'}
              aria-label={isHidden ? 'Show in All Chats again' : 'Hide from All Chats'}
              onClick={() => (isHidden ? onUnhide(c.id) : onHide(c))}
            >
              {isHidden ? <EyeIcon /> : <EyeOffIcon />}
            </button>
          )}
        </li>
    )
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <ScopeMenu options={scopeOptions} scope={scope} />
        <h1>All Chats</h1>
        {loading && <span className="spinner small" role="status" aria-label="Refreshing" />}
        <div className="head-actions">
          <button className="icon-btn" aria-label="New chat"><ComposeIcon /></button>
        </div>
      </header>

      <div className="search">
        <SearchIcon width={16} height={16} />
        <input
          placeholder="Search chats"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`pill ${filter === f.id ? 'on' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === 'inbox' && !query && network === 'all' && (
        <div className="pinned">
          {pinned.map((c) => (
            <button
              key={c.id}
              className={`pin ${c.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <div className="pin-avatar">
                <Avatar chat={c} size={56} />
                {c.unread > 0 && <span className="badge pin-badge">{c.unread}</span>}
              </div>
              <span className="pin-name">{c.name}</span>
            </button>
          ))}
        </div>
      )}

      <ul className="chat-list">
        {list.length === 0 && (
          <li className="empty">
            {loading && network === 'all'
              ? 'Loading your chats…'
              : network === 'all' && scopeOptions.length > 0 && scopeOptions.every((id) => !scope.isShown(id))
              ? 'No apps are shown in All Chats. Use the layers button above to pick some.'
              : 'Nothing here yet ✨'}
          </li>
        )}
        {list.filter((c) => !isHiddenChat(c)).map(row)}
        {network === 'all' && filter === 'archive' && list.some(isHiddenChat) && (
          <li className="hidden-section">
            <h3>Hidden</h3>
            <p>Out of All Chats until there is something new in them.</p>
            <ul>{list.filter(isHiddenChat).map(row)}</ul>
          </li>
        )}
      </ul>

      {onClearAppChats && (
        <button className="clear-app-chats" onClick={onClearAppChats}>
          Clear conversations from app notifications
        </button>
      )}
    </aside>
  )
}
