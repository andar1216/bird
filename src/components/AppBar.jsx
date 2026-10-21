import { useEffect, useRef, useState } from 'react'
import AppsMenu from './AppsMenu'
import { LayersIcon } from './Icons'
import NetworkIcon from './NetworkIcon'
import { APPS } from '../data'
import { useGray } from '../useGrayscale'

// The app icons in the top bar: the first `limit` apps, the rest under "More".
// Click an icon to open the app (click it again to go back to All Chats), and
// drag icons to reorder them.
export default function AppBar({
  apps,
  limit,
  network,
  status,
  onSelect,
  onMove,
  onShow,
  onHide,
  onLimit,
  isInAll,
  onToggleInAll,
  custom,
  onAddCustom,
  onRemoveCustom,
  onOpenChange,
}) {
  const { isGray } = useGray()
  const [moreOpen, setMoreOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [drag, setDrag] = useState(null) // { id, over }
  const moreRef = useRef(null)

  const shownCount = limit === null ? apps.length : Math.min(limit, apps.length)
  const visible = apps.slice(0, shownCount)
  const more = apps.slice(shownCount)
  const moreUnread = more.reduce((n, id) => n + (status?.[id]?.count ?? 0), 0)
  const moreDot = more.some((id) => status?.[id]?.dot || status?.[id]?.count)

  // The native web view draws over the page, so it steps aside while a menu is open.
  const anyOpen = moreOpen || manageOpen
  useEffect(() => {
    onOpenChange?.(anyOpen)
    return () => onOpenChange?.(false)
  }, [anyOpen, onOpenChange])

  useEffect(() => {
    if (!moreOpen) return undefined
    const onDown = (e) => {
      if (!moreRef.current?.contains(e.target)) setMoreOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  // `source` false: only a place to drop onto (the "More" button).
  const dragProps = (id, source = true) => ({
    ...(source && {
      draggable: true,
      onDragStart: (e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', id)
        setDrag({ id, over: null })
      },
    }),
    onDragOver: (e) => {
      if (!drag) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDrag((d) => (d && d.over !== id ? { ...d, over: id } : d))
    },
    onDrop: (e) => {
      e.preventDefault()
      if (drag && drag.id !== id) onMove(drag.id, id === 'more' ? null : id)
      setDrag(null)
    },
    onDragEnd: () => setDrag(null),
  })

  const overClass = (id) => (drag && drag.over === id && drag.id !== id ? 'drop' : '')

  const badge = (id) => {
    const s = status?.[id]
    if (s?.count > 0) {
      return <span className={`badge chip-badge ${isGray(id, 'icon') ? 'gray' : ''}`}>{s.count}</span>
    }
    if (s?.dot) return <span className={`chip-dot ${isGray(id, 'icon') ? 'gray' : ''}`} />
    return null
  }

  return (
    <div className="app-bar-icons" role="tablist" aria-label="Apps">
      <button
        className={`app-tab all-tab ${network === 'all' ? 'on' : ''}`}
        onClick={() => onSelect('all')}
        title="All Chats"
        aria-label="All Chats"
        aria-pressed={network === 'all'}
      >
        <LayersIcon width={22} height={22} />
      </button>
      {visible.map((id) => (
        <button
          key={id}
          className={`app-tab ${network === id ? 'on' : ''} ${drag?.id === id ? 'dragging' : ''} ${overClass(id)}`}
          onClick={() => onSelect(network === id ? 'all' : id)}
          title={APPS[id].name}
          aria-label={APPS[id].name}
          aria-pressed={network === id}
          {...dragProps(id)}
        >
          <NetworkIcon network={id} size={30} />
          {badge(id)}
        </button>
      ))}

      {more.length > 0 && (
        <div className="more-wrap" ref={moreRef}>
          <button
            className={`app-tab app-tab-plain more-btn ${moreOpen || more.includes(network) ? 'on' : ''} ${overClass('more')}`}
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-label={`More apps (${more.length})`}
            title="More apps"
            {...dragProps('more', false)}
          >
            <span>+{more.length}</span>
            {moreUnread > 0 ? (
              <span className="badge chip-badge">{moreUnread}</span>
            ) : (
              moreDot && <span className="chip-dot" />
            )}
          </button>
          {moreOpen && (
            <div className="more-menu" role="menu">
              <h3>More apps</h3>
              <ul>
                {more.map((id) => (
                  <li key={id} className={overClass(id)}>
                    <button
                      className={`more-row ${network === id ? 'on' : ''}`}
                      role="menuitem"
                      onClick={() => {
                        setMoreOpen(false)
                        onSelect(id)
                      }}
                      {...dragProps(id)}
                    >
                      <span className="more-icon">
                        <NetworkIcon network={id} size={28} />
                        {badge(id)}
                      </span>
                      <span className="more-name">{APPS[id].name}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="apps-hint">Drag one onto the bar to pin it there.</p>
            </div>
          )}
        </div>
      )}

      <AppsMenu
        shown={apps}
        limit={limit}
        onShow={onShow}
        onHide={onHide}
        onLimit={onLimit}
        isInAll={isInAll}
        onToggleInAll={onToggleInAll}
        custom={custom}
        onAddCustom={onAddCustom}
        onRemoveCustom={onRemoveCustom}
        onOpenChange={setManageOpen}
      />
    </div>
  )
}
