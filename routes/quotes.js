const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { authenticate, requireCrmAccess } = require('../middleware/auth');

router.use(authenticate, requireCrmAccess);

const PREFIX = 'TA-Q-';
const fmt = n => PREFIX + String(n).padStart(5, '0');

// Suggested next auto-sequential number (editable on the client before generating).
router.get('/next-number', (req, res) => {
  try {
    const max = getDB().prepare('SELECT COALESCE(MAX(id),0) AS m FROM quotes').get().m;
    res.json({ quote_number: fmt(max + 1) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Record a generated quote (for the number sequence + inquiry activity history).
router.post('/', (req, res) => {
  try {
    const db = getDB();
    const { inquiry_id, quote_number, customer_name, customer_company, total } = req.body;
    const r = db.prepare(`INSERT INTO quotes (quote_number, inquiry_id, customer_name, customer_company, total, created_by) VALUES (?,?,?,?,?,?)`)
      .run(quote_number || null, inquiry_id || null, customer_name || null, customer_company || null, Number(total) || 0, req.user.id);
    const finalNumber = (quote_number && String(quote_number).trim()) || fmt(r.lastInsertRowid);
    if (!quote_number) db.prepare('UPDATE quotes SET quote_number=? WHERE id=?').run(finalNumber, r.lastInsertRowid);
    // Log it on the inquiry's activity feed (same shape as routes/inquiries.js logActivity).
    if (inquiry_id) {
      try {
        db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, user_name, action, comment) VALUES (?,?,?,?,?,?)')
          .run('inquiry', inquiry_id, req.user.id, req.user.name, 'Quote generated',
               `${finalNumber} — ${customer_company || customer_name || ''} — $${(Number(total) || 0).toFixed(2)}`);
      } catch (e) { /* activity logging is best-effort */ }
    }
    res.json({ id: r.lastInsertRowid, quote_number: finalNumber });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
