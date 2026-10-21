import { useMemo, useState } from 'react'
import NetworkIcon from './NetworkIcon'
import { APPS } from '../data'
import { bird } from '../bird'
import { useNow, useUsage } from '../useUsage'
import {
  chartColor,
  dayStart,
  daysAgoStart,
  formatClock,
  formatDuration,
  nextDayStart,
  opensByApp,
  perDay,
  segmentsOnDay,
  timelineRange,
  totalsByApp,
  withLive,
} from '../usageStats'

const DAYS = 7
const colorOf = (app) => chartColor(APPS[app]?.color)
const nameOf = (app) => APPS[app]?.name ?? app

function sum(values) {
  return values.reduce((a, b) => a + b, 0)
}

// Screen time: how long each app has been on screen, per day and across today.
export default function UsagePanel({ onClose }) {
  const data = useUsage(DAYS)
  const now = useNow(1000)
  // Times opened: today, or across the last week.
  const [opensSpan, setOpensSpan] = useState('today')

  const view = useMemo(() => {
    if (!data) return null
    const segments = withLive(data.segments, now)
    const today = dayStart(now)
    const todaySegs = segmentsOnDay(segments, today)
    const totals = totalsByApp(segments, today, nextDayStart(today))
    // Bird itself being open (not an app): one total per day.
    const birdSegs = withLive(data.birdOpen ?? [], now).map((s) => ({ ...s, app: 'bird' }))
    return {
      bird: perDay(birdSegs, DAYS, now).reverse().map((d) => ({ start: d.start, ms: d.perApp.bird ?? 0 })),
      birdLive: (data.birdOpen ?? []).some((s) => s.live),
      days: perDay(segments, DAYS, now),
      todaySegs,
      totals,
      range: timelineRange(todaySegs, today),
      apps: Object.keys(totals).sort((a, b) => totals[b] - totals[a]),
      opens: opensByApp(data.opens, opensSpan === 'today' ? today : daysAgoStart(DAYS - 1, now), nextDayStart(today)),
    }
  }, [data, now, opensSpan])

  const todayTotal = view ? sum(Object.values(view.totals)) : 0
  const activeApp = data?.active?.app

  return (
    <main className="chat usage-pane">
      <div className="app-bar">
        <span className="app-bar-name">Screen time</span>
        <button className="app-bar-btn" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="usage-scroll">
        {!bird ? (
          <p className="usage-empty">Screen time is tracked in the Bird desktop app.</p>
        ) : !view ? (
          <p className="usage-empty">Loading…</p>
        ) : (
          <>
            <section className="usage-card">
              <h3>Today</h3>
              <div className="usage-total">{formatDuration(todayTotal)}</div>
              <p className="usage-note">
                Time each app was on screen while Bird was in front. It pauses when you switch to
                another window or step away for 5 minutes.
              </p>
              {view.apps.length === 0 ? (
                <p className="usage-empty">Nothing yet today. Open an app and the timer starts.</p>
              ) : (
                <ul className="usage-apps">
                  {view.apps.map((app) => (
                    <li key={app}>
                      <NetworkIcon network={app} size={26} />
                      <span className="usage-app-name">
                        {nameOf(app)}
                        {app === activeApp && <span className="usage-live">● open now</span>}
                      </span>
                      <span className="usage-bar" aria-hidden="true">
                        <i
                          style={{
                            width: `${(view.totals[app] / view.totals[view.apps[0]]) * 100}%`,
                            background: colorOf(app),
                          }}
                        />
                      </span>
                      <span className="usage-time">{formatDuration(view.totals[app])}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="usage-card">
              <h3>Bird open</h3>
              <div className="usage-total">
                {formatDuration(view.bird[0]?.ms ?? 0)}
                {view.birdLive && <span className="usage-live">● open now</span>}
              </div>
              <p className="usage-note">
                How long Bird itself has been open today, whether or not it was the window in front.
                It stops while the window is minimized or closed.
              </p>
              <ul className="usage-apps">
                {view.bird.map((d, i) => (
                  <li key={d.start}>
                    <img className="usage-bird" src="/bird.png" alt="" width="22" height="22" />
                    <span className="usage-app-name">
                      {i === 0
                        ? 'Today'
                        : i === 1
                        ? 'Yesterday'
                        : new Date(d.start).toLocaleDateString([], { weekday: 'long' })}
                    </span>
                    <span className="usage-bar" aria-hidden="true">
                      <i
                        style={{
                          width: `${(d.ms / Math.max(...view.bird.map((x) => x.ms), 1)) * 100}%`,
                          background: 'var(--accent)',
                        }}
                      />
                    </span>
                    <span className="usage-time">{d.ms ? formatDuration(d.ms) : '—'}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="usage-card">
              <div className="usage-opens-head">
                <h3>Times opened</h3>
                <div className="usage-span" role="group" aria-label="Period">
                  <button className={`pill ${opensSpan === 'today' ? 'on' : ''}`} onClick={() => setOpensSpan('today')}>
                    Today
                  </button>
                  <button className={`pill ${opensSpan === 'week' ? 'on' : ''}`} onClick={() => setOpensSpan('week')}>
                    {DAYS} days
                  </button>
                </div>
              </div>
              <p className="usage-note">
                Clicks that opened an app. &ldquo;App only&rdquo; counts its icon in the top bar;
                &ldquo;With messages&rdquo; also counts opening one of its conversations from All Chats.
              </p>
              {Object.keys(view.opens).length === 0 ? (
                <p className="usage-empty">No opens yet.</p>
              ) : (
                <ul className="usage-opens">
                  <li className="usage-opens-cols" aria-hidden="true">
                    <span />
                    <span />
                    <span>App only</span>
                    <span>With messages</span>
                  </li>
                  {Object.keys(view.opens)
                    .sort((a, b) => view.opens[b].all - view.opens[a].all)
                    .map((app) => (
                      <li key={app}>
                        <NetworkIcon network={app} size={26} />
                        <span className="usage-app-name">{nameOf(app)}</span>
                        <span className="usage-count">{view.opens[app].app}</span>
                        <span className="usage-count">{view.opens[app].all}</span>
                      </li>
                    ))}
                </ul>
              )}
            </section>

            <section className="usage-card">
              <h3>Last {DAYS} days</h3>
              <DayChart days={view.days} />
              <Legend apps={Object.keys(Object.assign({}, ...view.days.map((d) => d.perApp)))} />
            </section>

            <section className="usage-card">
              <h3>Today’s timeline</h3>
              <Timeline segments={view.todaySegs} range={view.range} apps={view.apps} />
            </section>

            <section className="usage-card">
              <h3>Today’s visits</h3>
              {view.todaySegs.length === 0 ? (
                <p className="usage-empty">No visits yet.</p>
              ) : (
                <ul className="usage-visits">
                  {[...view.todaySegs].reverse().map((s) => (
                    <li key={`${s.app}-${s.start}`}>
                      <NetworkIcon network={s.app} size={22} />
                      <span className="usage-visit-name">{nameOf(s.app)}</span>
                      <span className="usage-visit-when">
                        {formatClock(s.start)} – {s.live ? 'now' : formatClock(s.end)}
                      </span>
                      <span className="usage-time">{formatDuration(s.end - s.start)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function Legend({ apps }) {
  if (apps.length === 0) return null
  return (
    <ul className="usage-legend">
      {apps.map((app) => (
        <li key={app}>
          <i style={{ background: colorOf(app) }} />
          {nameOf(app)}
        </li>
      ))}
    </ul>
  )
}

// One stacked column per day; each colour is an app.
function DayChart({ days }) {
  const max = Math.max(...days.map((d) => d.total), 1)
  return (
    <div className="usage-days" role="img" aria-label="Screen time per day">
      {days.map((d, i) => {
        const label = new Date(d.start).toLocaleDateString([], { weekday: 'short' })
        const full = new Date(d.start).toLocaleDateString([], {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })
        const breakdown = Object.entries(d.perApp)
          .sort((a, b) => b[1] - a[1])
          .map(([app, ms]) => `${nameOf(app)} ${formatDuration(ms)}`)
          .join('\n')
        return (
          <div
            className={`usage-day ${i === days.length - 1 ? 'today' : ''}`}
            key={d.start}
            title={`${full}: ${formatDuration(d.total)}${breakdown ? `\n${breakdown}` : ''}`}
          >
            <span className="usage-day-total">{d.total ? formatDuration(d.total) : ''}</span>
            <div className="usage-day-col">
              <div className="usage-day-stack" style={{ height: `${(d.total / max) * 100}%` }}>
                {Object.entries(d.perApp)
                  .sort((a, b) => b[1] - a[1])
                  .map(([app, ms]) => (
                    <i
                      key={app}
                      style={{ height: `${(ms / d.total) * 100}%`, background: colorOf(app) }}
                    />
                  ))}
              </div>
            </div>
            <span className="usage-day-label">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// A track per app across the day's hours; each block is one visit, placed at
// the time it started and as wide as it lasted.
function Timeline({ segments, range, apps }) {
  const span = range.to - range.from
  const ticks = []
  const hour = 60 * 60 * 1000
  for (let t = range.from; t <= range.to; t += hour) ticks.push(t)
  const every = ticks.length > 14 ? 3 : ticks.length > 8 ? 2 : 1

  if (apps.length === 0) return <p className="usage-empty">No visits yet.</p>
  return (
    <div className="usage-timeline">
      {apps.map((app) => (
        <div className="usage-track-row" key={app}>
          <NetworkIcon network={app} size={22} />
          <div className="usage-track">
            {ticks.map((t) => (
              <u key={t} style={{ left: `${((t - range.from) / span) * 100}%` }} />
            ))}
            {segments
              .filter((s) => s.app === app)
              .map((s) => (
                <i
                  key={s.start}
                  style={{
                    left: `${((s.start - range.from) / span) * 100}%`,
                    width: `${((s.end - s.start) / span) * 100}%`,
                    background: colorOf(app),
                  }}
                  title={`${nameOf(app)}\n${formatClock(s.start)} – ${s.live ? 'now' : formatClock(s.end)}\n${formatDuration(s.end - s.start)}`}
                />
              ))}
          </div>
        </div>
      ))}
      <div className="usage-track-row axis">
        <span className="usage-axis-spacer" />
        <div className="usage-axis">
          {ticks.map((t, i) =>
            i % every === 0 ? (
              <span key={t} style={{ left: `${((t - range.from) / span) * 100}%` }}>
                {new Date(t).toLocaleTimeString([], { hour: 'numeric' })}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  )
}
