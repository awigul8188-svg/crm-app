const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const canManage = (req, res, next) => {
  if (['purchasing_manager','manager'].includes(req.user.role)) return next();
  return res.status(403).json({ error: 'Purchasing managers only' });
};

const PAGE_SIZE = 30;
const offset = (page) => (parseInt(page || 1) - 1) * PAGE_SIZE;

// ── Parts list (paginated, filterable by type/status) ──────────
router.get('/parts', canManage, (req, res) => {
  const db = getDB();
  const { type, status, purchaser_id, page = 1 } = req.query;
  let where = '1=1';
  const params = [];

  if (type) { where += ' AND i.type = ?'; params.push(type); }
  if (status === 'unassigned') where += ' AND pa.id IS NULL';
  else if (status === 'pending') { where += ' AND pa.id IS NOT NULL AND pa.status = ?'; params.push('pending'); }
  else if (status === 'quoted') { where += ' AND pa.status = ?'; params.push('quoted'); }
  if (purchaser_id) { where += ' AND pa.purchaser_id = ?'; params.push(purchaser_id); }

  const countRow = db.prepare(`SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id = i.id LEFT JOIN purchase_assignments pa ON pa.requirement_id = r.id WHERE ${where}`).get(...params);
  const total = countRow.c;

  const parts = db.prepare(`
    SELECT r.id as requirement_id, r.part_number, r.quantity,
      i.id as inquiry_id, i.type as inquiry_type, i.order_amount as selling_price, i.notes as inquiry_notes,
      i.created_at as inquiry_date,
      c.name as customer_name, c.company as customer_company,
      ae.id as ae_id, ae.name as ae_name,
      pa.id as assignment_id, pa.status as assignment_status, pa.assigned_at,
      pu.id as purchaser_id, pu.name as purchaser_name,
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
    LIMIT ${PAGE_SIZE} OFFSET ${offset(page)}
  `).all(...params);

  res.json({ parts, total, pages: Math.ceil(total / PAGE_SIZE), page: parseInt(page) });
});

// ── Parts for a specific inquiry (for assign modal) ────────────
router.get('/inquiry-parts/:inquiryId', canManage, (req, res) => {
  const db = getDB();
  const parts = db.prepare(`
    SELECT r.id as requirement_id, r.part_number, r.quantity,
      i.id as inquiry_id, i.type as inquiry_type, i.order_amount as selling_price,
      c.name as customer_name, c.company, ae.name as ae_name,
      pa.id as assignment_id, pa.status as assignment_status,
      pu.id as purchaser_id, pu.name as purchaser_name,
      pq.price, pq.condition, pq.lead_time, pq.supplier_name, pq.updated_at as quoted_at
    FROM requirements r
    JOIN inquiries i ON r.inquiry_id = i.id
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN users ae ON i.assigned_to = ae.id
    LEFT JOIN purchase_assignments pa ON pa.requirement_id = r.id
    LEFT JOIN users pu ON pa.purchaser_id = pu.id
    LEFT JOIN purchase_quotes pq ON pq.assignment_id = pa.id
    WHERE r.inquiry_id = ?
    ORDER BY r.id
  `).all(req.params.inquiryId);

  const inquiry = db.prepare('SELECT i.*, c.name as customer_name, c.company, ae.name as ae_name FROM inquiries i JOIN customers c ON i.customer_id=c.id LEFT JOIN users ae ON i.assigned_to=ae.id WHERE i.id=?').get(req.params.inquiryId);
  res.json({ inquiry, parts });
});

// ── Assign / reassign a requirement ───────────────────────────
router.post('/assign', canManage, (req, res) => {
  const { requirement_id, purchaser_id } = req.body;
  if (!requirement_id || !purchaser_id) return res.status(400).json({ error: 'requirement_id and purchaser_id required' });
  const db = getDB();
  db.prepare(`
    INSERT INTO purchase_assignments (requirement_id, purchaser_id, assigned_by, status)
    VALUES (?, ?, ?, 'pending')
    ON CONFLICT(requirement_id) DO UPDATE SET purchaser_id=excluded.purchaser_id, assigned_by=excluded.assigned_by, status='pending', assigned_at=CURRENT_TIMESTAMP
  `).run(requirement_id, purchaser_id, req.user.id);
  res.json({ success: true });
});

