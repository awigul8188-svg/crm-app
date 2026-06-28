// Builds a branded 3-page Tech Atlantix quote PDF and returns a Blob.
// Lazy-imported from QuoteModal so @react-pdf stays out of the main bundle.
import { Document, Page, View, Text, Svg, Polygon, StyleSheet, pdf } from '@react-pdf/renderer'

const TEAL = '#00D4C8'
const INK = '#0a0a0a'
const GREY = '#64748b'
const LIGHT = '#e2e8f0'

const num = v => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : n }
const money = v => `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Tech Atlantix mark (black parallelogram + two teal shapes), drawn as vectors.
function Logo({ size = 34 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Polygon points="10.5,7 36,7 30,21.5 10.5,21.5" fill={INK} />
      <Polygon points="29.5,22 56,22 56,36 29.5,36" fill={TEAL} />
      <Polygon points="29.5,36.5 42,36.5 42,56 10.5,56" fill={TEAL} />
    </Svg>
  )
}

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 44, paddingHorizontal: 40, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1e293b' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandTech: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: INK, letterSpacing: 1 },
  brandAtlantix: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: TEAL, letterSpacing: 1 },
  hr: { height: 2, backgroundColor: TEAL, marginVertical: 10 },
  label: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: GREY, letterSpacing: 0.6 },
  small: { fontSize: 9, color: '#334155', lineHeight: 1.5 },
})

function money2(v) { return money(v) }

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
        <View style={s.brandRow}><Logo size={40} /><Text style={s.brandTech}>TECH <Text style={s.brandAtlantix}>ATLANTIX</Text></Text></View>
        <View style={{ height: 60 }} />
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 30, color: INK }}>QUOTE</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 14, color: TEAL, marginTop: 2 }}>#{d.quoteNumber || ''}</Text>
        <View style={{ height: 40 }} />
        <Text style={s.label}>FROM</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, marginTop: 4, color: INK }}>{d.from?.company || 'Tech Atlantix'}</Text>
        <Text style={[s.small, { marginTop: 2 }]}>{d.from?.address}</Text>
        <Text style={[s.small, { marginTop: 2 }]}>{[d.from?.name, d.from?.email, d.from?.phone].filter(Boolean).join('  |  ')}</Text>
        <View style={{ height: 34 }} />
        <View style={{ borderLeftWidth: 3, borderLeftColor: TEAL, paddingLeft: 12 }}>
          <Text style={s.label}>PREPARED FOR</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, marginTop: 5, color: INK }}>{d.to?.company || d.to?.name || '—'}</Text>
          {!!d.to?.name && <Text style={[s.small, { marginTop: 3 }]}>{[d.to?.name, d.to?.phone].filter(Boolean).join('  |  ')}</Text>}
          {!!d.to?.email && <Text style={s.small}>{d.to.email}</Text>}
          {!!d.to?.address && <Text style={[s.small, { marginTop: 2 }]}>{d.to.address}</Text>}
        </View>
        <View style={{ position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 8, color: GREY }}>Date: {d.date}    ·    Valid until: {d.expiration}</Text>
          <Text style={{ fontSize: 8, color: GREY }}>Beyond Tech · Above Integration</Text>
        </View>
      </Page>

      {/* ── PAGE 2: THE QUOTE ── */}
      <Page size="A4" style={s.page}>
        <View style={[s.brandRow, { justifyContent: 'space-between' }]}>
          <View style={s.brandRow}><Logo size={26} /><Text style={s.brandTech}>TECH <Text style={s.brandAtlantix}>ATLANTIX</Text></Text></View>
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
                <Text style={{ width: 95, fontFamily: 'Helvetica-Bold', color: GREY }}>{k}:</Text><Text>{v || '—'}</Text>
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
          <View key={idx} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: LIGHT, backgroundColor: idx % 2 ? '#fafbfc' : '#fff' }}>
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

        <View style={{ marginTop: 24, alignItems: 'flex-end' }}>
          <Text style={{ color: GREY }}>Approved By:</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, marginTop: 3 }}>{d.approvedBy || ''}</Text>
        </View>

        <View style={{ position: 'absolute', bottom: 28, left: 40, right: 40 }}>
          <Text style={{ fontSize: 7.5, color: GREY }}>Note: {d.note || 'If you are paying via CC, there will be additional 3% CC Charges on total amount of order.'}</Text>
        </View>
      </Page>

      {/* ── PAGE 3: MARKETING BACK PAGE ── */}
      <Page size="A4" style={[s.page, { paddingTop: 60 }]}>
        <View style={s.brandRow}><Logo size={30} /><Text style={s.brandTech}>TECH <Text style={s.brandAtlantix}>ATLANTIX</Text></Text></View>
        <View style={{ height: 40 }} />
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: INK }}>One-Step RMA — No Tickets. No Waiting.</Text>
        <View style={{ height: 12 }} />
        <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#334155' }}>Traditional vendors make RMAs slow. You submit a ticket, it gets assigned, and days go by before action.</Text>
        <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#334155', marginTop: 8 }}>At Tech Atlantix, we replaced that bureaucracy with One-Step RMA. Your account manager handles everything directly: verification, authorization, and replacement — usually within hours. You stay focused on operations, not paperwork.</Text>
        <View style={{ height: 30 }} />
        <View style={{ height: 2, width: 90, backgroundColor: TEAL }} />
        <View style={{ height: 18 }} />
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 16, color: INK }}>Exceptionally Low RMA Rate — Quality You Can Trust</Text>
        <View style={{ height: 12 }} />
        <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#334155' }}>At Tech Atlantix, every product — even end-of-life (EOL) components — goes through a rigorous in-house testing process before shipment.</Text>
        <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#334155', marginTop: 8 }}>Our dedicated testing facility ensures each part meets operational standards and compatibility requirements, drastically reducing failure rates.</Text>
        <Text style={{ fontSize: 11, lineHeight: 1.6, color: '#334155', marginTop: 8 }}>That's why our RMA rate remains among the lowest in the industry — because we don't just ship parts, we ship confidence.</Text>
        <View style={{ position: 'absolute', bottom: 30, left: 40, right: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 8, color: GREY }}>Beyond Tech · Above Integration</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateQuoteBlob(data) {
  return await pdf(<QuoteDoc d={data} />).toBlob()
}
