const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { authenticate, requireManager } = require('../middleware/auth');
const { businessToday } = require('./businessTime');

router.use(authenticate);

// ── Reporting-period helpers (open/close month) ────────────────────────────────
const PERIOD_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
// 'Jun-26' → 'Jul-26', 'Dec-26' → 'Jan-27'
function nextPeriod(period) {
  if (!period) return period;
  const [mon, yr] = String(period).split('-');
  let idx = PERIOD_MONTHS.indexOf(mon);
  if (idx === -1 || yr === undefined) return period;
  let year = parseInt(yr, 10);
  idx += 1;
  if (idx > 11) { idx = 0; year += 1; }
  return `${PERIOD_MONTHS[idx]}-${String(year).padStart(2, '0')}`;
}
function getOpenPeriod(db) {
  const row = db.prepare(`SELECT value FROM op_settings WHERE key='open_period'`).get();
  return row?.value || null;
}

// Collapse lead-source spelling variants into canonical buckets (same rules as the Marketing card)
// so source breakdowns don't show duplicates. 'Chat' (website order) is kept distinct from 'Chat lead'.
function canonicalSource(s) {
  const x = String(s || '').toLowerCase().trim();
  if (/chat/.test(x))         return /lead/.test(x) ? 'Chat Lead' : 'Chat';
  if (/call|inbound/.test(x)) return 'Call Lead';   // 'Call lead' + 'Inbound call'
  if (/rfq|form/.test(x))     return 'RFQ Lead';     // 'RFQ Lead' + 'Web RFQ Lead' + 'Form lead'
  if (/email/.test(x))        return 'Email Lead';
  if (/online/.test(x))       return 'Online';
  if (/repeat/.test(x))       return 'Repeat';
  if (/outbound/.test(x))     return 'Outbound';
  if (/ppc/.test(x))          return 'PPC';
  if (!x || x === 'unknown')  return 'Unknown';
  return String(s);
}
// Merge rows that share a canonical lead_source, summing the given numeric keys; sort by sortKey desc.
function consolidateSources(rows, sumKeys, sortKey) {
  const map = {};
  for (const r of (rows || [])) {
    const k = canonicalSource(r.lead_source);
    if (!map[k]) { map[k] = { lead_source: k }; sumKeys.forEach(sk => { map[k][sk] = 0; }); }
    sumKeys.forEach(sk => { map[k][sk] += Number(r[sk]) || 0; });
  }
  return Object.values(map).sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
}

const ORDER_TOTALS_SQL = `
  SELECT
    o.*,
    c.name  AS customer_name,
    c.phone AS customer_phone,
    COALESCE(SUM(i.selling * i.quantity), 0)
      AS order_amount,
    COALESCE(SUM(i.selling * i.quantity), 0) + o.tax_charged + o.shipping_charged + o.cc_charges
      AS total_order_value,
    COALESCE(SUM(i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid), 0)
      AS total_buying,
    COALESCE(SUM(i.selling * i.quantity), 0) + o.tax_charged + o.shipping_charged + o.cc_charges
      - COALESCE(SUM(i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid), 0)
      - o.rma_amount
      AS gp,
    COALESCE(SUM(i.selling * i.quantity), 0) + o.tax_charged + o.shipping_charged + o.cc_charges
      - o.customer_paid
      AS remaining
  FROM op_orders o
  LEFT JOIN op_customers c ON o.customer_id = c.id
  LEFT JOIN op_order_items i ON i.order_id = o.id AND COALESCE(i.line_status,'processed') = 'processed'
`;

// ── Orders ────────────────────────────────────────────────────────────────────

