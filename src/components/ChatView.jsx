import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import NetworkIcon from './NetworkIcon'
import { NETWORKS } from '../data'
import { dayLabel } from '../format'
import {
  BackIcon,
  InfoIcon,
  MicIcon,
  PhoneIcon,
  PlayIcon,
  PlusIcon,
  SendIcon,
  SmileIcon,
} from './Icons'

const BARS = [4, 9, 6, 13, 8, 15, 10, 6, 12, 16, 9, 5, 11, 14, 7, 10, 6, 12, 8, 4, 9, 6]

function Voice({ duration }) {
  return (
    <div className="voice">
      <PlayIcon width={14} height={14} />
      <div className="wave">
        {BARS.map((h, i) => (
          <span key={i} style={{ height: h }} />
        ))}
      </div>
      <span className="voice-dur">{duration}</span>
    </div>
  )
}

function Bubble({ m, group, showSender }) {
  const mine = m.from === 'me'
  return (
    <div className={`msg ${mine ? 'mine' : 'theirs'}`}>
      {showSender && group && !mine && m.sender && <span className="sender">{m.sender}</span>}
      {m.type === 'image' ? (
        <div className="bubble image">
          <div className="img-ph">
            <span>📷</span>
          </div>
          {m.caption && <p>{m.caption}</p>}
        </div>
      ) : m.type === 'voice' ? (
        <div className="bubble voice-bubble">
          <Voice duration={m.duration} />
        </div>
      ) : (
        <div className="bubble">{m.text}</div>
      )}
      <span className="msg-time">{m.time}</span>
    </div>
  )
}

const PLACEHOLDER = {
  instagram: 'Message on Instagram',
  snapchat: 'Send a chat on Snapchat',
  messages: 'Text message · RCS',
  discord: 'Message on Discord',
}

export default function ChatView({ chat, onSend, onBack }) {
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [chat?.id, chat?.messages.length])

  if (!chat) {
    return (
      <main className="chat empty-state">
        <div className="empty-art">
          <span className="orb o1" />
          <span className="orb o2" />
          <span className="orb o3" />
        </div>
        <h2>All your chats, one place</h2>
        <p>Pick a conversation to get started.</p>
      </main>
    )
  }

  const net = NETWORKS[chat.network]

  const submit = (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSend(chat.id, text)
    setDraft('')
  }

  return (
    <main className="chat">
      <header className="chat-head">
        <button className="icon-btn back" onClick={onBack} aria-label="Back">
          <BackIcon />
        </button>
        <Avatar chat={chat} size={40} />
        <div className="chat-title">
          <strong>{chat.name}</strong>
          <span>
            <NetworkIcon network={chat.network} size={12} /> {net.name} · {chat.handle}
            {chat.streak ? ` · 🔥 ${chat.streak}` : ''}
          </span>
        </div>
        <div className="head-actions">
          <button className="icon-btn" aria-label="Call"><PhoneIcon /></button>
          <button className="icon-btn" aria-label="Details"><InfoIcon /></button>
        </div>
      </header>

      <div className="thread">
        {chat.messages[0]?.sentAt && (
          <div className="day-chip">{dayLabel(chat.messages[0].sentAt)}</div>
        )}
        {chat.messages.map((m, i) => (
          <Bubble
            key={m.id}
            m={m}
            group={chat.group}
            showSender={chat.messages[i - 1]?.sender !== m.sender || chat.messages[i - 1]?.from !== m.from}
          />
        ))}
        {chat.typing && (
          <div className="msg theirs">
            <div className="bubble typing"><i /><i /><i /></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <button type="button" className="icon-btn round" aria-label="Attach"><PlusIcon /></button>
        <div className="input-wrap">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={PLACEHOLDER[chat.network]}
          />
          <button type="button" className="icon-btn" aria-label="Emoji"><SmileIcon /></button>
        </div>
        {draft.trim() ? (
          <button type="submit" className="send" aria-label="Send"><SendIcon /></button>
        ) : (
          <button type="button" className="icon-btn round" aria-label="Voice"><MicIcon /></button>
        )}
      </form>
    </main>
  )
}
