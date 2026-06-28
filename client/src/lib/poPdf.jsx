// Builds a branded Tech Atlantix PURCHASE ORDER (TA → supplier) PDF and returns a Blob.
// Lazy-imported from POModal so @react-pdf stays out of the main bundle.
import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import logoOnLight from '../assets/ta-logo-on-light.png'

const TEAL = '#00D4C8'
const INK = '#0a0a0a'
const GREY = '#64748b'
const LIGHT = '#e2e8f0'

const num = v => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : n }
const money = v => `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Logo({ size = 34 }) { return <Image src={logoOnLight} style={{ height: size, width: size * 0.9 }} /> }
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

function PODoc({ d }) {
  const items = (d.items || []).filter(it => (it.part || '').trim() || (it.description || '').trim() || num(it.price) > 0)
  const total = items.reduce((t, it) => t + num(it.price) * num(it.qty), 0)
  const COLS = [{ w: 34, a: 'left' }, { w: 110, a: 'left' }, { w: 200, a: 'left' }, { w: 80, a: 'right' }, { w: 90, a: 'right' }]

  return (
    <Document title={`Purchase Order ${d.poNumber || ''}`} author="Tech Atlantix">
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Brand size={14} logo={36} />
            <Text style={[s.small, { marginTop: 8 }]}>{d.from?.company || 'Tech Atlantix'}</Text>
            <Text style={s.small}>{d.from?.address}</Text>
            <Text style={s.small}>{[d.from?.name, d.from?.email, d.from?.phone].filter(Boolean).join('  |  ')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 26, color: INK, letterSpacing: 1 }}>PURCHASE ORDER</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 13, color: TEAL, marginTop: 2 }}>#{d.poNumber || ''}</Text>
            <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
              {[['Date', d.date], ['Terms', d.terms], ['Order #', d.orderNumber]].filter(([, v]) => v).map(([k, v]) => (
                <Text key={k} style={{ fontSize: 9, color: '#334155', marginBottom: 1 }}><Text style={{ color: GREY }}>{k}: </Text>{v}</Text>
              ))}
            </View>
          </View>
        </View>

        <View style={s.hr} />

        {/* Vendor + Ship To */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ width: '48%' }}>
            <Text style={s.label}>VENDOR</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, marginTop: 4, color: INK }}>{d.vendor?.company || '—'}</Text>
            {!!d.vendor?.rep && <Text style={[s.small, { marginTop: 1 }]}>{d.vendor.rep}</Text>}
            {!!d.vendor?.email && <Text style={s.small}>{d.vendor.email}</Text>}
            {!!d.vendor?.phone && <Text style={s.small}>{d.vendor.phone}</Text>}
          </View>
          <View style={{ width: '48%' }}>
            <Text style={s.label}>SHIP TO</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, marginTop: 4, color: INK }}>{d.shipTo?.company || 'Tech Atlantix'}</Text>
            <Text style={[s.small, { marginTop: 1 }]}>{d.shipTo?.address || d.from?.address}</Text>
          </View>
        </View>

        {/* Items table */}
        <View style={{ marginTop: 16, flexDirection: 'row', backgroundColor: INK, paddingVertical: 5, paddingHorizontal: 4 }}>
          {['Qty', 'Part #', 'Description', 'Unit Cost', 'Amount'].map((h, i) => (
            <Text key={h} style={{ width: COLS[i].w, color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8.5, textAlign: COLS[i].a }}>{h}</Text>
          ))}
        </View>
        {items.map((it, idx) => (
          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 18, paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: LIGHT, backgroundColor: idx % 2 ? '#fafbfc' : '#fff' }}>
            <Text style={{ width: COLS[0].w }}>{num(it.qty) || ''}</Text>
            <Text style={{ width: COLS[1].w, fontFamily: 'Helvetica-Bold' }}>{it.part || ''}</Text>
            <Text style={{ width: COLS[2].w, color: '#334155' }}>{[it.description, it.condition].filter(Boolean).join(' · ')}</Text>
            <Text style={{ width: COLS[3].w, textAlign: 'right' }}>{money(it.price)}</Text>
            <Text style={{ width: COLS[4].w, textAlign: 'right', fontFamily: 'Helvetica-Bold' }}>{money(num(it.price) * num(it.qty))}</Text>
          </View>
        ))}
        {items.length === 0 && <Text style={{ padding: 8, color: GREY }}>No line items.</Text>}

        {/* Total */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
          <View style={{ width: 230 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: INK, paddingTop: 5 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12 }}>PO Total</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, color: TEAL }}>{money(total)}</Text>
            </View>
          </View>
        </View>

        <View style={[s.fill, { minHeight: 18 }]} />

        <View style={{ borderTopWidth: 1, borderTopColor: LIGHT, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 7.5, color: GREY, width: '75%' }}>{d.note || 'Please confirm availability, lead time, and pricing. Reference the PO number on all shipments and invoices.'}</Text>
          <Text style={{ fontSize: 8, color: GREY }}>Beyond Tech · Above Integration</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generatePOBlob(data) {
  return await pdf(<PODoc d={data} />).toBlob()
}
