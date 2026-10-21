import { useState } from 'react'
import NetworkIcon from './NetworkIcon'

function initials(name) {
  const parts = name.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

export default function Avatar({ chat, size = 44, badge = true }) {
  const [a, b] = chat.colors
  // The picture the app shows for them, when we could read it; letters if it won't load.
  const [failed, setFailed] = useState(null)
  const photo = chat.avatar && failed !== chat.avatar ? chat.avatar : null
  return (
    <div className="avatar-wrap" style={{ width: size, height: size }}>
      <div
        className="avatar"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.38,
          background: `linear-gradient(145deg, ${a}, ${b})`,
        }}
      >
        {photo ? (
          <img
            className="avatar-photo"
            src={photo}
            alt=""
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setFailed(photo)}
          />
        ) : (
          initials(chat.name)
        )}
      </div>
      {badge && (
        <NetworkIcon
          network={chat.network}
          size={Math.max(14, Math.round(size * 0.38))}
          className="avatar-badge"
        />
      )}
    </div>
  )
}
