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
  'Closed Won':    'bg-green-50 text-green-700 border-green-200',
  'Processed':     'bg-green-50 text-green-700 border-green-200',
  'Closed Lost':   'bg-red-50 text-red-600 border-red-200',
  'Cancelled':     'bg-red-50 text-red-500 border-red-200',
  'Quoted':        'bg-blue-50 text-blue-700 border-blue-200',
  'Bidding':       'bg-violet-50 text-violet-700 border-violet-200',
  'Initial Contact':'bg-gray-100 text-gray-600 border-gray-200',
  'Cold':          'bg-slate-100 text-slate-500 border-slate-200',
  'Cold Lead':     'bg-slate-100 text-slate-500 border-slate-200',
  'Hold':          'bg-amber-50 text-amber-600 border-amber-200',
  'Fake Lead':     'bg-red-50 text-red-400 border-red-100',
  'No response':   'bg-gray-100 text-gray-500 border-gray-200',
  'Payment failed':'bg-red-50 text-red-500 border-red-200',
  'Waiting for approval': 'bg-yellow-50 text-yellow-600 border-yellow-200',
  'Shopping Around': 'bg-orange-50 text-orange-600 border-orange-200',
  'Pricing Issue': 'bg-orange-50 text-orange-500 border-orange-100',
  'Part Not Available': 'bg-gray-100 text-gray-500 border-gray-200',
  'Desi':          'bg-pink-50 text-pink-600 border-pink-200',
  'Supplier':      'bg-teal-50 text-teal-600 border-teal-200',
}

export function DispositionBadge({ disposition }) {
  const cls = DISPOSITION_COLORS[disposition] || 'bg-gray-100 text-gray-600 border-gray-200'
  return <span className={`badge ${cls}`}>{disposition || '—'}</span>
}

export function TypeBadge({ type }) {
  const map = {
    lead:         { label: '◎ Lead',         cls: 'bg-blue-50 text-blue-600 border-blue-100' },
    repeat:       { label: '↻ Repeat',        cls: 'bg-violet-50 text-violet-600 border-violet-100' },
    online_order: { label: '◈ Online Order',  cls: 'bg-amber-50 text-amber-600 border-amber-100' },
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
