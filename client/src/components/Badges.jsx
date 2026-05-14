export function StatusBadge({ status }) {
  const labels = { open: 'Open', in_progress: 'In Progress', closed: 'Closed', won: 'Won', lost: 'Lost' }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border badge-${status}`}>
      {labels[status] || status}
    </span>
  )
}

export function TypeBadge({ type }) {
  const map = {
    lead: { label: 'Lead', class: 'bg-blue-50 text-blue-600 border-blue-100' },
    repeat: { label: 'Repeat', class: 'bg-violet-50 text-violet-600 border-violet-100' },
    online_order: { label: 'Online Order', class: 'bg-amber-50 text-amber-600 border-amber-100' },
  }
  const t = map[type] || { label: type, class: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${t.class}`}>
      {t.label}
    </span>
  )
}

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