router.get('/orders', (req, res) => {
  try {
    const db = getDB();
    const { search, status, rep, customer_id, lead_source, payment_status, date_from, date_to, reporting_period } = req.query;
    let where = [];
    let params = [];

    if (search) {
      where.push(`(o.order_number LIKE ? OR c.name LIKE ? OR o.email LIKE ?)`);
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (status)            { where.push(`o.order_status = ?`);       params.push(status); }
    if (payment_status)    { where.push(`o.payment_status = ?`);     params.push(payment_status); }
    if (rep)               { where.push(`o.rep = ?`);                 params.push(rep); }
    if (customer_id)       { where.push(`o.customer_id = ?`);         params.push(customer_id); }
    if (lead_source)       { where.push(`o.lead_source = ?`);         params.push(lead_source); }
    if (reporting_period)  {
      const rps = reporting_period.split(',').map(s => s.trim()).filter(Boolean);
      if (rps.length === 1) { where.push(`o.reporting_period = ?`); params.push(rps[0]); }
      else { where.push(`o.reporting_period IN (${rps.map(() => '?').join(',')})`); params.push(...rps); }
    } else {
      if (date_from)       { where.push(`o.order_date >= ?`);         params.push(date_from); }
      if (date_to)         { where.push(`o.order_date <= ?`);         params.push(date_to); }
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orders = db.prepare(`${ORDER_TOTALS_SQL} ${whereClause} GROUP BY o.id ORDER BY o.order_date DESC, o.id DESC`).all(...params);
    res.json(orders);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/orders', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { order_number, order_date, customer_id, email, lead_source, rep, ppc_order_rep, buyer,
            payment_status, order_status, net, due_date, tax_charged, shipping_charged,
            cc_charges, rma_amount, shipped_via, tracking_to_customer, notes,
            reporting_period } = req.body;
    // New CRM orders are auto-tagged to the current OPEN month (so they appear in month/quarter
    // dashboards). An explicit reporting_period in the body still wins if provided.
    const period = reporting_period || getOpenPeriod(db);
    // customer_paid is NOT set here — it is derived from the customer payment log (op_order_payments).
    const result = db.prepare(`
      INSERT INTO op_orders (order_number,order_date,customer_id,email,lead_source,rep,ppc_order_rep,buyer,
        payment_status,order_status,net,due_date,tax_charged,shipping_charged,cc_charges,
        rma_amount,shipped_via,tracking_to_customer,notes,reporting_period)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(order_number, order_date||null, customer_id||null, email||null,
           lead_source||null, rep||null, ppc_order_rep||null, buyer||null,
           payment_status||null, order_status||'Order placed', net||0, due_date||null,
           tax_charged||0, shipping_charged||0, cc_charges||0,
           rma_amount||0, shipped_via||null, tracking_to_customer||null, notes||null, period||null);
    const order = db.prepare(`${ORDER_TOTALS_SQL} WHERE o.id = ? GROUP BY o.id`).get(result.lastInsertRowid);
    res.json(order);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/orders/:id', (req, res) => {
  try {
    const db = getDB();
    const order = db.prepare(`${ORDER_TOTALS_SQL} WHERE o.id = ? GROUP BY o.id`).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = db.prepare(`
      SELECT i.*, s.company AS supplier_name,
        (i.selling * i.quantity) AS total_selling,
        (i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid) AS ext_total_buying,
        (i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid) - i.paid_to_supplier AS supplier_remaining
      FROM op_order_items i
      LEFT JOIN op_suppliers s ON i.supplier_id = s.id
      WHERE i.order_id = ?
      ORDER BY i.id
    `).all(req.params.id);
    const rmas = db.prepare(`
      SELECT r.*,
        i.part_number AS return_item_part, i.description AS return_item_desc, i.selling AS unit_selling_price,
        COALESCE(r.return_quantity,1) * COALESCE(i.selling,0) AS return_amount
      FROM op_rma r
      LEFT JOIN op_order_items i ON r.order_item_id = i.id
      WHERE r.order_id = ? ORDER BY r.id DESC
    `).all(req.params.id);
    res.json({ ...order, items, rmas });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/orders/:id', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { order_number, order_date, customer_id, email, lead_source, rep, ppc_order_rep, buyer,
            payment_status, order_status, net, due_date, tax_charged, shipping_charged,
            cc_charges, rma_amount, shipped_via, tracking_to_customer, notes } = req.body;
    // customer_paid is intentionally NOT updated here — it is owned by the payment log (syncOrderPaid).
    db.prepare(`
      UPDATE op_orders SET order_number=?,order_date=?,customer_id=?,email=?,lead_source=?,rep=?,
        ppc_order_rep=?,buyer=?,payment_status=?,order_status=?,net=?,due_date=?,tax_charged=?,
        shipping_charged=?,cc_charges=?,rma_amount=?,shipped_via=?,
        tracking_to_customer=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(order_number, order_date||null, customer_id||null, email||null,
           lead_source||null, rep||null, ppc_order_rep||null, buyer||null,
           payment_status||null, order_status||'Order placed', net||0, due_date||null,
           tax_charged||0, shipping_charged||0, cc_charges||0,
           rma_amount||0, shipped_via||null, tracking_to_customer||null, notes||null, req.params.id);
    const order = db.prepare(`${ORDER_TOTALS_SQL} WHERE o.id = ? GROUP BY o.id`).get(req.params.id);
    res.json(order);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/orders/:id', requireManager, (req, res) => {
  try {
    getDB().prepare(`DELETE FROM op_orders WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Order Items ───────────────────────────────────────────────────────────────

router.post('/orders/:id/items', (req, res) => {
  try {
    const db = getDB();
    const { part_number, description, product, supplier_id, quantity, product_condition,
            selling, buying, cc_paid, tax_paid, shipping_paid, duty_paid,
            payment_method, payment_due, tracking_to_warehouse, ta_po_number, serials, line_status,
            supplier_terms } = req.body;
    // paid_to_supplier is NOT set here — it is derived from the supplier payment log (op_item_payments).
    const result = db.prepare(`
      INSERT INTO op_order_items (order_id,part_number,description,product,supplier_id,quantity,
        product_condition,selling,buying,cc_paid,tax_paid,shipping_paid,duty_paid,
        payment_method,payment_due,tracking_to_warehouse,ta_po_number,serials,line_status,supplier_terms)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(req.params.id, part_number||null, description||null, product||null, supplier_id||null,
           quantity||1, product_condition||null, selling||0, buying||0, cc_paid||0,
           tax_paid||0, shipping_paid||0, duty_paid||0,
           payment_method||null, payment_due||null, tracking_to_warehouse||null,
           ta_po_number||null, serials||null, line_status === 'pending' ? 'pending' : 'processed',
           supplier_terms||null);
    const item = db.prepare(`
      SELECT i.*, s.company AS supplier_name,
        (i.selling * i.quantity) AS total_selling,
        (i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid) AS ext_total_buying
      FROM op_order_items i LEFT JOIN op_suppliers s ON i.supplier_id = s.id
      WHERE i.id = ?
    `).get(result.lastInsertRowid);
    res.json(item);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/order-items/:id', (req, res) => {
  try {
    const db = getDB();
    const { part_number, description, product, supplier_id, quantity, product_condition,
            selling, buying, cc_paid, tax_paid, shipping_paid, duty_paid,
            payment_method, payment_due, tracking_to_warehouse, ta_po_number, serials, line_status,
            supplier_terms } = req.body;
    // paid_to_supplier is intentionally NOT updated here — owned by the supplier payment log (syncItemPaid).
    db.prepare(`
      UPDATE op_order_items SET part_number=?,description=?,product=?,supplier_id=?,quantity=?,
        product_condition=?,selling=?,buying=?,cc_paid=?,tax_paid=?,shipping_paid=?,duty_paid=?,
        payment_method=?,payment_due=?,tracking_to_warehouse=?,ta_po_number=?,
        serials=?,line_status=?,supplier_terms=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(part_number||null, description||null, product||null, supplier_id||null,
           quantity||1, product_condition||null, selling||0, buying||0, cc_paid||0,
           tax_paid||0, shipping_paid||0, duty_paid||0,
           payment_method||null, payment_due||null, tracking_to_warehouse||null,
           ta_po_number||null, serials||null, line_status === 'pending' ? 'pending' : 'processed',
           supplier_terms||null, req.params.id);
    const item = db.prepare(`
      SELECT i.*, s.company AS supplier_name,
        (i.selling * i.quantity) AS total_selling,
        (i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid) AS ext_total_buying
      FROM op_order_items i LEFT JOIN op_suppliers s ON i.supplier_id = s.id
      WHERE i.id = ?
    `).get(req.params.id);
    res.json(item);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/order-items/:id', (req, res) => {
  try {
    getDB().prepare(`DELETE FROM op_order_items WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Customers ─────────────────────────────────────────────────────────────────

router.get('/customers', (req, res) => {
  try {
    const db = getDB();
    const { search } = req.query;
    const customers = search
      ? db.prepare(`SELECT c.*, COUNT(o.id) AS order_count FROM op_customers c LEFT JOIN op_orders o ON o.customer_id = c.id WHERE c.name LIKE ? OR c.email LIKE ? GROUP BY c.id ORDER BY c.name`).all(`%${search}%`, `%${search}%`)
      : db.prepare(`SELECT c.*, COUNT(o.id) AS order_count FROM op_customers c LEFT JOIN op_orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY c.name`).all();
    res.json(customers);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/customers', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { name, email, phone, address, notes } = req.body;
    const result = db.prepare(`INSERT INTO op_customers (name,email,phone,address,notes) VALUES (?,?,?,?,?)`).run(name, email||null, phone||null, address||null, notes||null);
    res.json(db.prepare(`SELECT * FROM op_customers WHERE id = ?`).get(result.lastInsertRowid));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/customers/:id', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { name, email, phone, address, notes } = req.body;
    db.prepare(`UPDATE op_customers SET name=?,email=?,phone=?,address=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(name, email||null, phone||null, address||null, notes||null, req.params.id);
    res.json(db.prepare(`SELECT * FROM op_customers WHERE id = ?`).get(req.params.id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/customers/:id', requireManager, (req, res) => {
  try {
    getDB().prepare(`DELETE FROM op_customers WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Suppliers ─────────────────────────────────────────────────────────────────

router.get('/suppliers', (req, res) => {
  try {
    const db = getDB();
    const { search } = req.query;
    const suppliers = search
      ? db.prepare(`SELECT * FROM op_suppliers WHERE company LIKE ? OR rep_name LIKE ? OR email LIKE ? ORDER BY company`).all(`%${search}%`, `%${search}%`, `%${search}%`)
      : db.prepare(`SELECT * FROM op_suppliers ORDER BY company`).all();
    res.json(suppliers);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/suppliers', requireBuyerAccess, (req, res) => {
  try {
    const db = getDB();
    const { company, email, phone, rep_name, notes } = req.body;
    const result = db.prepare(`INSERT INTO op_suppliers (company,email,phone,rep_name,notes) VALUES (?,?,?,?,?)`).run(company, email||null, phone||null, rep_name||null, notes||null);
    res.json(db.prepare(`SELECT * FROM op_suppliers WHERE id = ?`).get(result.lastInsertRowid));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/suppliers/:id', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { company, email, phone, rep_name, notes } = req.body;
    db.prepare(`UPDATE op_suppliers SET company=?,email=?,phone=?,rep_name=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(company, email||null, phone||null, rep_name||null, notes||null, req.params.id);
    res.json(db.prepare(`SELECT * FROM op_suppliers WHERE id = ?`).get(req.params.id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/suppliers/:id', requireManager, (req, res) => {
  try {
    getDB().prepare(`DELETE FROM op_suppliers WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── RMA ───────────────────────────────────────────────────────────────────────

const RMA_SELECT = `
  SELECT r.*,
    c.name AS customer_name,
    o.order_number,
    i.part_number AS return_item_part,
    i.description AS return_item_desc,
    i.selling     AS unit_selling_price,
    COALESCE(r.return_quantity, 1) * COALESCE(i.selling, 0) AS return_amount
  FROM op_rma r
  LEFT JOIN op_customers c ON r.customer_id = c.id
  LEFT JOIN op_orders o ON r.order_id = o.id
  LEFT JOIN op_order_items i ON r.order_item_id = i.id
`;

router.get('/rma', (req, res) => {
  try {
    const db = getDB();
    const { search, status, order_id } = req.query;
    let where = [];
    let params = [];
    if (search) { where.push(`(r.rma_number LIKE ? OR c.name LIKE ? OR o.order_number LIKE ?)`); const s = `%${search}%`; params.push(s, s, s); }
    if (status) { where.push(`r.rma_status = ?`); params.push(status); }
    if (order_id) { where.push(`r.order_id = ?`); params.push(order_id); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rmas = db.prepare(`${RMA_SELECT} ${whereClause} ORDER BY r.created_at DESC`).all(...params);
    res.json(rmas);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Recompute an order's rma_amount = the GP reduction from its COMPLETED returns.
// Per-RMA GP reduction (the "profit reversal" model, matching the old sheet negative-line method):
//   return_qty × selling                            revenue reversed
//   − (cost_recovered ? return_qty × buying : 0)    cost comes back if recovered, else eaten
//   − restocking_fee                                kept as profit
//   + return_shipping_paid                          shipping you absorbed
// The dashboard GP formula already subtracts rma_amount, so no GP query changes are needed.
// Only Completed RMAs count — in-process ones move nothing. Orders with no RMAs keep rma_amount 0.
function syncOrderRmaAmount(db, orderId) {
  if (!orderId) return;
  const result = db.prepare(`
    SELECT COALESCE(SUM(
        COALESCE(r.return_quantity,1) * COALESCE(i.selling,0)
      - CASE WHEN COALESCE(r.cost_recovered,1) = 1
             THEN COALESCE(r.return_quantity,1) * COALESCE(i.buying,0) ELSE 0 END
      - COALESCE(r.restocking_fee,0)
      + COALESCE(r.return_shipping_paid,0)
    ), 0) AS total_rma
    FROM op_rma r
    LEFT JOIN op_order_items i ON r.order_item_id = i.id
    WHERE r.order_id = ? AND r.rma_status = 'Completed'
  `).get(orderId);
  db.prepare(`UPDATE op_orders SET rma_amount=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(result.total_rma, orderId);
}

// Keep op_orders.customer_paid in sync with the SUM of recorded customer payments.
function syncOrderPaid(db, orderId) {
  if (!orderId) return;
  const r = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM op_order_payments WHERE order_id=?`).get(orderId);
  db.prepare(`UPDATE op_orders SET customer_paid=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(r.total, orderId);
}

// ── Customer payments (AR receipts) ───────────────────────────────────────────
router.get('/orders/:id/payments', (req, res) => {
  try {
    const rows = getDB().prepare(`SELECT * FROM op_order_payments WHERE order_id=? ORDER BY payment_date DESC, id DESC`).all(req.params.id);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/orders/:id/payments', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { amount, payment_date, method, reference, notes } = req.body;
    const result = db.prepare(`INSERT INTO op_order_payments (order_id,amount,payment_date,method,reference,notes) VALUES (?,?,?,?,?,?)`)
      .run(req.params.id, Number(amount) || 0, payment_date || null, method || null, reference || null, notes || null);
    syncOrderPaid(db, req.params.id);
    res.json(db.prepare(`SELECT * FROM op_order_payments WHERE id=?`).get(result.lastInsertRowid));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/payments/:id', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { amount, payment_date, method, reference, notes } = req.body;
    const row = db.prepare(`SELECT order_id FROM op_order_payments WHERE id=?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Payment not found' });
    db.prepare(`UPDATE op_order_payments SET amount=?,payment_date=?,method=?,reference=?,notes=? WHERE id=?`)
      .run(Number(amount) || 0, payment_date || null, method || null, reference || null, notes || null, req.params.id);
    syncOrderPaid(db, row.order_id);
    res.json(db.prepare(`SELECT * FROM op_order_payments WHERE id=?`).get(req.params.id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/payments/:id', requireManager, (req, res) => {
  try {
    const db = getDB();
    const row = db.prepare(`SELECT order_id FROM op_order_payments WHERE id=?`).get(req.params.id);
    db.prepare(`DELETE FROM op_order_payments WHERE id=?`).run(req.params.id);
    if (row) syncOrderPaid(db, row.order_id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Supplier payments (AP disbursements) ──────────────────────────────────────
// A line item's paid_to_supplier is kept in sync with the SUM of its payment records.
function syncItemPaid(db, itemId) {
  if (!itemId) return;
  const r = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM op_item_payments WHERE order_item_id=?`).get(itemId);
  db.prepare(`UPDATE op_order_items SET paid_to_supplier=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(r.total, itemId);
}

router.get('/order-items/:id/payments', (req, res) => {
  try {
    res.json(getDB().prepare(`SELECT * FROM op_item_payments WHERE order_item_id=? ORDER BY payment_date DESC, id DESC`).all(req.params.id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/order-items/:id/payments', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { amount, payment_date, method, reference, notes } = req.body;
    const result = db.prepare(`INSERT INTO op_item_payments (order_item_id,amount,payment_date,method,reference,notes) VALUES (?,?,?,?,?,?)`)
      .run(req.params.id, Number(amount) || 0, payment_date || null, method || null, reference || null, notes || null);
    syncItemPaid(db, req.params.id);
    res.json(db.prepare(`SELECT * FROM op_item_payments WHERE id=?`).get(result.lastInsertRowid));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/item-payments/:id', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { amount, payment_date, method, reference, notes } = req.body;
    const row = db.prepare(`SELECT order_item_id FROM op_item_payments WHERE id=?`).get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Payment not found' });
    db.prepare(`UPDATE op_item_payments SET amount=?,payment_date=?,method=?,reference=?,notes=? WHERE id=?`)
      .run(Number(amount) || 0, payment_date || null, method || null, reference || null, notes || null, req.params.id);
    syncItemPaid(db, row.order_item_id);
    res.json(db.prepare(`SELECT * FROM op_item_payments WHERE id=?`).get(req.params.id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/item-payments/:id', requireManager, (req, res) => {
  try {
    const db = getDB();
    const row = db.prepare(`SELECT order_item_id FROM op_item_payments WHERE id=?`).get(req.params.id);
    db.prepare(`DELETE FROM op_item_payments WHERE id=?`).run(req.params.id);
    if (row) syncItemPaid(db, row.order_item_id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/rma', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { rma_number, order_id, order_item_id, customer_id, email, return_quantity, return_reason,
            rma_status, rma_issue_date, rma_completed_date, refund_issued, restocking_fee,
            return_tracking_number, return_shipping_paid, notes, qb_credit_memo, cost_recovered } = req.body;
    const result = db.prepare(`
      INSERT INTO op_rma (rma_number,order_id,order_item_id,customer_id,email,return_quantity,return_reason,
        rma_status,rma_issue_date,rma_completed_date,refund_issued,restocking_fee,
        return_tracking_number,return_shipping_paid,notes,qb_credit_memo,cost_recovered)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(rma_number, order_id||null, order_item_id||null, customer_id||null, email||null,
           return_quantity||1, return_reason||null, rma_status||'Initiated',
           rma_issue_date||null, rma_completed_date||null,
           refund_issued||0, restocking_fee||0, return_tracking_number||null,
           return_shipping_paid||0, notes||null, qb_credit_memo||null,
           cost_recovered === 0 || cost_recovered === false ? 0 : 1);
    if (order_id) syncOrderRmaAmount(db, order_id);
    res.json(db.prepare(`${RMA_SELECT} WHERE r.id=?`).get(result.lastInsertRowid));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/rma/:id', (req, res) => {
  try {
    const db = getDB();
    const rma = db.prepare(`${RMA_SELECT} WHERE r.id=?`).get(req.params.id);
    if (!rma) return res.status(404).json({ error: 'RMA not found' });
    res.json(rma);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/rma/:id', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { rma_number, order_id, order_item_id, customer_id, email, return_quantity, return_reason,
            rma_status, rma_issue_date, rma_completed_date, refund_issued, restocking_fee,
            return_tracking_number, return_shipping_paid, notes, qb_credit_memo, cost_recovered } = req.body;
    const prevRma = db.prepare(`SELECT order_id FROM op_rma WHERE id=?`).get(req.params.id);
    db.prepare(`
      UPDATE op_rma SET rma_number=?,order_id=?,order_item_id=?,customer_id=?,email=?,return_quantity=?,
        return_reason=?,rma_status=?,rma_issue_date=?,rma_completed_date=?,refund_issued=?,
        restocking_fee=?,return_tracking_number=?,return_shipping_paid=?,notes=?,
        qb_credit_memo=?,cost_recovered=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(rma_number, order_id||null, order_item_id||null, customer_id||null, email||null,
           return_quantity||1, return_reason||null, rma_status||'Initiated',
           rma_issue_date||null, rma_completed_date||null,
           refund_issued||0, restocking_fee||0, return_tracking_number||null,
           return_shipping_paid||0, notes||null, qb_credit_memo||null,
           cost_recovered === 0 || cost_recovered === false ? 0 : 1, req.params.id);
    if (order_id) syncOrderRmaAmount(db, order_id);
    if (prevRma?.order_id && prevRma.order_id !== (order_id||null)) syncOrderRmaAmount(db, prevRma.order_id);
    res.json(db.prepare(`${RMA_SELECT} WHERE r.id=?`).get(req.params.id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/rma/:id', requireManager, (req, res) => {
  try {
    const db = getDB();
    const toDelete = db.prepare(`SELECT order_id FROM op_rma WHERE id=?`).get(req.params.id);
    db.prepare(`DELETE FROM op_rma WHERE id = ?`).run(req.params.id);
    if (toDelete?.order_id) syncOrderRmaAmount(db, toDelete.order_id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── All Order Items (global view) ────────────────────────────────────────────

router.get('/items', (req, res) => {
  try {
    const db = getDB();
    const { search = '', order_id } = req.query;
    const like = `%${search}%`;
    const rows = db.prepare(`
      SELECT
        i.*,
        o.order_number,
        s.company AS supplier_name,
        (i.selling * i.quantity) AS total_selling,
        (i.buying * i.quantity) AS total_buying_units,
        (i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid) AS ext_total_buying,
        (i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid) - i.paid_to_supplier AS supplier_remaining
      FROM op_order_items i
      LEFT JOIN op_orders o ON o.id = i.order_id
      LEFT JOIN op_suppliers s ON s.id = i.supplier_id
      WHERE (? = '' OR i.part_number LIKE ? OR i.description LIKE ? OR o.order_number LIKE ? OR s.company LIKE ?)
        AND (? = '' OR i.order_id = ?)
      ORDER BY i.id DESC
    `).all(search, like, like, like, like, order_id||'', order_id||'');
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── CRM → Operations: silent draft order creation ────────────────────────────

// Create a PENDING Operations order from a Closed-Won CRM inquiry. The rep fills the
// sales side (customer, line items, selling). The buying/AP side is left for the buyer/ops.
// Deduped by crm_inquiry_id so re-triggering Closed Won never creates a second order.
router.post('/from-crm', authenticate, (req, res) => {
  try {
    const db = getDB();
    const { customer_name, customer_email, customer_phone, lead_source, rep, ppc_order_rep,
            crm_inquiry_id, buyer, payment_status, net, due_date,
            tax_charged, shipping_charged, cc_charges, notes,
            items, requirements = [] } = req.body;

    // Dedupe: an order already exists for this inquiry → return it instead of duplicating.
    if (crm_inquiry_id) {
      const existing = db.prepare(`SELECT id, order_number FROM op_orders WHERE crm_inquiry_id = ?`).get(crm_inquiry_id);
      if (existing) return res.json({ ok: true, existing: true, order_id: existing.id, order_number: existing.order_number });
    }

    // Find or create op_customer
    let customer = db.prepare(`SELECT id FROM op_customers WHERE LOWER(name)=LOWER(?) OR (email=? AND email != '')`).get(customer_name||'', customer_email||'');
    if (!customer) {
      const r = db.prepare(`INSERT INTO op_customers (name,email,phone) VALUES (?,?,?)`).run(customer_name||'', customer_email||'', customer_phone||'');
      customer = { id: r.lastInsertRowid };
    }

    const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g,'')); return isNaN(n) ? 0 : n; };
    const orderNum = `PENDING-${Date.now().toString().slice(-6)}`;
    const result = db.prepare(`
      INSERT INTO op_orders (order_number, order_date, customer_id, email, lead_source, rep, ppc_order_rep, buyer,
        payment_status, net, due_date, tax_charged, shipping_charged, cc_charges, notes, order_status, pending, crm_inquiry_id)
      VALUES (?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Order placed', 1, ?)
    `).run(orderNum, customer.id, customer_email||'', lead_source||'', rep||'', ppc_order_rep||null, buyer||null,
           payment_status||null, net||null, due_date||null, num(tax_charged), num(shipping_charged), num(cc_charges), notes||null,
           crm_inquiry_id||null);
    const orderId = result.lastInsertRowid;

    // Prefer the rep-entered `items` (with selling); fall back to raw `requirements` (part/qty only).
    const lines = (items && items.length)
      ? items.filter(i => i.part_number?.trim() || num(i.selling) > 0)
      : (requirements||[]).filter(r => r.part_number?.trim()).map(r => ({ part_number: r.part_number, quantity: r.quantity, selling: 0 }));
    const insItem = db.prepare(`INSERT INTO op_order_items (order_id, part_number, description, quantity, product_condition, selling, buying) VALUES (?,?,?,?,?,?,0)`);
    for (const it of lines) {
      insItem.run(orderId, it.part_number||null, it.description||null, num(it.quantity)||1, it.product_condition||null, num(it.selling));
    }

    res.json({ ok: true, order_id: orderId, order_number: orderNum, item_count: lines.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/pending', (req, res) => {
  try {
    const db = getDB();
    const orders = db.prepare(`
      SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
        COUNT(i.id) AS item_count
      FROM op_orders o
      LEFT JOIN op_customers c ON o.customer_id = c.id
      LEFT JOIN op_order_items i ON i.order_id = o.id
      WHERE o.pending = 1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `).all();

    // Attach items to each order
    const withItems = orders.map(order => {
      const items = db.prepare(`
        SELECT i.*, s.company AS supplier_name FROM op_order_items i
        LEFT JOIN op_suppliers s ON s.id = i.supplier_id
        WHERE i.order_id = ?
      `).all(order.id);
      return { ...order, items };
    });

    res.json(withItems);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Buyer / Fulfillment (vendor side — e.g. Kevin) ────────────────────────────
// The buyer fills supplier/buying/PO/tracking on closed-won orders and advances fulfillment.
const FULFILLMENT_STAGES = ['Awaiting PO', 'PO Placed', 'Shipped to Warehouse', 'Received', 'Shipped to Customer', 'Delivered'];

function requireBuyerAccess(req, res, next) {
  if (['buyer', 'manager', 'purchasing_manager'].includes(req.user?.role)) return next();
  return res.status(403).json({ error: 'Not authorized' });
}

function loadBuyerOrder(db, id) {
  const order = db.prepare(`
    SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
    FROM op_orders o LEFT JOIN op_customers c ON o.customer_id = c.id WHERE o.id = ?
  `).get(id);
  if (!order) return null;
  const items = db.prepare(`
    SELECT i.*, s.company AS supplier_name FROM op_order_items i
    LEFT JOIN op_suppliers s ON s.id = i.supplier_id
    WHERE i.order_id = ? ORDER BY i.id
  `).all(id);
  return { ...order, items };
}

// Order lists for the buyer dashboard. scope: todo | transit | delivered | all
router.get('/buyer/orders', requireBuyerAccess, (req, res) => {
  try {
    const db = getDB();
    const { scope } = req.query;
    let cond = '1=1';
    if (scope === 'todo') cond = 'COALESCE(o.vendor_complete,0) = 0';
    else if (scope === 'transit') cond = "COALESCE(o.vendor_complete,0) = 1 AND COALESCE(o.fulfillment_status,'') != 'Delivered'";
    else if (scope === 'delivered') cond = "o.fulfillment_status = 'Delivered'";
    const orders = db.prepare(`
      SELECT o.id, o.order_number, o.order_date, o.rep, o.buyer, o.lead_source, o.order_status,
             o.fulfillment_status, o.vendor_complete, o.tracking_to_customer, o.shipped_via, o.pending,
             c.name AS customer_name,
             COUNT(i.id) AS item_count,
             SUM(CASE WHEN i.supplier_id IS NOT NULL AND i.buying > 0 THEN 1 ELSE 0 END) AS items_filled,
             COALESCE(SUM(i.selling * i.quantity), 0) AS order_amount
      FROM op_orders o
      LEFT JOIN op_customers c ON o.customer_id = c.id
      LEFT JOIN op_order_items i ON i.order_id = o.id
      WHERE ${cond}
      GROUP BY o.id ORDER BY o.created_at DESC
    `).all();
    res.json(orders);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/buyer/stats', requireBuyerAccess, (req, res) => {
  try {
    const db = getDB();
    const todo = db.prepare("SELECT COUNT(*) AS c FROM op_orders WHERE COALESCE(vendor_complete,0)=0").get().c;
    const transit = db.prepare("SELECT COUNT(*) AS c FROM op_orders WHERE COALESCE(vendor_complete,0)=1 AND COALESCE(fulfillment_status,'') != 'Delivered'").get().c;
    const delivered = db.prepare("SELECT COUNT(*) AS c FROM op_orders WHERE fulfillment_status='Delivered'").get().c;
    res.json({ todo, transit, delivered, stages: FULFILLMENT_STAGES });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/buyer/order/:id', requireBuyerAccess, (req, res) => {
  try {
    const order = loadBuyerOrder(getDB(), req.params.id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    res.json(order);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Save the vendor side: per-item buying details + order-level fulfillment/tracking.
router.patch('/buyer/order/:id', requireBuyerAccess, (req, res) => {
  try {
    const db = getDB();
    const id = req.params.id;
    if (!db.prepare('SELECT id FROM op_orders WHERE id=?').get(id)) return res.status(404).json({ error: 'Not found' });
    const { items = [], fulfillment_status, shipped_via, tracking_to_customer, buyer, notes } = req.body;
    const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : n; };
    const upItem = db.prepare(`
      UPDATE op_order_items SET
        supplier_id=?, buying=?, cc_paid=?, tax_paid=?, shipping_paid=?, duty_paid=?,
        payment_method=?, payment_due=?, supplier_terms=?, ta_po_number=?, tracking_to_warehouse=?, serials=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND order_id=?
    `);
    db.transaction(() => {
      for (const it of items) {
        upItem.run(
          it.supplier_id || null, num(it.buying), num(it.cc_paid), num(it.tax_paid), num(it.shipping_paid), num(it.duty_paid),
          it.payment_method || null, it.payment_due || null, it.supplier_terms || null, it.ta_po_number || null,
          it.tracking_to_warehouse || null, it.serials || null, it.id, id
        );
      }
      db.prepare(`UPDATE op_orders SET fulfillment_status=COALESCE(?,fulfillment_status), shipped_via=COALESCE(?,shipped_via),
        tracking_to_customer=COALESCE(?,tracking_to_customer), buyer=COALESCE(?,buyer), notes=COALESCE(?,notes),
        updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(fulfillment_status ?? null, shipped_via ?? null, tracking_to_customer ?? null, buyer ?? null, notes ?? null, id);
    })();
    res.json(loadBuyerOrder(db, id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Toggle the vendor-complete flag (leaves / re-enters the to-do queue).
router.post('/buyer/order/:id/complete', requireBuyerAccess, (req, res) => {
  try {
    const db = getDB();
    const complete = req.body?.complete === false ? 0 : 1;
    db.prepare(`UPDATE op_orders SET vendor_complete=?, vendor_completed_at=?, vendor_completed_by=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(complete, complete ? new Date().toISOString() : null, complete ? req.user.id : null, req.params.id);
    res.json(loadBuyerOrder(db, req.params.id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Stats (for dashboard summary card) ───────────────────────────────────────

router.get('/reporting-periods', (req, res) => {
  try {
    const db = getDB();
    const rows = db.prepare(`
      SELECT reporting_period, COUNT(*) AS order_count
      FROM op_orders
      WHERE reporting_period IS NOT NULL AND (pending IS NULL OR pending = 0)
      GROUP BY reporting_period
      ORDER BY
        CASE SUBSTR(reporting_period,5) WHEN '' THEN '00' ELSE SUBSTR(reporting_period,5) END,
        CASE SUBSTR(reporting_period,1,3)
          WHEN 'Jan' THEN 1 WHEN 'Feb' THEN 2 WHEN 'Mar' THEN 3
          WHEN 'Apr' THEN 4 WHEN 'May' THEN 5 WHEN 'Jun' THEN 6
          WHEN 'Jul' THEN 7 WHEN 'Aug' THEN 8 WHEN 'Sep' THEN 9
          WHEN 'Oct' THEN 10 WHEN 'Nov' THEN 11 WHEN 'Dec' THEN 12
          ELSE 99 END
    `).all();
    const closed = db.prepare(`SELECT period, closed_at FROM op_quarter_closings`).all();
    const closedSet = {};
    for (const c of closed) closedSet[c.period] = c.closed_at;
    res.json(rows.map(r => ({ ...r, closed: !!closedSet[r.reporting_period], closed_at: closedSet[r.reporting_period] || null })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/quarters/close', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { period } = req.body;
    if (!period) return res.status(400).json({ error: 'period required' });
    db.prepare(`INSERT OR REPLACE INTO op_quarter_closings (period, closed_at, closed_by) VALUES (?, CURRENT_TIMESTAMP, ?)`)
      .run(period, req.user?.id || null);
    res.json({ ok: true, period });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/quarters/close/:period', requireManager, (req, res) => {
  try {
    const db = getDB();
    db.prepare(`DELETE FROM op_quarter_closings WHERE period = ?`).run(req.params.period);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Open month (boundary) ──────────────────────────────────────────────────────

// Current open month — the period new CRM orders are auto-tagged to.
router.get('/open-period', (req, res) => {
  try { res.json({ open_period: getOpenPeriod(getDB()) }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// Close the current open month and auto-advance to the next calendar month.
router.post('/months/close', requireManager, (req, res) => {
  try {
    const db = getDB();
    const open = getOpenPeriod(db);
    if (!open) return res.status(400).json({ error: 'No open period configured' });
    const next = nextPeriod(open);
    db.transaction(() => {
      db.prepare(`INSERT OR REPLACE INTO op_quarter_closings (period, closed_at, closed_by) VALUES (?, CURRENT_TIMESTAMP, ?)`)
        .run(open, req.user?.id || null);
      db.prepare(`UPDATE op_settings SET value=? WHERE key='open_period'`).run(next);
    })();
    res.json({ ok: true, closed: open, open_period: next });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Reopen the most-recently-closed month: roll the open period back to it and clear its closed flag.
router.post('/months/reopen', requireManager, (req, res) => {
  try {
    const db = getDB();
    let target = req.body?.period;
    if (!target) target = db.prepare(`SELECT period FROM op_quarter_closings ORDER BY closed_at DESC LIMIT 1`).get()?.period;
    if (!target) return res.status(400).json({ error: 'No closed month to reopen' });
    db.transaction(() => {
      db.prepare(`DELETE FROM op_quarter_closings WHERE period=?`).run(target);
      db.prepare(`UPDATE op_settings SET value=? WHERE key='open_period'`).run(target);
    })();
    res.json({ ok: true, open_period: target });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Move a WHOLE order to the next month (relative to its current period).
router.post('/orders/:id/move-next', requireManager, (req, res) => {
  try {
    const db = getDB();
    const o = db.prepare(`SELECT id, reporting_period FROM op_orders WHERE id=?`).get(req.params.id);
    if (!o) return res.status(404).json({ error: 'Order not found' });
    const cur = o.reporting_period || getOpenPeriod(db);
    const to = nextPeriod(cur);
    db.prepare(`UPDATE op_orders SET reporting_period=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(to, o.id);
    const order = db.prepare(`${ORDER_TOTALS_SQL} WHERE o.id=? GROUP BY o.id`).get(o.id);
    res.json({ ok: true, from: cur, to, order });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Move part of an order to the next month: selected line items (optionally a partial QUANTITY of
// each) split into a new sibling order (same order_number) in the next period.
// Body accepts either:
//   { item_ids: [1,2] }                 → move those whole line items
//   { items: [{ id, quantity }] }       → move `quantity` units of each (partial split)
// Per-unit selling/buying carry to both halves; line-total cost fields (cc/tax/shipping/duty/paid)
// are divided proportionally by quantity so total GP is preserved exactly. Order-level charges
// (tax_charged/shipping_charged/cc_charges) stay with the original order.
router.post('/orders/:id/split-next', requireManager, (req, res) => {
  try {
    const db = getDB();
    let moves = [];
    if (Array.isArray(req.body?.items)) moves = req.body.items.map(x => ({ id: x.id, qty: x.quantity }));
    else if (Array.isArray(req.body?.item_ids)) moves = req.body.item_ids.map(id => ({ id, qty: null }));
    if (!moves.length) return res.status(400).json({ error: 'items or item_ids required' });
    const o = db.prepare(`SELECT * FROM op_orders WHERE id=?`).get(req.params.id);
    if (!o) return res.status(404).json({ error: 'Order not found' });
    const cur = o.reporting_period || getOpenPeriod(db);
    const to = nextPeriod(cur);
    const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
    let newId, movedCount = 0;
    db.transaction(() => {
      const r = db.prepare(`
        INSERT INTO op_orders (order_number,order_date,customer_id,email,lead_source,rep,ppc_order_rep,buyer,
          payment_status,order_status,shipped_via,tracking_to_customer,notes,reporting_period)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(o.order_number, o.order_date, o.customer_id, o.email, o.lead_source, o.rep, o.ppc_order_rep, o.buyer,
             o.payment_status, o.order_status, o.shipped_via, o.tracking_to_customer,
             `${o.notes ? o.notes + ' ' : ''}[split from ${cur}]`, to);
      newId = r.lastInsertRowid;
      for (const m of moves) {
        const it = db.prepare(`SELECT * FROM op_order_items WHERE id=? AND order_id=?`).get(m.id, o.id);
        if (!it) continue;
        const fullQty = Number(it.quantity) || 0;
        let moveQty = (m.qty === null || m.qty === undefined) ? fullQty : Math.min(Number(m.qty) || 0, fullQty);
        if (moveQty <= 0) continue;
        if (moveQty >= fullQty) {
          db.prepare(`UPDATE op_order_items SET order_id=? WHERE id=?`).run(newId, it.id);
        } else {
          // Split: moved portion's line-totals = round(orig * moveQty/fullQty); original keeps the remainder.
          const ratio = moveQty / fullQty;
          const movCC = round2(it.cc_paid * ratio), movTax = round2(it.tax_paid * ratio);
          const movShip = round2(it.shipping_paid * ratio), movDuty = round2(it.duty_paid * ratio);
          const movPaid = round2(it.paid_to_supplier * ratio);
          db.prepare(`
            INSERT INTO op_order_items (order_id,part_number,description,product,supplier_id,quantity,
              product_condition,selling,buying,cc_paid,tax_paid,shipping_paid,duty_paid,paid_to_supplier,
              payment_method,payment_due,tracking_to_warehouse,ta_po_number,serials,ap_status,line_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(newId, it.part_number, it.description, it.product, it.supplier_id, moveQty,
                 it.product_condition, it.selling, it.buying, movCC, movTax, movShip, movDuty, movPaid,
                 it.payment_method, it.payment_due, it.tracking_to_warehouse, it.ta_po_number, it.serials,
                 it.ap_status, it.line_status);
          db.prepare(`
            UPDATE op_order_items SET quantity=?, cc_paid=?, tax_paid=?, shipping_paid=?, duty_paid=?,
              paid_to_supplier=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
          `).run(fullQty - moveQty, round2(it.cc_paid - movCC), round2(it.tax_paid - movTax),
                 round2(it.shipping_paid - movShip), round2(it.duty_paid - movDuty),
                 round2(it.paid_to_supplier - movPaid), it.id);
        }
        movedCount += 1;
      }
      // If nothing actually moved, drop the empty sibling order we created.
      if (movedCount === 0) db.prepare(`DELETE FROM op_orders WHERE id=?`).run(newId);
    })();
    if (movedCount === 0) return res.status(400).json({ error: 'No valid items/quantities to move' });
    const new_order = db.prepare(`${ORDER_TOTALS_SQL} WHERE o.id=? GROUP BY o.id`).get(newId);
    const original = db.prepare(`${ORDER_TOTALS_SQL} WHERE o.id=? GROUP BY o.id`).get(o.id);
    res.json({ ok: true, from: cur, to, new_order, original });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', (req, res) => {
  try {
    const db = getDB();
    const { date_from, date_to, reporting_period } = req.query;
    const { baseConds, p: params } = buildPeriodConds(reporting_period, date_from, date_to);
    const where = baseConds.join(' AND ');
    const stats = db.prepare(`
      WITH ot AS (
        SELECT
          o.id AS order_id,
          o.order_status,
          o.ar_status,
          COALESCE(o.tax_charged,0) + COALESCE(o.shipping_charged,0) + COALESCE(o.cc_charges,0) AS order_charges,
          COALESCE(SUM(i.selling * i.quantity), 0) AS item_rev,
          COALESCE(SUM(i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid), 0) AS item_cost,
          COALESCE(o.rma_amount, 0) AS rma_amount
        FROM op_orders o
        LEFT JOIN op_order_items i ON i.order_id = o.id AND COALESCE(i.line_status,'processed') = 'processed'
        WHERE ${where}
        GROUP BY o.id
      )
      SELECT
        COUNT(*) AS total_orders,
        SUM(CASE WHEN order_status = 'In Process' THEN 1 ELSE 0 END) AS in_process,
        SUM(CASE WHEN order_status = 'Order placed' THEN 1 ELSE 0 END) AS order_placed,
        SUM(item_rev + order_charges) AS total_revenue,
        SUM(item_rev + order_charges - item_cost - rma_amount) AS total_gp,
        (SELECT COUNT(*) FROM op_orders WHERE pending=1) AS pending_orders,
        SUM(CASE WHEN ar_status IN ('pending','partial') THEN item_rev + order_charges ELSE 0 END) AS ar_outstanding,
        SUM(CASE WHEN ar_status = 'partial' THEN item_rev + order_charges ELSE 0 END) AS ar_partial
      FROM ot
    `).get(...params);

    const apStats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN i.ap_status IN ('pending','partial')
          THEN i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid
          ELSE 0 END), 0) AS ap_outstanding,
        COALESCE(SUM(CASE WHEN i.ap_status = 'partial'
          THEN i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid
          ELSE 0 END), 0) AS ap_partial
      FROM op_order_items i
      JOIN op_orders o ON o.id = i.order_id
      WHERE ${where}
    `).get(...params);
    // "Open" = any RMA not finished (not Completed/Denied). Matches the dashboard summary definition.
    const rmaWhere = (reporting_period || date_from || date_to)
      ? `rma_status NOT IN ('Completed','Denied') AND order_id IN (SELECT id FROM op_orders WHERE ${where})`
      : `rma_status NOT IN ('Completed','Denied')`;
    const rma_count = db.prepare(`SELECT COUNT(*) AS cnt FROM op_rma WHERE ${rmaWhere}`).get(...params).cnt;
    res.json({ ...stats, ...apStats, open_rma: rma_count });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// The reporting_period months of the current calendar quarter (e.g. Q2 -> Apr-26/May-26/Jun-26).
function currentQuarterPeriods() {
  const today = businessToday();                 // 'YYYY-MM-DD' in the business timezone
  const year = parseInt(today.slice(0, 4), 10);
  const m0 = parseInt(today.slice(5, 7), 10) - 1; // 0..11
  const qIdx = Math.floor(m0 / 3);                // 0..3
  const startMonth = qIdx * 3;                    // 0,3,6,9
  const yy = String(year).slice(-2);
  return {
    label: `Q${qIdx + 1} ${year}`,
    periods: [0, 1, 2].map(i => `${PERIOD_MONTHS[startMonth + i]}-${yy}`),
  };
}

// Per-rep GP for the running quarter, broken out by month — resets automatically each quarter.
// Each user sees only their own credited GP (o.rep = their name; online orders credit "Online",
// not a person, so they're naturally excluded). Same GP formula as the Operations dashboard byRep.
router.get('/my-gp', (req, res) => {
  try {
    const db = getDB();
    const rep = req.user.name;
    const { label, periods } = currentQuarterPeriods();
    const ph = periods.map(() => '?').join(',');
    const rows = db.prepare(`
      WITH ot AS (
        SELECT
          o.reporting_period AS month,
          COALESCE(o.tax_charged,0) + COALESCE(o.shipping_charged,0) + COALESCE(o.cc_charges,0) AS order_charges,
          COALESCE(SUM(i.selling * i.quantity),0) AS item_rev,
          COALESCE(SUM(i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid),0) AS item_cost,
          COALESCE(o.rma_amount,0) AS rma_amount
        FROM op_orders o
        LEFT JOIN op_order_items i ON i.order_id = o.id AND COALESCE(i.line_status,'processed') = 'processed'
        WHERE o.rep = ? AND (o.pending IS NULL OR o.pending = 0) AND o.reporting_period IN (${ph})
        GROUP BY o.id
      )
      SELECT month, COUNT(*) AS order_count,
        SUM(item_rev + order_charges - item_cost - rma_amount) AS gp
      FROM ot GROUP BY month
    `).all(rep, ...periods);
    const byMonth = Object.fromEntries(rows.map(r => [r.month, r]));
    const months = periods.map(p => ({
      month: p,
      gp: +((byMonth[p]?.gp) || 0).toFixed(2),
      order_count: byMonth[p]?.order_count || 0,
    }));
    const total_gp = +months.reduce((s, m) => s + m.gp, 0).toFixed(2);
    res.json({ quarter: label, rep, months, total_gp });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Receivables (AR) — open customer balances ─────────────────────────────────
// Returns every non-pending order with an outstanding balance (charged > received), excluding
// orders flagged 'na' (stock / FOC / sample). Balance & aging are computed client-side from
// charged / received / due_date.
router.get('/receivables', (req, res) => {
  try {
    const db = getDB();
    const { reporting_period } = req.query;
    const { baseConds, p } = buildPeriodConds(reporting_period, null, null);
    baseConds.push(`(o.ar_status IS NULL OR o.ar_status != 'na')`);
    const rows = db.prepare(`
      SELECT o.id, o.order_number, o.order_date, o.due_date, o.reporting_period, o.payment_status, o.ar_status,
        c.name AS customer_name,
        COALESCE(SUM(i.selling * i.quantity), 0) + COALESCE(o.tax_charged,0) + COALESCE(o.shipping_charged,0) + COALESCE(o.cc_charges,0)
          - COALESCE((SELECT SUM(COALESCE(r.return_quantity,1) * COALESCE(ri.selling,0))
                      FROM op_rma r LEFT JOIN op_order_items ri ON r.order_item_id = ri.id
                      WHERE r.order_id = o.id AND r.rma_status = 'Completed'), 0) AS charged,
        COALESCE(o.customer_paid, 0)
          - COALESCE((SELECT SUM(COALESCE(r.refund_issued,0))
                      FROM op_rma r WHERE r.order_id = o.id AND r.rma_status = 'Completed'), 0) AS received
      FROM op_orders o
      LEFT JOIN op_customers c ON o.customer_id = c.id
      LEFT JOIN op_order_items i ON i.order_id = o.id AND COALESCE(i.line_status,'processed') = 'processed'
      WHERE ${baseConds.join(' AND ')}
      GROUP BY o.id
      HAVING charged - received > 0.005
      ORDER BY COALESCE(o.due_date, o.order_date) ASC, o.id ASC
    `).all(...p);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/payables', (req, res) => {
  try {
    const db = getDB();
    const { reporting_period } = req.query;
    const periodConds = ['(o.pending IS NULL OR o.pending = 0)'];
    const p = [];
    if (reporting_period) {
      const periods = reporting_period.split(',').map(s => s.trim()).filter(Boolean);
      if (periods.length === 1) {
        periodConds.push('o.reporting_period = ?'); p.push(periods[0]);
      } else {
        const ph = periods.map(() => '?').join(',');
        periodConds.push(`o.reporting_period IN (${ph})`); p.push(...periods);
      }
    }
    const where = periodConds.join(' AND ');
    const rows = db.prepare(`
      SELECT
        i.id AS item_id,
        i.order_id,
        o.order_number,
        o.order_date,
        o.reporting_period,
        i.part_number,
        i.description,
        i.quantity,
        i.buying,
        i.cc_paid,
        i.tax_paid,
        i.shipping_paid,
        i.duty_paid,
        COALESCE(i.quantity,0) * COALESCE(i.buying,0) + COALESCE(i.cc_paid,0) + COALESCE(i.tax_paid,0)
          + COALESCE(i.shipping_paid,0) + COALESCE(i.duty_paid,0) AS ext_cost,
        COALESCE(i.paid_to_supplier,0) AS paid,
        COALESCE(i.payment_due, NULL) AS payment_due,
        COALESCE(i.supplier_terms, '') AS supplier_terms,
        i.ap_status,
        COALESCE(i.line_status,'processed') AS line_status,
        s.id AS supplier_id,
        s.company AS supplier_name
      FROM op_order_items i
      JOIN op_orders o ON o.id = i.order_id
      LEFT JOIN op_suppliers s ON s.id = i.supplier_id
      WHERE ${where}
        AND COALESCE(i.line_status,'processed') = 'processed'
        AND (i.ap_status IS NULL OR i.ap_status != 'na')
        AND (COALESCE(i.quantity,0) * COALESCE(i.buying,0) + COALESCE(i.cc_paid,0)
              + COALESCE(i.tax_paid,0) + COALESCE(i.shipping_paid,0) + COALESCE(i.duty_paid,0)
             - COALESCE(i.paid_to_supplier,0)) > 0.005
      ORDER BY COALESCE(i.payment_due, o.order_date) ASC, i.id ASC
    `).all(...p);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

function buildPeriodConds(reporting_period, date_from, date_to) {
  const baseConds = ['(o.pending IS NULL OR o.pending = 0)'];
  const simConds  = ['(pending IS NULL OR pending = 0)'];
  const p = [];
  if (reporting_period) {
    const periods = reporting_period.split(',').map(s => s.trim()).filter(Boolean);
    if (periods.length === 1) {
      baseConds.push('o.reporting_period = ?'); simConds.push('reporting_period = ?'); p.push(periods[0]);
    } else {
      const ph = periods.map(() => '?').join(',');
      baseConds.push(`o.reporting_period IN (${ph})`); simConds.push(`reporting_period IN (${ph})`); p.push(...periods);
    }
  } else {
    if (date_from) { baseConds.push('o.order_date >= ?'); simConds.push('order_date >= ?'); p.push(date_from); }
    if (date_to)   { baseConds.push('o.order_date <= ?'); simConds.push('order_date <= ?'); p.push(date_to); }
  }
  return { baseConds, simConds, p };
}

router.get('/dashboard', (req, res) => {
  try {
    const db = getDB();
    const { date_from, date_to, reporting_period } = req.query;
    const { baseConds, simConds, p } = buildPeriodConds(reporting_period, date_from, date_to);
    const baseWhere = baseConds.join(' AND ');
    const simWhere  = simConds.join(' AND ');

    // Group by reporting_period (the curated month from import row-ranges), NOT order_date.
    // Orders are deliberately moved across calendar months on the sheet, so order_date would
    // mis-bucket them and never match the sheet's monthly totals. reporting_period keeps each
    // bar equal to that month's KPI/period filter total.
    const byMonth = db.prepare(`
      WITH ot AS (
        SELECT
          COALESCE(o.reporting_period, 'Unknown') AS month,
          COALESCE(o.tax_charged,0) + COALESCE(o.shipping_charged,0) + COALESCE(o.cc_charges,0) AS order_charges,
          COALESCE(SUM(i.selling * i.quantity),0) AS item_rev,
          COALESCE(SUM(i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid),0) AS item_cost,
          COALESCE(o.rma_amount,0) AS rma_amount
        FROM op_orders o
        LEFT JOIN op_order_items i ON i.order_id = o.id AND COALESCE(i.line_status,'processed') = 'processed'
        WHERE ${baseWhere}
        GROUP BY o.id
      )
      SELECT month, COUNT(*) AS order_count,
        SUM(item_rev + order_charges) AS revenue,
        SUM(item_rev + order_charges - item_cost - rma_amount) AS gp
      FROM ot GROUP BY month
      ORDER BY
        CASE SUBSTR(month,5) WHEN '' THEN '00' ELSE SUBSTR(month,5) END,
        CASE SUBSTR(month,1,3)
          WHEN 'Jan' THEN 1 WHEN 'Feb' THEN 2 WHEN 'Mar' THEN 3
          WHEN 'Apr' THEN 4 WHEN 'May' THEN 5 WHEN 'Jun' THEN 6
          WHEN 'Jul' THEN 7 WHEN 'Aug' THEN 8 WHEN 'Sep' THEN 9
          WHEN 'Oct' THEN 10 WHEN 'Nov' THEN 11 WHEN 'Dec' THEN 12
          ELSE 99 END
    `).all(...p);

    const byRep = db.prepare(`
      WITH ot AS (
        SELECT
          COALESCE(o.rep,'Unknown') AS rep,
          COALESCE(o.tax_charged,0) + COALESCE(o.shipping_charged,0) + COALESCE(o.cc_charges,0) AS order_charges,
          COALESCE(SUM(i.selling * i.quantity),0) AS item_rev,
          COALESCE(SUM(i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid),0) AS item_cost,
          COALESCE(o.rma_amount,0) AS rma_amount
        FROM op_orders o
        LEFT JOIN op_order_items i ON i.order_id = o.id AND COALESCE(i.line_status,'processed') = 'processed'
        WHERE ${baseWhere}
        GROUP BY o.id
      )
      SELECT rep, COUNT(*) AS order_count,
        SUM(item_rev + order_charges) AS revenue,
        SUM(item_rev + order_charges - item_cost - rma_amount) AS gp
      FROM ot GROUP BY rep ORDER BY gp DESC
    `).all(...p);

    // Revenue + GP by lead source (Marketing metrics) — per-order totals grouped by source.
    const bySource = db.prepare(`
      WITH ot AS (
        SELECT
          COALESCE(NULLIF(TRIM(o.lead_source),''),'Unknown') AS lead_source,
          COALESCE(o.tax_charged,0) + COALESCE(o.shipping_charged,0) + COALESCE(o.cc_charges,0) AS order_charges,
          COALESCE(SUM(i.selling * i.quantity),0) AS item_rev,
          COALESCE(SUM(i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid),0) AS item_cost,
          COALESCE(o.rma_amount,0) AS rma_amount
        FROM op_orders o
        LEFT JOIN op_order_items i ON i.order_id = o.id AND COALESCE(i.line_status,'processed') = 'processed'
        WHERE ${baseWhere}
        GROUP BY o.id
      )
      SELECT lead_source, COUNT(*) AS order_count,
        SUM(item_rev + order_charges) AS revenue,
        SUM(item_rev + order_charges - item_cost - rma_amount) AS gp
      FROM ot GROUP BY lead_source ORDER BY gp DESC
    `).all(...p);

    // Revenue + GP by buyer (purchaser who sourced the goods) — per-order totals grouped by buyer.
    const byBuyer = db.prepare(`
      WITH ot AS (
        SELECT
          COALESCE(NULLIF(TRIM(o.buyer),''),'Unknown') AS buyer,
          COALESCE(o.tax_charged,0) + COALESCE(o.shipping_charged,0) + COALESCE(o.cc_charges,0) AS order_charges,
          COALESCE(SUM(i.selling * i.quantity),0) AS item_rev,
          COALESCE(SUM(i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid),0) AS item_cost,
          COALESCE(o.rma_amount,0) AS rma_amount
        FROM op_orders o
        LEFT JOIN op_order_items i ON i.order_id = o.id AND COALESCE(i.line_status,'processed') = 'processed'
        WHERE ${baseWhere}
        GROUP BY o.id
      )
      SELECT buyer, COUNT(*) AS order_count,
        SUM(item_rev + order_charges) AS revenue,
        SUM(item_rev + order_charges - item_cost - rma_amount) AS gp
      FROM ot GROUP BY buyer ORDER BY gp DESC
    `).all(...p);

    const byStatus = db.prepare(`
      SELECT order_status AS status, COUNT(*) AS count
      FROM op_orders WHERE ${simWhere}
      GROUP BY order_status ORDER BY count DESC
    `).all(...p);

    const byLeadSource = db.prepare(`
      SELECT COALESCE(lead_source,'Unknown') AS lead_source, COUNT(*) AS count,
        COALESCE(SUM(rma_amount),0) AS rma_total
      FROM op_orders WHERE ${simWhere}
      GROUP BY lead_source ORDER BY count DESC
    `).all(...p);

    const topCustomers = db.prepare(`
      WITH ot AS (
        SELECT
          o.customer_id,
          COALESCE(o.tax_charged,0) + COALESCE(o.shipping_charged,0) + COALESCE(o.cc_charges,0) AS order_charges,
          COALESCE(SUM(i.selling * i.quantity),0) AS item_rev,
          COALESCE(SUM(i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid),0) AS item_cost,
          COALESCE(o.rma_amount,0) AS rma_amount
        FROM op_orders o
        LEFT JOIN op_order_items i ON i.order_id = o.id AND COALESCE(i.line_status,'processed') = 'processed'
        WHERE ${baseWhere}
        GROUP BY o.id
      )
      SELECT c.name, COUNT(*) AS order_count,
        SUM(ot.item_rev + ot.order_charges) AS revenue,
        SUM(ot.item_rev + ot.order_charges - ot.item_cost - ot.rma_amount) AS gp
      FROM ot LEFT JOIN op_customers c ON ot.customer_id = c.id
      GROUP BY ot.customer_id ORDER BY revenue DESC LIMIT 10
    `).all(...p);

    const byPayment = db.prepare(`
      SELECT COALESCE(payment_status,'Unpaid') AS payment_status, COUNT(*) AS count
      FROM op_orders WHERE ${simWhere}
      GROUP BY payment_status ORDER BY count DESC
    `).all(...p);

    const kpis = db.prepare(`
      WITH ot AS (
        SELECT
          o.ar_status,
          COALESCE(o.tax_charged,0) + COALESCE(o.shipping_charged,0) + COALESCE(o.cc_charges,0) AS order_charges,
          COALESCE(SUM(i.selling * i.quantity),0) AS item_rev,
          COALESCE(SUM(i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid),0) AS item_cost,
          COALESCE(o.rma_amount,0) AS rma_amount,
          COALESCE(o.customer_paid,0) AS customer_paid
        FROM op_orders o
        LEFT JOIN op_order_items i ON i.order_id = o.id AND COALESCE(i.line_status,'processed') = 'processed'
        WHERE ${baseWhere}
        GROUP BY o.id
      )
      SELECT
        COUNT(*) AS total_orders,
        SUM(item_rev + order_charges) AS total_revenue,
        SUM(item_cost) AS total_cost,
        SUM(item_rev + order_charges - item_cost - rma_amount) AS total_gp,
        SUM(rma_amount) AS total_rma,
        SUM(customer_paid) AS total_collected,
        SUM(item_rev + order_charges - customer_paid) AS total_outstanding,
        SUM(item_rev + order_charges - item_cost - rma_amount) * 100.0
          / NULLIF(SUM(item_rev + order_charges), 0) AS gp_margin_pct,
        (SELECT COUNT(*) FROM op_rma WHERE rma_status NOT IN ('Completed','Denied')) AS open_rmas,
        (SELECT COUNT(*) FROM op_orders WHERE pending=1) AS pending_orders,
        SUM(CASE WHEN ar_status IN ('pending','partial') THEN item_rev + order_charges ELSE 0 END) AS ar_outstanding,
        SUM(CASE WHEN ar_status = 'partial' THEN item_rev + order_charges ELSE 0 END) AS ar_partial
      FROM ot
    `).get(...p);

    const apKpis = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN i.ap_status IN ('pending','partial')
          THEN i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid
          ELSE 0 END), 0) AS ap_outstanding,
        COALESCE(SUM(CASE WHEN i.ap_status = 'partial'
          THEN i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid
          ELSE 0 END), 0) AS ap_partial
      FROM op_order_items i
      JOIN op_orders o ON o.id = i.order_id
      WHERE ${baseWhere}
    `).get(...p);

    res.json({
      kpis: { ...kpis, ...apKpis }, byMonth, byRep, byBuyer, byStatus, topCustomers, byPayment,
      bySource: consolidateSources(bySource, ['order_count', 'revenue', 'gp'], 'gp'),
      byLeadSource: consolidateSources(byLeadSource, ['count', 'rma_total'], 'count'),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Temporary debug endpoint — remove after GP investigation
router.get('/debug-rep-gp', (req, res) => {
  try {
    const db = getDB();
    const { period = 'Q2-26' } = req.query;
    const rows = db.prepare(`
      SELECT o.order_number, o.rep,
        ROUND(COALESCE(SUM(i.selling * i.quantity),0) + COALESCE(o.tax_charged,0) + COALESCE(o.shipping_charged,0)
          - COALESCE(SUM(i.buying*i.quantity+i.cc_paid+i.shipping_paid+i.tax_paid+i.duty_paid),0)
          - COALESCE(o.rma_amount,0), 2) AS gp,
        ROUND(COALESCE(SUM(i.selling * i.quantity),0),2) AS item_rev,
        ROUND(COALESCE(SUM(i.buying*i.quantity+i.cc_paid+i.shipping_paid+i.tax_paid+i.duty_paid),0),2) AS cost
      FROM op_orders o
      LEFT JOIN op_order_items i ON i.order_id = o.id
      WHERE o.reporting_period = ? AND (o.pending IS NULL OR o.pending=0)
      GROUP BY o.id ORDER BY o.rep, o.order_number
    `).all(period);
    const byRep = {};
    for (const r of rows) {
      if (!byRep[r.rep]) byRep[r.rep] = { orders: [], total_gp: 0 };
      byRep[r.rep].orders.push({ order_number: r.order_number, gp: r.gp, rev: r.item_rev, cost: r.cost });
      byRep[r.rep].total_gp = +(byRep[r.rep].total_gp + r.gp).toFixed(2);
    }
    res.json(byRep);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
