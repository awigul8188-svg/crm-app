const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

// Invoices are an Operations document: the buyer (fulfillment) or a manager bills the customer.
const INVOICE_ROLES = ['buyer', 'manager', 'purchasing_manager'];
function requireInvoiceAccess(req, res, next) {
  if (!INVOICE_ROLES.includes(req.user?.role)) return res.status(403).json({ error: 'Not authorized' });
  next();
}

router.use(authenticate, requireInvoiceAccess);

const PREFIX = 'INV-';
const fmt = n => PREFIX + String(n).padStart(5, '0');

// Suggested next auto-sequential number (editable on the client before generating).
router.get('/next-number', (req, res) => {
  try {
    const max = getDB().prepare('SELECT COALESCE(MAX(id),0) AS m FROM invoices').get().m;
    res.json({ invoice_number: fmt(max + 1) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Record a generated invoice (for the number sequence + history).
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { order_id, invoice_number, customer_name, total } = req.body;
    const r = db.prepare(`INSERT INTO invoices (invoice_number, order_id, customer_name, total, created_by) VALUES (?,?,?,?,?)`)
      .run(invoice_number || null, order_id || null, customer_name || null, Number(total) || 0, req.user.id);
    const finalNumber = (invoice_number && String(invoice_number).trim()) || fmt(r.lastInsertRowid);
    if (!invoice_number) db.prepare('UPDATE invoices SET invoice_number=? WHERE id=?').run(finalNumber, r.lastInsertRowid);
    res.json({ id: r.lastInsertRowid, invoice_number: finalNumber });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
