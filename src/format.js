const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysAgo = (d) => Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000)

// "8:12 PM" today, "Yesterday", "Mon", then "Sep 3".
export function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const days = daysAgo(d)
  if (days <= 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Label for the day divider in a conversation.
export function dayLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const days = daysAgo(d)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}
