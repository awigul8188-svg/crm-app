const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const isPurchasingManager = (req, res, next) => {
  if (req.user.role === 'purchasing_manager' || req.user.role === 'manager') return next();
  res.status(403).json({ error: 'Purchasing managers only' });
};
const isPurchaser = (req, res, next) => {
  if (['purchaser','purchasing_manager','manager'].includes(req.user.role)) return next();
  res.status(403).json({ error: 'Access denied' });
};

// Get all part numbers with assignment status (purchasing manager)
router.get('/parts', isPurchasingManager, (req, res) => {
  const db = getDB();
  const { status, purchaser_id, type } = req.query;
  let where = '1=1';
  const params = [];
  if (status === 'unassigned') where += ' AND pa.id IS NULL';
  else if (status === 'assigned') where += ' AND pa.id IS NOT NULL AND pa.status = ?', params.push('pending');
  else if (status === 'quoted') where += ' AND pa.status = ?', params.push('quoted');
  if (purchaser_id) { where += ' AND pa.purchaser_id = ?'; params.push(purchaser_id); }
  if (type) { where += ' AND i.type = ?'; params.push(type); }

  const parts = db.prepare(`
    SELECT
      r.id as requirement_id, r.part_number, r.quantity,
      i.id as inquiry_id, i.type as inquiry_type, i.order_amount as selling_price, i.notes as inquiry_notes,
      c.name as customer_name, c.company as customer_company,
      ae.name as ae_name, ae.id as ae_id,
      pa.id as assignment_id, pa.status as assignment_status, pa.assigned_at,
      pu.name as purchaser_name, pu.id as purchaser_id,
      pq.id as quote_id, pq.price, pq.condition, pq.lead_time, pq.supplier_name, pq.notes as quote_notes, pq.updated_at as quoted_at
    FROM requirements r
    JOIN inquiries i ON r.inquiry_id = i.id
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN users ae ON i.assigned_to = ae.id
    LEFT JOIN purchase_assignments pa ON pa.requirement_id = r.id
    LEFT JOIN users pu ON pa.purchaser_id = pu.id
    LEFT JOIN purchase_quotes pq ON pq.assignment_id = pa.id
    WHERE ${where}
    ORDER BY r.id DESC
  `).all(...params);

  res.json(parts);
});

