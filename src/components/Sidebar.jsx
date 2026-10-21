import { useState } from 'react'
import Avatar from './Avatar'
import { MuteIcon, SearchIcon } from './Icons'
import { APPS } from '../data'
import { NICK_MAX } from '../chatPrefs'

const FILTERS = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'unread', label: 'Unread' },
  { id: 'priority', label: 'High Priority' },
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

const StarIcon = ({ filled }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M12 3.500l2.600 5.300 5.900.8-4.300 4.100 1 5.800L12 16.800l-5.200 2.700 1-5.800L3.500 9.600l5.900-.8z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
)

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M4 20h4L19 9a2.800 2.800 0 0 0-4-4L4 16v4zM13.500 6.500l4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const BellOffIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M3 3l18 18M8.500 4.800A6 6 0 0 1 18 10c0 3 .700 4.700 1.500 5.700M6 9c0 5-2 7-2 7h11M10 20a2 2 0 0 0 4 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const BellIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M6 9a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7zM10 20a2 2 0 0 0 4 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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
  hiddenIds,
  loading,
  onHide,
  onUnhide,
  onToggleStar,
  onToggleMute,
  onRename,
  query,
  setQuery,
}) {
  // Starred people (from any app) and the server's pinned chats, newest first.
  const pinned = allChats
    .filter((c) => !c.mutedInAll && (c.starred || (c.pinned && !c.archived)))
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
  const list = chats
  // The conversation whose nickname is being typed.
  const [editing, setEditing] = useState(null)
  const finishRename = (c, value) => {
    setEditing(null)
    if (value !== null) onRename?.(c.id, value)
  }

  const isHiddenChat = (c) => hiddenIds?.has(c.id) === true
  const row = (c) => {
    const isHidden = isHiddenChat(c)
    const renaming = editing === c.id
    const body = (
      <>
        <Avatar chat={c} size={46} />
        <div className="chat-main">
          <div className="chat-top">
            {renaming ? (
              <input
                className="nick-input"
                autoFocus
                defaultValue={c.nicked ? c.name : ''}
                placeholder={c.realName}
                maxLength={NICK_MAX}
                aria-label={`Nickname for ${c.realName}`}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => finishRename(c, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.target.blur()
                  if (e.key === 'Escape') finishRename(c, null)
                }}
              />
            ) : (
              <span className="chat-name">
                {c.starred && <span className="star-mark" aria-label="Starred">★</span>}
                {c.name}
              </span>
            )}
            {(c.muted || (c.mutedInAll && network !== 'all')) && (
              <MuteIcon width={13} height={13} className="muted-ic" />
            )}
            <span className="chat-time">{c.time}</span>
          </div>
          <div className="chat-bottom">
            {c.typing ? (
              <span className="typing-line">
                <i /><i /><i />
              </span>
            ) : (
              <span className="chat-preview">
                {c.nicked && !renaming ? `${c.realName} · ` : ''}
                {preview(c)}
              </span>
            )}
            <Badge chat={c} />
          </div>
        </div>
      </>
    )
    const cls = `chat-row ${c.id === activeId ? 'active' : ''} ${isHidden && network !== 'all' ? 'is-hidden' : ''}`
    return (
      <li key={c.id} className="chat-li">
        {renaming ? (
          <div className={cls}>{body}</div>
        ) : (
          <button className={cls} onClick={() => onSelect(c.id)}>
            {body}
          </button>
        )}
        {!renaming && (
          <div className="row-actions">
            {onToggleStar && (
              <button
                className={`row-act ${c.starred ? 'on' : ''}`}
                title={c.starred ? 'Remove from the top of All Chats' : 'Keep at the top of All Chats'}
                aria-label={c.starred ? 'Unstar' : 'Star'}
                aria-pressed={c.starred === true}
                onClick={() => onToggleStar(c.id)}
              >
                <StarIcon filled={c.starred} />
              </button>
            )}
            {onRename && (
              <button
                className="row-act"
                title="Give them a nickname"
                aria-label="Rename"
                onClick={() => setEditing(c.id)}
              >
                <PencilIcon />
              </button>
            )}
            {onToggleMute && (
              <button
                className={`row-act ${c.mutedInAll ? 'on' : ''}`}
                title={c.mutedInAll ? 'Show in All Chats again' : 'Keep out of All Chats (even when they message)'}
                aria-label={c.mutedInAll ? 'Unmute in All Chats' : 'Mute in All Chats'}
                aria-pressed={c.mutedInAll === true}
                onClick={() => onToggleMute(c.id)}
              >
                {c.mutedInAll ? <BellIcon /> : <BellOffIcon />}
              </button>
            )}
            {onHide && (
              <button
                className="row-act"
                title={isHidden ? 'Show in All Chats again' : 'Hide until there is something new'}
                aria-label={isHidden ? 'Show in All Chats again' : 'Hide from All Chats'}
                onClick={() => (isHidden ? onUnhide(c.id) : onHide(c))}
              >
                {isHidden ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            )}
          </div>
        )}
      </li>
    )
  }
  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <h1>{network === 'all' ? 'All Chats' : (APPS[network]?.name ?? 'Chats')}</h1>
        {loading && <span className="spinner small" role="status" aria-label="Refreshing" />}
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
              ? 'No apps are shown in All Chats. Use the + menu in the top bar to pick some.'
              : network !== 'all'
              ? `No conversations from ${APPS[network]?.name ?? 'this app'} yet.`
              : 'Nothing here yet ✨'}
          </li>
        )}
        {list.filter((c) => network !== 'all' || !(isHiddenChat(c) || c.mutedInAll)).map(row)}
        {network === 'all' && filter === 'archive' && list.some((c) => c.mutedInAll) && (
          <li className="hidden-section">
            <h3>Muted</h3>
            <p>Out of All Chats until you unmute them, even when they message.</p>
            <ul>{list.filter((c) => c.mutedInAll).map(row)}</ul>
          </li>
        )}
        {network === 'all' && filter === 'archive' && list.some((c) => isHiddenChat(c) && !c.mutedInAll) && (
          <li className="hidden-section">
            <h3>Hidden</h3>
            <p>Out of All Chats until there is something new in them.</p>
            <ul>{list.filter((c) => isHiddenChat(c) && !c.mutedInAll).map(row)}</ul>
          </li>
        )}
      </ul>
    </aside>
  )
}
