const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { authenticate, requireManager } = require('../middleware/auth');

router.use(authenticate);

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
  LEFT JOIN op_order_items i ON i.order_id = o.id
`;

// ── Orders ────────────────────────────────────────────────────────────────────

router.get('/orders', (req, res) => {
  try {
    const db = getDB();
    const { search, status, rep } = req.query;
    let where = [];
    let params = [];

    if (search) {
      where.push(`(o.order_number LIKE ? OR c.name LIKE ? OR o.email LIKE ?)`);
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (status) { where.push(`o.order_status = ?`); params.push(status); }
    if (rep)    { where.push(`o.rep LIKE ?`);        params.push(`%${rep}%`); }

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
            cc_charges, customer_paid, rma_amount, shipped_via, tracking_to_customer, notes } = req.body;
    const result = db.prepare(`
      INSERT INTO op_orders (order_number,order_date,customer_id,email,lead_source,rep,ppc_order_rep,buyer,
        payment_status,order_status,net,due_date,tax_charged,shipping_charged,cc_charges,customer_paid,
        rma_amount,shipped_via,tracking_to_customer,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(order_number, order_date||null, customer_id||null, email||null,
           lead_source||null, rep||null, ppc_order_rep||null, buyer||null,
           payment_status||null, order_status||'Order placed', net||0, due_date||null,
           tax_charged||0, shipping_charged||0, cc_charges||0, customer_paid||0,
           rma_amount||0, shipped_via||null, tracking_to_customer||null, notes||null);
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
    const rmas = db.prepare(`SELECT * FROM op_rma WHERE order_id = ? ORDER BY id DESC`).all(req.params.id);
    res.json({ ...order, items, rmas });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/orders/:id', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { order_number, order_date, customer_id, email, lead_source, rep, ppc_order_rep, buyer,
            payment_status, order_status, net, due_date, tax_charged, shipping_charged,
            cc_charges, customer_paid, rma_amount, shipped_via, tracking_to_customer, notes } = req.body;
    db.prepare(`
      UPDATE op_orders SET order_number=?,order_date=?,customer_id=?,email=?,lead_source=?,rep=?,
        ppc_order_rep=?,buyer=?,payment_status=?,order_status=?,net=?,due_date=?,tax_charged=?,
        shipping_charged=?,cc_charges=?,customer_paid=?,rma_amount=?,shipped_via=?,
        tracking_to_customer=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(order_number, order_date||null, customer_id||null, email||null,
           lead_source||null, rep||null, ppc_order_rep||null, buyer||null,
           payment_status||null, order_status||'Order placed', net||0, due_date||null,
           tax_charged||0, shipping_charged||0, cc_charges||0, customer_paid||0,
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
            selling, buying, cc_paid, tax_paid, shipping_paid, duty_paid, paid_to_supplier,
            payment_method, payment_due, tracking_to_warehouse, ta_po_number, serials } = req.body;
    const result = db.prepare(`
      INSERT INTO op_order_items (order_id,part_number,description,product,supplier_id,quantity,
        product_condition,selling,buying,cc_paid,tax_paid,shipping_paid,duty_paid,paid_to_supplier,
        payment_method,payment_due,tracking_to_warehouse,ta_po_number,serials)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(req.params.id, part_number||null, description||null, product||null, supplier_id||null,
           quantity||1, product_condition||null, selling||0, buying||0, cc_paid||0,
           tax_paid||0, shipping_paid||0, duty_paid||0, paid_to_supplier||0,
           payment_method||null, payment_due||null, tracking_to_warehouse||null,
           ta_po_number||null, serials||null);
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
            selling, buying, cc_paid, tax_paid, shipping_paid, duty_paid, paid_to_supplier,
            payment_method, payment_due, tracking_to_warehouse, ta_po_number, serials } = req.body;
    db.prepare(`
      UPDATE op_order_items SET part_number=?,description=?,product=?,supplier_id=?,quantity=?,
        product_condition=?,selling=?,buying=?,cc_paid=?,tax_paid=?,shipping_paid=?,duty_paid=?,
        paid_to_supplier=?,payment_method=?,payment_due=?,tracking_to_warehouse=?,ta_po_number=?,
        serials=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(part_number||null, description||null, product||null, supplier_id||null,
           quantity||1, product_condition||null, selling||0, buying||0, cc_paid||0,
           tax_paid||0, shipping_paid||0, duty_paid||0, paid_to_supplier||0,
           payment_method||null, payment_due||null, tracking_to_warehouse||null,
           ta_po_number||null, serials||null, req.params.id);
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

router.post('/suppliers', requireManager, (req, res) => {
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

router.get('/rma', (req, res) => {
  try {
    const db = getDB();
    const { search, status } = req.query;
    let where = [];
    let params = [];
    if (search) { where.push(`(r.rma_number LIKE ? OR c.name LIKE ? OR o.order_number LIKE ?)`); const s = `%${search}%`; params.push(s, s, s); }
    if (status) { where.push(`r.rma_status = ?`); params.push(status); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rmas = db.prepare(`
      SELECT r.*, c.name AS customer_name, o.order_number
      FROM op_rma r
      LEFT JOIN op_customers c ON r.customer_id = c.id
      LEFT JOIN op_orders o ON r.order_id = o.id
      ${whereClause}
      ORDER BY r.created_at DESC
    `).all(...params);
    res.json(rmas);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/rma', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { rma_number, order_id, customer_id, email, return_quantity, return_reason,
            rma_status, rma_issue_date, rma_completed_date, refund_issued, restocking_fee,
            return_tracking_number, return_shipping_paid, notes, qb_credit_memo } = req.body;
    const result = db.prepare(`
      INSERT INTO op_rma (rma_number,order_id,customer_id,email,return_quantity,return_reason,
        rma_status,rma_issue_date,rma_completed_date,refund_issued,restocking_fee,
        return_tracking_number,return_shipping_paid,notes,qb_credit_memo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(rma_number, order_id||null, customer_id||null, email||null, return_quantity||1,
           return_reason||null, rma_status||'Open', rma_issue_date||null, rma_completed_date||null,
           refund_issued||0, restocking_fee||0, return_tracking_number||null,
           return_shipping_paid||0, notes||null, qb_credit_memo||null);
    res.json(db.prepare(`SELECT r.*, c.name AS customer_name, o.order_number FROM op_rma r LEFT JOIN op_customers c ON r.customer_id=c.id LEFT JOIN op_orders o ON r.order_id=o.id WHERE r.id=?`).get(result.lastInsertRowid));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/rma/:id', (req, res) => {
  try {
    const db = getDB();
    const rma = db.prepare(`SELECT r.*, c.name AS customer_name, o.order_number FROM op_rma r LEFT JOIN op_customers c ON r.customer_id=c.id LEFT JOIN op_orders o ON r.order_id=o.id WHERE r.id=?`).get(req.params.id);
    if (!rma) return res.status(404).json({ error: 'RMA not found' });
    res.json(rma);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/rma/:id', requireManager, (req, res) => {
  try {
    const db = getDB();
    const { rma_number, order_id, customer_id, email, return_quantity, return_reason,
            rma_status, rma_issue_date, rma_completed_date, refund_issued, restocking_fee,
            return_tracking_number, return_shipping_paid, notes, qb_credit_memo } = req.body;
    db.prepare(`
      UPDATE op_rma SET rma_number=?,order_id=?,customer_id=?,email=?,return_quantity=?,
        return_reason=?,rma_status=?,rma_issue_date=?,rma_completed_date=?,refund_issued=?,
        restocking_fee=?,return_tracking_number=?,return_shipping_paid=?,notes=?,
        qb_credit_memo=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(rma_number, order_id||null, customer_id||null, email||null, return_quantity||1,
           return_reason||null, rma_status||'Open', rma_issue_date||null, rma_completed_date||null,
           refund_issued||0, restocking_fee||0, return_tracking_number||null,
           return_shipping_paid||0, notes||null, qb_credit_memo||null, req.params.id);
    res.json(db.prepare(`SELECT r.*, c.name AS customer_name, o.order_number FROM op_rma r LEFT JOIN op_customers c ON r.customer_id=c.id LEFT JOIN op_orders o ON r.order_id=o.id WHERE r.id=?`).get(req.params.id));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/rma/:id', requireManager, (req, res) => {
  try {
    getDB().prepare(`DELETE FROM op_rma WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Stats (for dashboard summary card) ───────────────────────────────────────

router.get('/stats', (req, res) => {
  try {
    const db = getDB();
    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT o.id) AS total_orders,
        SUM(CASE WHEN o.order_status = 'In Process' THEN 1 ELSE 0 END) AS in_process,
        SUM(CASE WHEN o.order_status = 'Order placed' THEN 1 ELSE 0 END) AS order_placed,
        COALESCE(SUM(i.selling * i.quantity), 0) + COALESCE(SUM(o.tax_charged + o.shipping_charged + o.cc_charges), 0) AS total_revenue,
        COALESCE(SUM(i.selling * i.quantity), 0) + COALESCE(SUM(o.tax_charged + o.shipping_charged + o.cc_charges), 0)
          - COALESCE(SUM(i.buying * i.quantity + i.cc_paid + i.shipping_paid + i.tax_paid + i.duty_paid), 0)
          - COALESCE(SUM(o.rma_amount), 0) AS total_gp
      FROM op_orders o
      LEFT JOIN op_order_items i ON i.order_id = o.id
    `).get();
    const rma_count = db.prepare(`SELECT COUNT(*) AS cnt FROM op_rma WHERE rma_status = 'Open'`).get().cnt;
    res.json({ ...stats, open_rma: rma_count });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
