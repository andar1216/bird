import Avatar from './Avatar'
import AddAppMenu from './AddAppMenu'
import NetworkIcon from './NetworkIcon'
import { APPS } from '../data'
import { ComposeIcon, LayersIcon, MuteIcon, SearchIcon } from './Icons'

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

export default function Sidebar({
  chats,
  allChats,
  activeId,
  onSelect,
  filter,
  setFilter,
  network,
  setNetwork,
  appStatus,
  apps,
  extraApps,
  onAddApp,
  onRemoveApp,
  query,
  setQuery,
}) {
  const pinned = allChats.filter((c) => c.pinned && !c.archived)
  const list = chats

  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <button className="icon-btn" aria-label="Accounts"><LayersIcon /></button>
        <h1>All Chats</h1>
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

      <div className="networks" role="tablist" aria-label="Networks">
        <button
          className={`net-chip ${network === 'all' ? 'on' : ''}`}
          onClick={() => setNetwork('all')}
        >
          All
        </button>
        {apps.map((id) => {
          const state = appStatus?.[id]
          return (
            <button
              key={id}
              className={`net-chip icon-only ${network === id ? 'on' : ''}`}
              onClick={() => setNetwork(id)}
              title={`Open ${APPS[id].name}`}
              aria-label={APPS[id].name}
            >
              <NetworkIcon network={id} size={30} />
              {state?.count > 0 && <span className="badge chip-badge">{state.count}</span>}
              {state && !state.count && state.dot && <span className="chip-dot" />}
            </button>
          )
        })}
        <AddAppMenu extra={extraApps} onAdd={onAddApp} onRemove={onRemoveApp} />
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
        {list.length === 0 && <li className="empty">Nothing here yet ✨</li>}
        {list.map((c) => (
          <li key={c.id}>
            <button
              className={`chat-row ${c.id === activeId ? 'active' : ''}`}
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
          </li>
        ))}
      </ul>
    </aside>
  )
}