// Assign a requirement to a purchaser
router.post('/assign', isPurchasingManager, (req, res) => {
  const { requirement_id, purchaser_id } = req.body;
  if (!requirement_id || !purchaser_id) return res.status(400).json({ error: 'requirement_id and purchaser_id required' });
  const db = getDB();
  try {
    db.prepare(`
      INSERT INTO purchase_assignments (requirement_id, purchaser_id, assigned_by, status)
      VALUES (?, ?, ?, 'pending')
      ON CONFLICT(requirement_id) DO UPDATE SET purchaser_id=excluded.purchaser_id, assigned_by=excluded.assigned_by, status='pending', assigned_at=CURRENT_TIMESTAMP
    `).run(requirement_id, purchaser_id, req.user.id);
    res.json({ success: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// Unassign a requirement
router.delete('/assign/:requirementId', isPurchasingManager, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM purchase_assignments WHERE requirement_id = ?').run(req.params.requirementId);
  res.json({ success: true });
});

// Get my assigned parts (purchaser)
router.get('/my-parts', (req, res) => {
  const db = getDB();
  const parts = db.prepare(`
    SELECT
      r.id as requirement_id, r.part_number, r.quantity,
      i.id as inquiry_id, i.type as inquiry_type, i.order_amount as selling_price, i.notes as inquiry_notes,
      c.name as customer_name, c.company as customer_company,
      ae.name as ae_name,
      pa.id as assignment_id, pa.status as assignment_status, pa.assigned_at,
      pq.id as quote_id, pq.price, pq.condition, pq.lead_time, pq.supplier_name, pq.notes as quote_notes, pq.updated_at as quoted_at
    FROM purchase_assignments pa
    JOIN requirements r ON pa.requirement_id = r.id
    JOIN inquiries i ON r.inquiry_id = i.id
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN users ae ON i.assigned_to = ae.id
    LEFT JOIN purchase_quotes pq ON pq.assignment_id = pa.id
    WHERE pa.purchaser_id = ?
    ORDER BY pa.assigned_at DESC
  `).all(req.user.id);
  res.json(parts);
});

// Submit or update a quote
router.post('/quote', (req, res) => {
  const { assignment_id, price, condition, lead_time, supplier_name, notes } = req.body;
  if (!assignment_id) return res.status(400).json({ error: 'assignment_id required' });
  const db = getDB();

  const assignment = db.prepare(`
    SELECT pa.*, r.part_number, r.quantity, i.assigned_to as ae_id, i.type as inquiry_type, c.name as customer_name
    FROM purchase_assignments pa
    JOIN requirements r ON pa.requirement_id = r.id
    JOIN inquiries i ON r.inquiry_id = i.id
    JOIN customers c ON i.customer_id = c.id
    WHERE pa.id = ?
  `).get(assignment_id);

  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  // Upsert quote
  const existing = db.prepare('SELECT id FROM purchase_quotes WHERE assignment_id = ?').get(assignment_id);
  if (existing) {
    db.prepare('UPDATE purchase_quotes SET price=?, condition=?, lead_time=?, supplier_name=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE assignment_id=?')
      .run(price, condition, lead_time, supplier_name, notes, assignment_id);
  } else {
    db.prepare('INSERT INTO purchase_quotes (assignment_id, requirement_id, purchaser_id, price, condition, lead_time, supplier_name, notes) VALUES (?,?,?,?,?,?,?,?)')
      .run(assignment_id, assignment.requirement_id, req.user.id, price, condition, lead_time, supplier_name, notes);
  }

  // Update assignment status
  db.prepare("UPDATE purchase_assignments SET status = 'quoted' WHERE id = ?").run(assignment_id);

  // Notify AE + all managers + purchasing managers
  const notifyUsers = db.prepare("SELECT id FROM users WHERE role IN ('manager','purchasing_manager') OR id = ?").all(assignment.ae_id);
  const insertNotif = db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment) VALUES (?,?,?,?,?,?,?)");
  const message = `Quoted ${assignment.part_number} — ${condition ? condition + ', ' : ''}$${price}${lead_time ? ', lead time: ' + lead_time : ''}`;
  notifyUsers.forEach(u => {
    insertNotif.run(u.id, null, 'quote', assignment.customer_name, req.user.name, 'Quote submitted', message);
  });

  res.json({ success: true });
});

// Get all quotes (for managers/purchasing managers)
router.get('/quotes', isPurchasingManager, (req, res) => {
  const db = getDB();
  const quotes = db.prepare(`
    SELECT pq.*, r.part_number, r.quantity, pu.name as purchaser_name,
      c.name as customer_name, i.type as inquiry_type, ae.name as ae_name
    FROM purchase_quotes pq
    JOIN purchase_assignments pa ON pq.assignment_id = pa.id
    JOIN requirements r ON pq.requirement_id = r.id
    JOIN inquiries i ON r.inquiry_id = i.id
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN users ae ON i.assigned_to = ae.id
    LEFT JOIN users pu ON pq.purchaser_id = pu.id
    ORDER BY pq.updated_at DESC
  `).all();
  res.json(quotes);
});

// Purchaser dashboard stats
router.get('/stats', (req, res) => {
  const db = getDB();
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const totalAssigned = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=?").get(userId).c;
  const pending = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='pending'").get(userId).c;
  const quoted = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='quoted'").get(userId).c;
  const quotedToday = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND date(updated_at)=?").get(userId, today).c;

  // Purchasing manager stats
  let managerStats = null;
  if (req.user.role === 'purchasing_manager' || req.user.role === 'manager') {
    const totalParts = db.prepare("SELECT COUNT(*) as c FROM requirements").get().c;
    const totalUnassigned = db.prepare("SELECT COUNT(*) as c FROM requirements r LEFT JOIN purchase_assignments pa ON pa.requirement_id=r.id WHERE pa.id IS NULL").get().c;
    const totalPending = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE status='pending'").get().c;
    const totalQuoted = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE status='quoted'").get().c;
    const byPurchaser = db.prepare("SELECT u.name, COUNT(*) as assigned, SUM(CASE WHEN pa.status='quoted' THEN 1 ELSE 0 END) as quoted_count FROM purchase_assignments pa JOIN users u ON pa.purchaser_id=u.id GROUP BY pa.purchaser_id ORDER BY assigned DESC").all();
    managerStats = { totalParts, totalUnassigned, totalPending, totalQuoted, byPurchaser };
  }

  res.json({ totalAssigned, pending, quoted, quotedToday, managerStats });
});

// Get all purchasers (for assignment dropdown)
router.get('/purchasers', isPurchasingManager, (req, res) => {
  const db = getDB();
  res.json(db.prepare("SELECT id, name, username FROM users WHERE role='purchaser' ORDER BY name").all());
});

module.exports = router;
