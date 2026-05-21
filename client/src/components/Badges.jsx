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

const DISPOSITION_STYLES = {
  'Closed Won':    { bg:'rgba(16,185,129,0.15)',  color:'#34d399', border:'rgba(16,185,129,0.25)' },
  'Processed':     { bg:'rgba(16,185,129,0.15)',  color:'#34d399', border:'rgba(16,185,129,0.25)' },
  'Closed Lost':   { bg:'rgba(239,68,68,0.15)',   color:'#f87171', border:'rgba(239,68,68,0.25)'  },
  'Cancelled':     { bg:'rgba(239,68,68,0.12)',   color:'#fca5a5', border:'rgba(239,68,68,0.2)'   },
  'Quoted':        { bg:'rgba(59,130,246,0.15)',  color:'#60a5fa', border:'rgba(59,130,246,0.25)' },
  'Bidding':       { bg:'rgba(139,92,246,0.15)',  color:'#a78bfa', border:'rgba(139,92,246,0.25)' },
  'Initial Contact':{ bg:'rgba(255,255,255,0.07)', color:'var(--text-2)', border:'rgba(255,255,255,0.12)' },
  'Cold':          { bg:'rgba(100,116,139,0.15)', color:'#94a3b8', border:'rgba(100,116,139,0.25)' },
  'Cold Lead':     { bg:'rgba(100,116,139,0.15)', color:'#94a3b8', border:'rgba(100,116,139,0.25)' },
  'Hold':          { bg:'rgba(245,158,11,0.15)',  color:'#fbbf24', border:'rgba(245,158,11,0.25)' },
  'Fake Lead':     { bg:'rgba(239,68,68,0.1)',    color:'#fca5a5', border:'rgba(239,68,68,0.15)'  },
  'No response':   { bg:'rgba(100,116,139,0.12)', color:'#94a3b8', border:'rgba(100,116,139,0.2)' },
  'Payment failed':{ bg:'rgba(239,68,68,0.15)',   color:'#f87171', border:'rgba(239,68,68,0.25)'  },
  'Waiting for approval': { bg:'rgba(234,179,8,0.15)', color:'#facc15', border:'rgba(234,179,8,0.25)' },
  'Shopping Around': { bg:'rgba(249,115,22,0.15)', color:'#fb923c', border:'rgba(249,115,22,0.25)' },
  'Pricing Issue': { bg:'rgba(249,115,22,0.12)', color:'#fb923c', border:'rgba(249,115,22,0.2)' },
  'Part Not Available': { bg:'rgba(100,116,139,0.12)', color:'#94a3b8', border:'rgba(100,116,139,0.2)' },
  'Condition Not Available': { bg:'rgba(100,116,139,0.12)', color:'#94a3b8', border:'rgba(100,116,139,0.2)' },
  'Needed in stock': { bg:'rgba(245,158,11,0.12)', color:'#fbbf24', border:'rgba(245,158,11,0.2)' },
  'Desi':          { bg:'rgba(236,72,153,0.15)',  color:'#f472b6', border:'rgba(236,72,153,0.25)' },
  'Supplier':      { bg:'rgba(0,212,200,0.12)',   color:'#00D4C8', border:'rgba(0,212,200,0.2)'   },
  'Supplier but working on it': { bg:'rgba(0,212,200,0.1)', color:'#00D4C8', border:'rgba(0,212,200,0.15)' },
  'Chinese Supplier': { bg:'rgba(255,255,255,0.07)', color:'var(--text-2)', border:'rgba(255,255,255,0.1)' },
  'Project Cancelled': { bg:'rgba(239,68,68,0.1)', color:'#fca5a5', border:'rgba(239,68,68,0.15)' },
}

export function DispositionBadge({ disposition }) {
  const s = DISPOSITION_STYLES[disposition] || { bg:'rgba(255,255,255,0.07)', color:'var(--text-2)', border:'rgba(255,255,255,0.1)' }
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:s.bg, color:s.color, border:`1px solid ${s.border}`, whiteSpace:'nowrap', display:'inline-flex', alignItems:'center' }}>
      {disposition || '—'}
    </span>
  )
}

export function TypeBadge({ type }) {
  const map = {
    lead:         { label: '◎ Lead',        bg:'rgba(59,130,246,0.15)',  color:'#60a5fa', border:'rgba(59,130,246,0.25)' },
    repeat:       { label: '↻ Repeat',       bg:'rgba(139,92,246,0.15)', color:'#a78bfa', border:'rgba(139,92,246,0.25)' },
    online_order: { label: '◈ Online Order', bg:'rgba(245,158,11,0.15)', color:'#fbbf24', border:'rgba(245,158,11,0.25)' },
  }
  const t = map[type] || { label: type, bg:'rgba(255,255,255,0.07)', color:'var(--text-2)', border:'rgba(255,255,255,0.1)' }
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:t.bg, color:t.color, border:`1px solid ${t.border}`, whiteSpace:'nowrap', display:'inline-flex', alignItems:'center' }}>
      {t.label}
    </span>
  )
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
