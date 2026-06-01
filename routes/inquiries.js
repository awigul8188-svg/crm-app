const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const ROLE = {
  isManager: (u) => u.role === 'manager',
  isPM:      (u) => ['purchasing_manager','manager'].includes(u.role),
  isAE:      (u) => u.role === 'ae',
  isPurchaser:(u) => u.role === 'purchaser',
};

// Build role-based WHERE clause for inquiries
function roleWhere(user, alias = 'i') {
  if (ROLE.isManager(user)) return { clause: '1=1', params: [] };
  if (ROLE.isAE(user))      return { clause: `${alias}.assigned_to = ?`, params: [user.id] };
  if (ROLE.isPM(user))      return { clause: '1=1', params: [] }; // PM can view all
  return { clause: '1=0', params: [] }; // purchasers blocked
}

// ── GET /api/inquiries ─────────────────────────────────────────
router.get('/', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const db = getDB();
  const { type, disposition, assigned_to, from, to, search, page = 1, limit = 50 } = req.query;
  const pageSize = parseInt(limit) || 50;
  const offset   = (parseInt(page) - 1) * pageSize;

  const role = roleWhere(req.user);
  let where = role.clause;
  const params = [...role.params];

  // Managers can filter by assigned_to; AEs are always filtered to themselves
  if (ROLE.isManager(req.user) && assigned_to) { where += ' AND i.assigned_to=?'; params.push(assigned_to); }
  if (type)        { where += ' AND i.type=?';               params.push(type); }
  if (disposition) { where += ' AND i.disposition=?';        params.push(disposition); }
  if (from)        { where += ' AND date(i.created_at)>=?';  params.push(from); }
  if (to)          { where += ' AND date(i.created_at)<=?';  params.push(to); }
  if (search) {
    where += ' AND (c.name LIKE ? OR c.company LIKE ? OR i.notes LIKE ?)';
    const s = `%${search}%`; params.push(s,s,s);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM inquiries i
    JOIN customers c ON i.customer_id=c.id
    WHERE ${where}
  `).get(...params).c;

  const rows = db.prepare(`
    SELECT i.*, c.name as customer_name, c.company as customer_company, c.email as customer_email,
      ae.name as ae_name, ae.id as ae_id
    FROM inquiries i
    JOIN customers c ON i.customer_id=c.id
    LEFT JOIN users ae ON i.assigned_to=ae.id
    WHERE ${where}
    ORDER BY i.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `).all(...params);

  res.json(rows);
});

// ── GET /api/inquiries/:id ──────────────────────────────────────
router.get('/:id', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const db = getDB();
  const inquiry = db.prepare(`
    SELECT i.*, c.name as customer_name, c.company as customer_company,
      c.email as customer_email, c.phone as customer_phone,
      ae.name as ae_name, ae.id as ae_id
    FROM inquiries i
    JOIN customers c ON i.customer_id=c.id
    LEFT JOIN users ae ON i.assigned_to=ae.id
    WHERE i.id=?
  `).get(req.params.id);
  if (!inquiry) return res.status(404).json({ error: 'Not found' });

  // AEs can only view their own inquiries
  if (ROLE.isAE(req.user) && inquiry.ae_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  // Parts/requirements
  const requirements = db.prepare(`
    SELECT r.*,
      pa.id as assignment_id, pa.status as assignment_status, pa.urgency, pa.pm_notes,
      pu.name as purchaser_name,
      pq.price, pq.condition, pq.lead_time, pq.supplier_name, pq.notes as quote_notes, pq.updated_at as quoted_at
    FROM requirements r
    LEFT JOIN purchase_assignments pa ON pa.requirement_id=r.id
    LEFT JOIN users pu ON pa.purchaser_id=pu.id
    LEFT JOIN purchase_quotes pq ON pq.assignment_id=pa.id
    WHERE r.inquiry_id=?
    ORDER BY r.id
  `).all(req.params.id);

  // Follow-ups (only for this AE or manager)
  let followups = [];
  try {
    followups = db.prepare(`
      SELECT f.*, u.name as user_name FROM inquiry_followups f
      JOIN users u ON f.user_id=u.id
      WHERE f.inquiry_id=?
      ORDER BY f.follow_up_date ASC, f.created_at ASC
    `).all(req.params.id);
  } catch(e) {}

  // Activity
  const activity = db.prepare(`
    SELECT a.*, u.name as user_name FROM inquiry_activity a
    LEFT JOIN users u ON a.user_id=u.id
    WHERE a.inquiry_id=? ORDER BY a.created_at DESC LIMIT 30
  `).all(req.params.id);

  res.json({ ...inquiry, requirements, followups, activity });
});

// ── POST /api/inquiries ─────────────────────────────────────────
router.post('/', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const db = getDB();
  const { customer_id, type, notes, assigned_to, disposition,
    order_ref, order_amount, lead_source, order_source, ppc_or_outbound, requirements } = req.body;
  if (!customer_id || !type) return res.status(400).json({ error: 'customer_id and type required' });

  const assignedTo = ROLE.isAE(req.user) ? req.user.id : (assigned_to || req.user.id);

  const result = db.prepare(`
    INSERT INTO inquiries (customer_id, type, notes, assigned_to, disposition, order_ref, order_amount, lead_source, order_source, ppc_or_outbound)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(customer_id, type, notes||null, assignedTo, disposition||'New', order_ref||null, order_amount||null, lead_source||null, order_source||null, ppc_or_outbound||null);

  const inquiryId = result.lastInsertRowid;

  // Insert requirements/parts
  if (Array.isArray(requirements)) {
    const stmt = db.prepare('INSERT INTO requirements (inquiry_id, part_number, quantity, notes) VALUES (?,?,?,?)');
    requirements.forEach(r => { if (r.part_number?.trim()) stmt.run(inquiryId, r.part_number.trim(), r.quantity||null, r.notes||null); });
  }

  // Notify all purchasing managers of new inquiry
  const customer = db.prepare('SELECT name, company FROM customers WHERE id=?').get(customer_id);
  const pms = db.prepare("SELECT id FROM users WHERE role='purchasing_manager'").all();
  const ins = db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment) VALUES (?,?,?,?,?,?,?)");
  const typeLabel = type === 'lead' ? 'Lead' : type === 'repeat' ? 'Repeat' : 'Online Order';
  pms.forEach(pm => ins.run(pm.id, inquiryId, type, customer?.name||'', req.user.name, `New ${typeLabel} created`, `${customer?.company||customer?.name||''}`));

  // Log activity
  db.prepare("INSERT INTO inquiry_activity (inquiry_id, user_id, action, comment) VALUES (?,?,?,?)").run(inquiryId, req.user.id, 'Created', `${typeLabel} created by ${req.user.name}`);

  res.json({ id: inquiryId });
});

