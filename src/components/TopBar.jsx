import ProfileMenu from './ProfileMenu'

export default function TopBar({ user, onSignOut, theme, toggleTheme, onMenuOpenChange }) {
  return (
    <header className="topbar">
      <span className="topbar-brand">Bird</span>
      <ProfileMenu
        user={user}
        onSignOut={onSignOut}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenChange={onMenuOpenChange}
      />
    </header>
  )
}
