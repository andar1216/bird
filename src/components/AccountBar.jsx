// Who is signed in, plus Sign out. Shown at the bottom of both sidebars.
export default function AccountBar({ user, onSignOut }) {
  const initial = (user.displayName || user.username).trim()[0]?.toUpperCase() ?? '?'
  return (
    <div className="account-bar">
      <span className="account-avatar" aria-hidden="true">{initial}</span>
      <span className="account-who">
        <span className="account-name">{user.displayName}</span>
        <span className="account-handle">@{user.username}</span>
      </span>
      <button className="account-out" onClick={onSignOut}>Sign out</button>
    </div>
  )
}