// ── PATCH /api/inquiries/:id ────────────────────────────────────
router.patch('/:id', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const db = getDB();
  const inquiry = db.prepare('SELECT assigned_to, disposition FROM inquiries WHERE id=?').get(req.params.id);
  if (!inquiry) return res.status(404).json({ error: 'Not found' });
  if (ROLE.isAE(req.user) && inquiry.assigned_to !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  const { notes, disposition, assigned_to, order_ref, order_amount, lead_source, order_source, ppc_or_outbound } = req.body;
  const updates = []; const params = [];
  if (notes       !== undefined) { updates.push('notes=?');           params.push(notes); }
  if (disposition !== undefined) { updates.push('disposition=?');     params.push(disposition); }
  if (order_ref   !== undefined) { updates.push('order_ref=?');       params.push(order_ref); }
  if (order_amount!== undefined) { updates.push('order_amount=?');    params.push(order_amount); }
  if (lead_source !== undefined) { updates.push('lead_source=?');     params.push(lead_source); }
  if (order_source!== undefined) { updates.push('order_source=?');    params.push(order_source); }
  if (ppc_or_outbound!==undefined){ updates.push('ppc_or_outbound=?');params.push(ppc_or_outbound); }
  // Only managers can reassign
  if (ROLE.isManager(req.user) && assigned_to !== undefined) { updates.push('assigned_to=?'); params.push(assigned_to); }
  if (!updates.length) return res.json({ success: true });
  params.push(req.params.id);
  db.prepare(`UPDATE inquiries SET ${updates.join(',')} WHERE id=?`).run(...params);

  // Log activity
  const changes = [];
  if (disposition !== undefined && disposition !== inquiry.disposition) changes.push(`Status → ${disposition}`);
  if (changes.length) db.prepare("INSERT INTO inquiry_activity (inquiry_id, user_id, action, comment) VALUES (?,?,?,?)").run(req.params.id, req.user.id, 'Updated', changes.join(', '));

  // If Closed Won → notify PMs to help track revenue
  if (disposition === 'Closed Won' || disposition === 'Processed') {
    const inq = db.prepare('SELECT i.*, c.name as customer_name FROM inquiries i JOIN customers c ON i.customer_id=c.id WHERE i.id=?').get(req.params.id);
    const pms = db.prepare("SELECT id FROM users WHERE role IN ('purchasing_manager','manager')").all();
    const ins = db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment) VALUES (?,?,?,?,?,?,?)");
    pms.forEach(pm => ins.run(pm.id, req.params.id, inq?.type||'', inq?.customer_name||'', req.user.name, disposition, ''));
  }

  res.json({ success: true });
});

