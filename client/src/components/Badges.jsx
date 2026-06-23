export const DISPOSITIONS = [
  'Initial Contact', 'Quoted', 'Bidding', 'Waiting for approval',
  'Shopping Around', 'Cold', 'Cold Lead', 'Hold', 'Needed in stock',
  'Pricing Issue', 'Part Not Available', 'Condition Not Available',
  'No response', 'Fake Lead', 'Desi', 'Chinese Supplier',
  'Supplier', 'Supplier, but we are working on it',
  'Project Cancelled', 'Payment failed', 'Closed Won', 'Closed Lost',
  'Processed', 'Cancelled',
]

export const LEAD_SOURCES = [
  'Chat Lead', 'Website RFQ', 'Email Lead', 'Call Lead',
  'RFQ Lead', 'Contact form', 'BB Lead',
]

// Sources specifically for Online Orders
export const ORDER_SOURCES = ['PPC', 'Chat']

export const PPC_OPTIONS = ['PPC', 'Outbound Repeat']

export const VERIFICATION_OPTIONS = ['Verified', 'Not Verified']

const DISPOSITION_COLORS = {
  'Closed Won':    'bg-green-100 text-green-700',
  'Processed':     'bg-green-100 text-green-700',
  'Closed Lost':   'bg-red-100 text-red-600',
  'Cancelled':     'bg-red-100 text-red-500',
  'Quoted':        'bg-blue-100 text-blue-700',
  'Bidding':       'bg-violet-100 text-violet-700',
  'Initial Contact':'bg-slate-100 text-slate-600',
  'Cold':          'bg-slate-100 text-slate-500',
  'Cold Lead':     'bg-slate-100 text-slate-500',
  'Hold':          'bg-amber-100 text-amber-600',
  'Fake Lead':     'bg-red-50 text-red-400',
  'No response':   'bg-gray-100 text-gray-500',
  'Payment failed':'bg-red-100 text-red-500',
  'Waiting for approval': 'bg-yellow-100 text-yellow-600',
  'Shopping Around': 'bg-orange-100 text-orange-600',
  'Pricing Issue': 'bg-orange-100 text-orange-500',
  'Part Not Available': 'bg-gray-100 text-gray-500',
  'Desi':          'bg-pink-100 text-pink-600',
  'Supplier':      'bg-teal-100 text-teal-600',
}

export function DispositionBadge({ disposition }) {
  const cls = DISPOSITION_COLORS[disposition] || 'bg-gray-100 text-gray-600 border-gray-200'
  return <span className={`badge ${cls}`}>{disposition || '—'}</span>
}

export function TypeBadge({ type }) {
  const map = {
    lead:         { label: '◎ Lead',         cls: 'bg-blue-100 text-blue-600' },
    repeat:       { label: '↻ Repeat',        cls: 'bg-violet-100 text-violet-600' },
    online_order: { label: '◈ Online Order',  cls: 'bg-amber-100 text-amber-600' },
  }
  const t = map[type] || { label: type, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`badge ${t.cls}`}>{t.label}</span>
}

export function timeAgo(dateStr) {
  if (!dateStr) return '—'
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

export function formatDateShort(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