// ── Bulk assign (all parts of an inquiry at once) ─────────────
router.post('/assign-bulk', canManage, (req, res) => {
  const { assignments } = req.body; // [{requirement_id, purchaser_id}]
  if (!assignments?.length) return res.status(400).json({ error: 'assignments array required' });
  const db = getDB();
  const stmt = db.prepare(`
    INSERT INTO purchase_assignments (requirement_id, purchaser_id, assigned_by, status)
    VALUES (?, ?, ?, 'pending')
    ON CONFLICT(requirement_id) DO UPDATE SET purchaser_id=excluded.purchaser_id, assigned_by=excluded.assigned_by, status='pending', assigned_at=CURRENT_TIMESTAMP
  `);
  const tx = db.transaction(() => assignments.forEach(a => { if (a.purchaser_id) stmt.run(a.requirement_id, a.purchaser_id, req.user.id); }));
  tx();
  res.json({ success: true });
});

// ── Unassign ──────────────────────────────────────────────────
router.delete('/assign/:requirementId', canManage, (req, res) => {
  getDB().prepare('DELETE FROM purchase_assignments WHERE requirement_id = ?').run(req.params.requirementId);
  res.json({ success: true });
});

// ── My assigned parts (purchaser, paginated) ──────────────────
router.get('/my-parts', (req, res) => {
  const db = getDB();
  const { type, status, page = 1 } = req.query;
  let where = 'pa.purchaser_id = ?';
  const params = [req.user.id];
  if (type) { where += ' AND i.type = ?'; params.push(type); }
  if (status) { where += ' AND pa.status = ?'; params.push(status); }

  const total = db.prepare(`SELECT COUNT(*) as c FROM purchase_assignments pa JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id WHERE ${where}`).get(...params).c;

  const parts = db.prepare(`
    SELECT r.id as requirement_id, r.part_number, r.quantity,
      i.id as inquiry_id, i.type as inquiry_type, i.order_amount as selling_price, i.notes as inquiry_notes, i.created_at as inquiry_date,
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
    WHERE ${where}
    ORDER BY pa.assigned_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset(page)}
  `).all(...params);

  res.json({ parts, total, pages: Math.ceil(total / PAGE_SIZE), page: parseInt(page) });
});