// ── DELETE /api/inquiries/:id ───────────────────────────────────
router.delete('/:id', (req, res) => {
  if (!ROLE.isManager(req.user)) return res.status(403).json({ error: 'Managers only' });
  getDB().prepare('DELETE FROM inquiries WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── GET /api/inquiries/:id/followups ───────────────────────────
router.get('/:id/followups', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  try {
    const followups = getDB().prepare(`
      SELECT f.*, u.name as user_name FROM inquiry_followups f
      JOIN users u ON f.user_id=u.id
      WHERE f.inquiry_id=? ORDER BY f.follow_up_date ASC, f.created_at ASC
    `).all(req.params.id);
    res.json(followups);
  } catch(e) { res.json([]); }
});

// ── POST /api/inquiries/:id/followups ──────────────────────────
router.post('/:id/followups', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const { note, follow_up_date } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'Note required' });
  try {
    const result = getDB().prepare(
      'INSERT INTO inquiry_followups (inquiry_id, user_id, note, follow_up_date) VALUES (?,?,?,?)'
    ).run(req.params.id, req.user.id, note.trim(), follow_up_date||null);
    res.json({ id: result.lastInsertRowid });
  } catch(e) {
    // fallback to old followups table if inquiry_followups doesn't exist
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/inquiries/followup/:id/complete ─────────────────
router.patch('/followup/:id/complete', (req, res) => {
  try {
    getDB().prepare('UPDATE inquiry_followups SET completed=1 WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.json({ success: true }); }
});

// ── POST /api/inquiries/:id/requirements ───────────────────────
router.post('/:id/requirements', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const { part_number, quantity, notes } = req.body;
  if (!part_number?.trim()) return res.status(400).json({ error: 'part_number required' });
  const result = getDB().prepare('INSERT INTO requirements (inquiry_id, part_number, quantity, notes) VALUES (?,?,?,?)').run(req.params.id, part_number.trim(), quantity||null, notes||null);
  res.json({ id: result.lastInsertRowid });
});

// ── DELETE /api/inquiries/requirements/:id ─────────────────────
router.delete('/requirements/:id', (req, res) => {
  if (!ROLE.isManager(req.user) && !ROLE.isAE(req.user)) return res.status(403).json({ error: 'Access denied' });
  getDB().prepare('DELETE FROM requirements WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── GET /api/inquiries/search ──────────────────────────────────
router.get('/search', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const db = getDB();
  const role = roleWhere(req.user);
  const s = `%${q}%`;
  const results = db.prepare(`
    SELECT i.id, i.type, i.disposition, c.name as customer_name, c.company as customer_company, ae.name as ae_name
    FROM inquiries i JOIN customers c ON i.customer_id=c.id LEFT JOIN users ae ON i.assigned_to=ae.id
    WHERE (${role.clause}) AND (c.name LIKE ? OR c.company LIKE ? OR i.notes LIKE ?)
    ORDER BY i.created_at DESC LIMIT 20
  `).all(...role.params, s, s, s);
  res.json(results);
});

module.exports = router;
