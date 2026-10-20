import ProfileMenu from './ProfileMenu'

export default function TopBar({
  user,
  onSignOut,
  theme,
  toggleTheme,
  usageOpen,
  onOpenUsage,
  onMenuOpenChange,
}) {
  return (
    <header className="topbar">
      <span className="topbar-brand">Bird</span>
      <div className="topbar-right">
        <button
          className={`topbar-btn ${usageOpen ? 'on' : ''}`}
          onClick={onOpenUsage}
          aria-pressed={usageOpen}
          title="Screen time"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M5 19V11M12 19V5M19 19v-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.200"
              strokeLinecap="round"
            />
          </svg>
          Screen time
        </button>
        <ProfileMenu
          user={user}
          onSignOut={onSignOut}
          theme={theme}
          toggleTheme={toggleTheme}
          onOpenChange={onMenuOpenChange}
        />
      </div>
    </header>
  )
}
