// Builds a branded Tech Atlantix customer INVOICE PDF and returns a Blob.
// Lazy-imported from InvoiceModal so @react-pdf stays out of the main bundle.
import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import logoOnLight from '../assets/ta-logo-on-light.png' // black-top mark (PDF pages are white)

const TEAL = '#00D4C8'
const INK = '#0a0a0a'
const GREY = '#64748b'
const LIGHT = '#e2e8f0'

const num = v => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : n }
const money = v => `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Logo({ size = 34 }) {
  return <Image src={logoOnLight} style={{ height: size, width: size * 0.9 }} />
}
function Brand({ size = 13, logo = 30 }) {
  return (
    <View style={s.brandRow}>
      <Logo size={logo} />
      <Text style={[s.brandTech, { fontSize: size }]}>TECH <Text style={s.brandAtlantix}>ATLANTIX</Text></Text>
    </View>
  )
}

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 36, paddingHorizontal: 40, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1e293b', flexDirection: 'column' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandTech: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: INK, letterSpacing: 1 },
  brandAtlantix: { fontFamily: 'Helvetica-Bold', color: TEAL, letterSpacing: 1 },
  hr: { height: 2, backgroundColor: TEAL, marginVertical: 10 },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: GREY, letterSpacing: 0.6 },
  small: { fontSize: 9, color: '#334155', lineHeight: 1.5 },
  fill: { flexGrow: 1 },
})

function InvoiceDoc({ d }) {
  const items = (d.items || []).filter(it => (it.part || '').trim() || (it.description || '').trim() || num(it.price) > 0)
  const subtotal = items.reduce((t, it) => t + num(it.price) * num(it.qty), 0)
  const discount = num(d.discount), tax = num(d.tax), shipping = num(d.shipping), cc = num(d.cc)
  const total = subtotal - discount + tax + shipping + cc
  const paid = num(d.amountPaid)
  const balance = total - paid
  const COLS = [{ w: 34, a: 'left' }, { w: 95, a: 'left' }, { w: 215, a: 'left' }, { w: 80, a: 'right' }, { w: 90, a: 'right' }]

  const rows = [
    ['Subtotal', subtotal],
    ...(discount ? [['Discount', discount, true]] : []),
    ...(tax ? [['Tax', tax]] : []),
    ...(shipping ? [['Shipping', shipping]] : []),
    ...(cc ? [['CC Charges', cc]] : []),
  ]

  return (
    <Document title={`Invoice ${d.invoiceNumber || ''}`} author="Tech Atlantix">
      <Page size="A4" style={s.page}>
        {/* Header: brand left, INVOICE block right */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Brand size={14} logo={36} />
            <Text style={[s.small, { marginTop: 8 }]}>{d.from?.company || 'Tech Atlantix'}</Text>
            <Text style={s.small}>{d.from?.address}</Text>
            <Text style={s.small}>{[d.from?.name, d.from?.email, d.from?.phone].filter(Boolean).join('  |  ')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 30, color: INK, letterSpacing: 1 }}>INVOICE</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 13, color: TEAL, marginTop: 2 }}>#{d.invoiceNumber || ''}</Text>
            <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
              {[['Date', d.date], ['Due Date', d.dueDate], ['Terms', d.terms], ['Order #', d.orderNumber]].filter(([, v]) => v).map(([k, v]) => (
                <Text key={k} style={{ fontSize: 9, color: '#334155', marginBottom: 1 }}><Text style={{ color: GREY }}>{k}: </Text>{v}</Text>
              ))}
            </View>
          </View>
        </View>

        <View style={s.hr} />

        {/* Bill To + Amount Due callout */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ width: '55%' }}>
            <Text style={s.label}>BILL TO</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, marginTop: 4, color: INK }}>{d.to?.company || d.to?.name || '—'}</Text>
            {!!d.to?.name && !!d.to?.company && <Text style={[s.small, { marginTop: 1 }]}>{d.to.name}</Text>}
            {!!d.to?.address && <Text style={[s.small, { marginTop: 2 }]}>{d.to.address}</Text>}
            {!!d.to?.email && <Text style={s.small}>{d.to.email}</Text>}
            {!!d.to?.phone && <Text style={s.small}>{d.to.phone}</Text>}
          </View>
          <View style={{ width: '40%', backgroundColor: INK, borderRadius: 6, padding: 12, alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#94a3b8', letterSpacing: 0.6 }}>BALANCE DUE</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 22, color: TEAL, marginTop: 3 }}>{money(balance)}</Text>
            {!!d.paymentStatus && <Text style={{ fontSize: 8, color: '#cbd5e1', marginTop: 3 }}>{d.paymentStatus}</Text>}
          </View>
        </View>

        {/* Items table */}
        <View style={{ marginTop: 16, flexDirection: 'row', backgroundColor: INK, paddingVertical: 5, paddingHorizontal: 4 }}>
          {['Qty', 'Part #', 'Description', 'Unit Price', 'Amount'].map((h, i) => (
            <Text key={h} style={{ width: COLS[i].w, color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8.5, textAlign: COLS[i].a }}>{h}</Text>
          ))}
        </View>
        {items.map((it, idx) => (
          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 18, paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: LIGHT, backgroundColor: idx % 2 ? '#fafbfc' : '#fff' }}>
            <Text style={{ width: COLS[0].w }}>{num(it.qty) || ''}</Text>
            <Text style={{ width: COLS[1].w, fontFamily: 'Helvetica-Bold' }}>{it.part || ''}</Text>
            <Text style={{ width: COLS[2].w, color: '#334155' }}>{it.description || ''}</Text>
            <Text style={{ width: COLS[3].w, textAlign: 'right' }}>{money(it.price)}</Text>
            <Text style={{ width: COLS[4].w, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{money(num(it.price) * num(it.qty))}</Text>
          </View>
        ))}
        {items.length === 0 && <Text style={{ padding: 8, color: GREY }}>No line items.</Text>}

        {/* Totals */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
          <View style={{ width: 230 }}>
            {rows.map(([k, v, neg], i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ color: GREY }}>{k}</Text><Text>{neg && num(v) ? `- ${money(v)}` : money(v)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LIGHT, marginTop: 3, paddingTop: 4 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Total</Text><Text style={{ fontFamily: 'Helvetica-Bold' }}>{money(total)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ color: GREY }}>Amount Paid</Text><Text>{paid ? `- ${money(paid)}` : money(0)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: INK, marginTop: 3, paddingTop: 4 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12 }}>Balance Due</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, color: TEAL }}>{money(balance)}</Text>
            </View>
          </View>
        </View>

        {/* Flexible spacer pushes remit + notes to the bottom */}
        <View style={[s.fill, { minHeight: 18 }]} />

        {!!(d.remit && d.remit.trim()) && (
          <View style={{ backgroundColor: '#f8fafc', borderRadius: 6, borderLeftWidth: 3, borderLeftColor: TEAL, padding: 10, marginBottom: 10 }}>
            <Text style={[s.label, { marginBottom: 3 }]}>PAYMENT DETAILS</Text>
            <Text style={{ fontSize: 9, color: '#334155', lineHeight: 1.5 }}>{d.remit}</Text>
          </View>
        )}

        <View style={{ borderTopWidth: 1, borderTopColor: LIGHT, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 7.5, color: GREY, width: '75%' }}>{d.note || 'If you are paying via CC, there will be additional 3% CC Charges on total amount of order.'}</Text>
          <Text style={{ fontSize: 8, color: GREY }}>Beyond Tech · Above Integration</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateInvoiceBlob(data) {
  return await pdf(<InvoiceDoc d={data} />).toBlob()
}
