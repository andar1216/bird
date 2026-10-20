import AccountBar from './AccountBar'
import NetworkIcon from './NetworkIcon'
import ModeToggle from './ModeToggle'
import { LayersIcon, MoonIcon, SunIcon } from './Icons'
import { NETWORKS, NETWORK_ORDER } from '../data'

function subtitle(state) {
  if (!state) return 'Click to open'
  if (state.count > 0) return `${state.count} unread`
  if (state.dot) return 'New activity'
  return 'Connected'
}

export default function AppsSidebar({
  activeNetwork,
  onSelect,
  status,
  mode,
  setMode,
  theme,
  toggleTheme,
  account,
}) {
  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <button className="icon-btn" aria-label="Accounts"><LayersIcon /></button>
        <h1>Apps</h1>
        <div className="head-actions">
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      <ModeToggle mode={mode} onChange={setMode} />

      <ul className="chat-list app-list">
        {NETWORK_ORDER.map((id) => {
          const net = NETWORKS[id]
          const state = status[id]
          return (
            <li key={id}>
              <button
                className={`chat-row app-row ${activeNetwork === id ? 'active' : ''}`}
                onClick={() => onSelect(id)}
              >
                <NetworkIcon network={id} size={44} className="app-tile" />
                <div className="chat-main">
                  <div className="chat-top">
                    <span className="chat-name">{net.name}</span>
                  </div>
                  <div className="chat-bottom">
                    <span className="chat-preview">{subtitle(state)}</span>
                    {state?.count > 0 && <span className="badge">{state.count}</span>}
                    {state && !state.count && state.dot && <span className="badge dot" />}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="apps-note">
        Each app signs in on its own official site. Logins are saved to your Bird
        account on this device.
      </p>

      {account && <AccountBar user={account.user} onSignOut={account.onSignOut} />}
    </aside>
  )
}
