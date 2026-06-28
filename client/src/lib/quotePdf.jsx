// Builds a branded 3-page Tech Atlantix quote PDF and returns a Blob.
// Lazy-imported from QuoteModal so @react-pdf stays out of the main bundle.
import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import logoOnLight from '../assets/ta-logo-on-light.png' // black-top mark (PDF pages are white)

const TEAL = '#00D4C8'
const INK = '#0a0a0a'
const GREY = '#64748b'
const LIGHT = '#e2e8f0'

const num = v => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : n }
const money = v => `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Tech Atlantix logo (exact brand mark image), sized by height; ratio ~0.9.
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
  // Pages are flex columns so content can be distributed to fill the full A4 height.
  page: { paddingTop: 36, paddingBottom: 36, paddingHorizontal: 40, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1e293b', flexDirection: 'column' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandTech: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: INK, letterSpacing: 1 },
  brandAtlantix: { fontFamily: 'Helvetica-Bold', color: TEAL, letterSpacing: 1 },
  hr: { height: 2, backgroundColor: TEAL, marginVertical: 10 },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: GREY, letterSpacing: 0.6 },
  small: { fontSize: 9, color: '#334155', lineHeight: 1.5 },
  fill: { flexGrow: 1 }, // flexible spacer — pushes content apart to fill the page
})

function QuoteDoc({ d }) {
  const items = (d.items || []).filter(it => (it.part || '').trim() || num(it.price) > 0)
  const subtotal = items.reduce((t, it) => t + num(it.price) * num(it.qty), 0)
  const discount = num(d.discount), tax = num(d.tax), shipping = num(d.shipping)
  const grand = subtotal - discount + tax + shipping
  const COLS = [{ w: 34, a: 'left' }, { w: 95, a: 'left' }, { w: 215, a: 'left' }, { w: 80, a: 'right' }, { w: 90, a: 'right' }]

  return (
    <Document title={`Quote ${d.quoteNumber || ''}`} author="Tech Atlantix">
      {/* ── PAGE 1: COVER ── */}
      <Page size="A4" style={s.page}>
        <Brand size={14} logo={40} />

        {/* Hero block fills the space between header and footer, vertically centred */}
        <View style={[s.fill, { justifyContent: 'center' }]}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 46, color: INK, letterSpacing: 1 }}>QUOTE</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 16, color: TEAL, marginTop: 4 }}>#{d.quoteNumber || ''}</Text>
          <View style={{ height: 2, width: 72, backgroundColor: TEAL, marginVertical: 24 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ width: '46%' }}>
              <Text style={s.label}>FROM</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, marginTop: 5, color: INK }}>{d.from?.company || 'Tech Atlantix'}</Text>
              {!!d.from?.address && <Text style={[s.small, { marginTop: 3 }]}>{d.from.address}</Text>}
              {!!d.from?.name && <Text style={[s.small, { marginTop: 2 }]}>{d.from.name}</Text>}
              {!!d.from?.email && <Text style={s.small}>{d.from.email}</Text>}
              {!!d.from?.phone && <Text style={s.small}>{d.from.phone}</Text>}
            </View>
            <View style={{ width: '46%', borderLeftWidth: 3, borderLeftColor: TEAL, paddingLeft: 14 }}>
              <Text style={s.label}>PREPARED FOR</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, marginTop: 5, color: INK }}>{d.to?.company || d.to?.name || '—'}</Text>
              {!!d.to?.name && <Text style={[s.small, { marginTop: 3 }]}>{d.to.name}</Text>}
              {!!d.to?.email && <Text style={s.small}>{d.to.email}</Text>}
              {!!d.to?.phone && <Text style={s.small}>{d.to.phone}</Text>}
              {!!d.to?.address && <Text style={[s.small, { marginTop: 2 }]}>{d.to.address}</Text>}
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 28, gap: 34 }}>
            <View><Text style={s.label}>DATE</Text><Text style={[s.small, { marginTop: 3 }]}>{d.date || '—'}</Text></View>
            <View><Text style={s.label}>VALID UNTIL</Text><Text style={[s.small, { marginTop: 3 }]}>{d.expiration || '—'}</Text></View>
            <View><Text style={s.label}>PAYMENT TERMS</Text><Text style={[s.small, { marginTop: 3 }]}>{d.paymentTerms || '—'}</Text></View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: LIGHT, paddingTop: 8 }}>
          <Text style={{ fontSize: 8, color: GREY }}>{d.from?.company || 'Tech Atlantix'}</Text>
          <Text style={{ fontSize: 8, color: GREY }}>Beyond Tech · Above Integration</Text>
        </View>
      </Page>

      {/* ── PAGE 2: THE QUOTE ── */}
      <Page size="A4" style={s.page}>
        <View style={[s.brandRow, { justifyContent: 'space-between' }]}>
          <Brand size={13} logo={26} />
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: INK }}>QUOTE# {d.quoteNumber || ''}</Text>
        </View>
        <Text style={[s.small, { marginTop: 6 }]}>{d.from?.address}</Text>
        <Text style={s.small}>{[d.from?.name, d.from?.email, d.from?.phone].filter(Boolean).join('  |  ')}</Text>
        <View style={s.hr} />

        {/* Info grid */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ width: '52%' }}>
            {[['Project', d.project], ['Quote #', d.quoteNumber], ['Version', d.version], ['Date', d.date], ['Expiration Date', d.expiration], ['Payment Terms', d.paymentTerms]].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', marginBottom: 2 }}>
                <Text style={{ width: 95, fontFamily: 'Helvetica-Bold', color: GREY }}>{k}:</Text><Text style={{ flex: 1 }}>{v || '—'}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: '44%', backgroundColor: '#f8fafc', borderRadius: 4, padding: 8 }}>
            <Text style={[s.label, { marginBottom: 3 }]}>SHIP TO</Text>
            {[['Name', d.to?.name], ['Company', d.to?.company], ['Email', d.to?.email], ['PH#', d.to?.phone], ['Address', d.to?.address]].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', marginBottom: 2 }}>
                <Text style={{ width: 55, fontFamily: 'Helvetica-Bold', color: GREY }}>{k}:</Text><Text style={{ flex: 1 }}>{v || '—'}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Items table */}
        <View style={{ marginTop: 14, flexDirection: 'row', backgroundColor: INK, paddingVertical: 5, paddingHorizontal: 4 }}>
          {['Qty', 'Part #', 'Product Description', 'Price', 'Ext. Price'].map((h, i) => (
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

        {/* Summary row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
          <View>
            {[['Lead Time', d.leadTime], ['Condition', d.condition], ['Warranty', d.warranty]].map(([k, v]) => (
              <Text key={k} style={{ marginBottom: 2 }}><Text style={{ fontFamily: 'Helvetica-Bold', color: GREY }}>{k}: </Text>{v || '—'}</Text>
            ))}
          </View>
          <View style={{ width: 200 }}>
            {[['Total', subtotal], ['Discount', discount, true], ...(tax ? [['Tax', tax]] : []), ...(shipping ? [['Shipping', shipping]] : [])].map(([k, v, neg], i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text style={{ color: GREY }}>{k}</Text><Text>{neg && num(v) ? `- ${money(v)}` : money(v)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: INK, marginTop: 3, paddingTop: 4 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>Grand Total</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: TEAL }}>{money(grand)}</Text>
            </View>
          </View>
        </View>

        {/* Flexible spacer pushes the signature + note to the bottom so the page reads full */}
        <View style={[s.fill, { minHeight: 24 }]} />

        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ width: 200, borderTopWidth: 1, borderTopColor: INK, paddingTop: 4 }}>
            <Text style={{ color: GREY, fontSize: 8 }}>Approved By</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, marginTop: 2 }}>{d.approvedBy || ''}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 7.5, color: GREY, marginTop: 16, borderTopWidth: 1, borderTopColor: LIGHT, paddingTop: 6 }}>
          Note: {d.note || 'If you are paying via CC, there will be additional 3% CC Charges on total amount of order.'}
        </Text>
      </Page>

      {/* ── PAGE 3: MARKETING BACK PAGE ── */}
      <Page size="A4" style={s.page}>
        <Brand size={13} logo={30} />

        {/* Content vertically centred so the page fills */}
        <View style={[s.fill, { justifyContent: 'center' }]}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: INK }}>One-Step RMA — No Tickets. No Waiting.</Text>
          <View style={{ height: 12 }} />
          <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#334155' }}>Traditional vendors make RMAs slow. You submit a ticket, it gets assigned, and days go by before action.</Text>
          <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#334155', marginTop: 8 }}>At Tech Atlantix, we replaced that bureaucracy with One-Step RMA. Your account manager handles everything directly: verification, authorization, and replacement — usually within hours. You stay focused on operations, not paperwork.</Text>

          <View style={{ height: 2, width: 90, backgroundColor: TEAL, marginVertical: 28 }} />

          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 16, color: INK }}>Exceptionally Low RMA Rate — Quality You Can Trust</Text>
          <View style={{ height: 12 }} />
          <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#334155' }}>At Tech Atlantix, every product — even end-of-life (EOL) components — goes through a rigorous in-house testing process before shipment.</Text>
          <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#334155', marginTop: 8 }}>Our dedicated testing facility ensures each part meets operational standards and compatibility requirements, drastically reducing failure rates.</Text>
          <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#334155', marginTop: 8 }}>That's why our RMA rate remains among the lowest in the industry — because we don't just ship parts, we ship confidence.</Text>
        </View>

        <View style={{ alignItems: 'center', borderTopWidth: 1, borderTopColor: LIGHT, paddingTop: 8 }}>
          <Text style={{ fontSize: 8, color: GREY }}>Beyond Tech · Above Integration</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateQuoteBlob(data) {
  return await pdf(<QuoteDoc d={data} />).toBlob()
}