// ── Submit / update a quote ───────────────────────────────────
router.post('/quote', (req, res) => {
  const { assignment_id, price, condition, lead_time, supplier_name, notes } = req.body;
  if (!assignment_id) return res.status(400).json({ error: 'assignment_id required' });
  const db = getDB();

  const assignment = db.prepare(`
    SELECT pa.*, r.part_number, i.assigned_to as ae_id, i.type as inquiry_type, c.name as customer_name
    FROM purchase_assignments pa
    JOIN requirements r ON pa.requirement_id = r.id
    JOIN inquiries i ON r.inquiry_id = i.id
    JOIN customers c ON i.customer_id = c.id
    WHERE pa.id = ?
  `).get(assignment_id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  const existing = db.prepare('SELECT id FROM purchase_quotes WHERE assignment_id = ?').get(assignment_id);
  if (existing) {
    db.prepare('UPDATE purchase_quotes SET price=?,condition=?,lead_time=?,supplier_name=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE assignment_id=?')
      .run(price, condition, lead_time, supplier_name, notes, assignment_id);
  } else {
    db.prepare('INSERT INTO purchase_quotes (assignment_id,requirement_id,purchaser_id,price,condition,lead_time,supplier_name,notes) VALUES (?,?,?,?,?,?,?,?)')
      .run(assignment_id, assignment.requirement_id, req.user.id, price, condition, lead_time, supplier_name, notes);
  }
  db.prepare("UPDATE purchase_assignments SET status='quoted' WHERE id=?").run(assignment_id);

  // Notify AE + managers + purchasing managers
  const msg = `${assignment.part_number} — ${condition ? condition+', ' : ''}$${price}${lead_time ? ', '+lead_time : ''}`;
  const notifyUsers = db.prepare("SELECT id FROM users WHERE role IN ('manager','purchasing_manager') OR id=?").all(assignment.ae_id);
  const ins = db.prepare("INSERT INTO notifications (user_id,inquiry_id,inquiry_type,customer_name,actor_name,action,comment) VALUES (?,?,?,?,?,?,?)");
  notifyUsers.forEach(u => ins.run(u.id, null, 'quote', assignment.customer_name, req.user.name, 'Quote submitted', msg));

  res.json({ success: true });
});

// ── All quotes (manager view, paginated) ──────────────────────
router.get('/quotes', canManage, (req, res) => {
  const db = getDB();
  const { page = 1, type } = req.query;
  let where = '1=1';
  const params = [];
  if (type) { where += ' AND i.type=?'; params.push(type); }

  const total = db.prepare(`SELECT COUNT(*) as c FROM purchase_quotes pq JOIN requirements r ON pq.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id WHERE ${where}`).get(...params).c;
  const quotes = db.prepare(`
    SELECT pq.*, r.part_number, r.quantity, pu.name as purchaser_name,
      c.name as customer_name, c.company as customer_company,
      i.type as inquiry_type, ae.name as ae_name, i.order_amount as selling_price
    FROM purchase_quotes pq
    JOIN purchase_assignments pa ON pq.assignment_id=pa.id
    JOIN requirements r ON pq.requirement_id=r.id
    JOIN inquiries i ON r.inquiry_id=i.id
    JOIN customers c ON i.customer_id=c.id
    LEFT JOIN users ae ON i.assigned_to=ae.id
    LEFT JOIN users pu ON pq.purchaser_id=pu.id
    WHERE ${where}
    ORDER BY pq.updated_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset(page)}
  `).all(...params);
  res.json({ quotes, total, pages: Math.ceil(total / PAGE_SIZE), page: parseInt(page) });
});

// ── Dashboard stats ───────────────────────────────────────────
router.get('/stats', (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user.id;
  const isPM = ['purchasing_manager','manager'].includes(req.user.role);

  if (isPM) {
    const totalParts    = db.prepare("SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id WHERE r.part_number != ''").get().c;
    const unassigned    = db.prepare("SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id LEFT JOIN purchase_assignments pa ON pa.requirement_id=r.id WHERE pa.id IS NULL AND r.part_number != ''").get().c;
    const pending       = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE status='pending'").get().c;
    const quoted        = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE status='quoted'").get().c;
    const quotedToday   = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE date(updated_at)=?").get(today).c;
    const newToday      = db.prepare("SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id WHERE date(i.created_at)=? AND r.part_number!=''").get(today).c;

    const byType = db.prepare(`
      SELECT i.type, COUNT(*) as total,
        SUM(CASE WHEN pa.id IS NULL THEN 1 ELSE 0 END) as unassigned,
        SUM(CASE WHEN pa.status='pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN pa.status='quoted' THEN 1 ELSE 0 END) as quoted
      FROM requirements r
      JOIN inquiries i ON r.inquiry_id=i.id
      LEFT JOIN purchase_assignments pa ON pa.requirement_id=r.id
      WHERE r.part_number != ''
      GROUP BY i.type
    `).all();

    const byPurchaser = db.prepare(`
      SELECT u.id, u.name,
        COUNT(*) as assigned,
        SUM(CASE WHEN pa.status='quoted' THEN 1 ELSE 0 END) as quoted_count,
        SUM(CASE WHEN pa.status='pending' THEN 1 ELSE 0 END) as pending_count
      FROM purchase_assignments pa
      JOIN users u ON pa.purchaser_id=u.id
      GROUP BY pa.purchaser_id ORDER BY assigned DESC
    `).all();

    const recentQuotes = db.prepare(`
      SELECT pq.price, pq.condition, pq.updated_at, r.part_number, pu.name as purchaser_name, c.name as customer_name, i.type as inquiry_type
      FROM purchase_quotes pq
      JOIN requirements r ON pq.requirement_id=r.id
      JOIN inquiries i ON r.inquiry_id=i.id
      JOIN customers c ON i.customer_id=c.id
      LEFT JOIN users pu ON pq.purchaser_id=pu.id
      ORDER BY pq.updated_at DESC LIMIT 8
    `).all();

    res.json({ isPM: true, totalParts, unassigned, pending, quoted, quotedToday, newToday, byType, byPurchaser, recentQuotes });
  } else {
    const myAssigned   = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=?").get(userId).c;
    const myPending    = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='pending'").get(userId).c;
    const myQuoted     = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='quoted'").get(userId).c;
    const myToday      = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND date(updated_at)=?").get(userId, today).c;
    const myThisWeek   = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND updated_at >= datetime('now','-7 days')").get(userId).c;

    const byType = db.prepare(`
      SELECT i.type, COUNT(*) as total,
        SUM(CASE WHEN pa.status='pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN pa.status='quoted' THEN 1 ELSE 0 END) as quoted_count
      FROM purchase_assignments pa
      JOIN requirements r ON pa.requirement_id=r.id
      JOIN inquiries i ON r.inquiry_id=i.id
      WHERE pa.purchaser_id=?
      GROUP BY i.type
    `).all(userId);

    res.json({ isPM: false, myAssigned, myPending, myQuoted, myToday, myThisWeek, byType });
  }
});

// ── Purchasers list ───────────────────────────────────────────
router.get('/purchasers', canManage, (req, res) => {
  res.json(getDB().prepare("SELECT id, name, username FROM users WHERE role='purchaser' ORDER BY name").all());
});

module.exports = router;
