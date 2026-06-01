const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const ROLE = {
  isManager:  (u) => u.role === 'manager',
  isPM:       (u) => ['purchasing_manager','manager'].includes(u.role),
  isAE:       (u) => u.role === 'ae',
  isPurchaser:(u) => u.role === 'purchaser',
};

function roleWhere(user, alias = 'i') {
  if (ROLE.isManager(user)) return { clause: '1=1', params: [] };
  if (ROLE.isAE(user))      return { clause: `${alias}.assigned_to = ?`, params: [user.id] };
  if (ROLE.isPM(user))      return { clause: '1=1', params: [] };
  return { clause: '1=0', params: [] };
}

// ── GET /api/inquiries/stats ─────────── must be BEFORE /:id ──
router.get('/stats', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const role = roleWhere(req.user);
  const base = role.clause; const p = [...role.params];
  const total  = db.prepare(`SELECT COUNT(*) as c FROM inquiries i WHERE ${base}`).get(...p).c;
  const todayC = db.prepare(`SELECT COUNT(*) as c FROM inquiries i WHERE ${base} AND date(i.created_at)=?`).get(...p, today).c;
  const wonC   = db.prepare(`SELECT COUNT(*) as c FROM inquiries i WHERE ${base} AND i.disposition IN ('Closed Won','Processed')`).get(...p).c;
  const active = db.prepare(`SELECT COUNT(*) as c FROM inquiries i WHERE ${base} AND i.disposition NOT IN ('Closed Won','Closed Lost','Processed','Cancelled','Fake Lead') AND i.disposition IS NOT NULL`).get(...p).c;
  res.json({ total, today: todayC, won: wonC, active });
});

// ── GET /api/inquiries/search ─────────── must be BEFORE /:id ──
router.get('/search', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const db = getDB();
  const role = roleWhere(req.user);
  const s = `%${q}%`;
  const results = db.prepare(`
    SELECT i.id, i.type, i.disposition, c.name as customer_name, c.company as customer_company, ae.name as assigned_name
    FROM inquiries i JOIN customers c ON i.customer_id=c.id LEFT JOIN users ae ON i.assigned_to=ae.id
    WHERE (${role.clause}) AND (c.name LIKE ? OR c.company LIKE ? OR i.notes LIKE ?)
    ORDER BY i.created_at DESC LIMIT 20
  `).all(...role.params, s, s, s);
  res.json(results);
});

// ── GET /api/inquiries ────────────────────────────────────────
router.get('/', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const db = getDB();
  const { type, disposition, assigned_to, from, to, search } = req.query;

  const role = roleWhere(req.user);
  let where = role.clause;
  const params = [...role.params];

  if (ROLE.isManager(req.user) && assigned_to) {
    const ids = assigned_to.split(',').filter(Boolean);
    if (ids.length === 1) { where += ' AND i.assigned_to=?'; params.push(ids[0]); }
    else if (ids.length > 1) { where += ` AND i.assigned_to IN (${ids.map(()=>'?').join(',')})`; params.push(...ids); }
  }
  if (type) {
    const types = type.split(',').filter(Boolean);
    if (types.length === 1) { where += ' AND i.type=?'; params.push(types[0]); }
    else if (types.length > 1) { where += ` AND i.type IN (${types.map(()=>'?').join(',')})`; params.push(...types); }
  }
  if (disposition) {
    const disps = disposition.split(',').filter(Boolean);
    if (disps.length === 1) { where += ' AND i.disposition=?'; params.push(disps[0]); }
    else if (disps.length > 1) { where += ` AND i.disposition IN (${disps.map(()=>'?').join(',')})`; params.push(...disps); }
  }
  if (from) { where += ' AND date(i.created_at)>=?'; params.push(from); }
  if (to)   { where += ' AND date(i.created_at)<=?'; params.push(to); }
  if (search) {
    where += ' AND (c.name LIKE ? OR c.company LIKE ? OR i.notes LIKE ?)';
    const s = `%${search}%`; params.push(s, s, s);
  }

  // Fetch inquiries — simple query, no JSON functions (max SQLite compatibility)
  const rows = db.prepare(`
    SELECT i.*,
      c.name  as customer_name,  c.company as customer_company,
      c.email as customer_email, c.phone   as customer_phone,
      ae.name as assigned_name,  ae.id     as ae_id
    FROM inquiries i
    JOIN customers c ON i.customer_id=c.id
    LEFT JOIN users ae ON i.assigned_to=ae.id
    WHERE ${where}
    ORDER BY i.created_at DESC
  `).all(...params);

  // Fetch requirements for all returned inquiries in one query (no JSON functions)
  let requirementsMap = {};
  if (rows.length > 0) {
    const ids = rows.map(r => r.id);
    const reqs = db.prepare(
      `SELECT inquiry_id, id, part_number, quantity, notes FROM requirements WHERE inquiry_id IN (${ids.map(()=>'?').join(',')})`
    ).all(...ids);
    reqs.forEach(r => {
      if (!requirementsMap[r.inquiry_id]) requirementsMap[r.inquiry_id] = [];
      requirementsMap[r.inquiry_id].push({ id: r.id, part_number: r.part_number, quantity: r.quantity, notes: r.notes });
    });
  }

  const result = rows.map(r => ({ ...r, requirements: requirementsMap[r.id] || [] }));
  res.json(result);
});

// ── GET /api/inquiries/:id ─────────────────────────────────────
router.get('/:id', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const db = getDB();
  const inquiry = db.prepare(`
    SELECT i.*, c.name as customer_name, c.company as customer_company,
      c.email as customer_email, c.phone as customer_phone,
      ae.name as assigned_name, ae.id as ae_id
    FROM inquiries i
    JOIN customers c ON i.customer_id=c.id
    LEFT JOIN users ae ON i.assigned_to=ae.id
    WHERE i.id=?
  `).get(req.params.id);
  if (!inquiry) return res.status(404).json({ error: 'Not found' });
  if (ROLE.isAE(req.user) && inquiry.ae_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  const requirements = db.prepare('SELECT * FROM requirements WHERE inquiry_id=? ORDER BY id').all(req.params.id);
  let followups = [], activity = [];
  try { followups = db.prepare('SELECT f.*, u.name as user_name FROM followups f LEFT JOIN users u ON f.user_id=u.id WHERE f.inquiry_id=? ORDER BY f.follow_up_date ASC, f.created_at ASC').all(req.params.id); } catch(e) {}
  try { activity  = db.prepare("SELECT a.*, u.name as user_name FROM activity_log a LEFT JOIN users u ON a.user_id=u.id WHERE a.entity_id=? AND a.entity_type='inquiry' ORDER BY a.created_at DESC LIMIT 30").all(req.params.id); } catch(e) {}

  res.json({ ...inquiry, requirements, followups, activity });
});

// ── POST /api/inquiries ────────────────────────────────────────
router.post('/', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const db = getDB();
  const { customer_id, type, notes, assigned_to, disposition, order_ref, order_amount,
    lead_source, order_source, ppc_or_outbound, requirements } = req.body;
  if (!customer_id || !type) return res.status(400).json({ error: 'customer_id and type required' });

  const assignedTo = ROLE.isAE(req.user) ? req.user.id : (assigned_to || req.user.id);
  const result = db.prepare(`
    INSERT INTO inquiries (customer_id, type, notes, assigned_to, disposition, order_ref, order_amount, lead_source, order_source, ppc_or_outbound)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(customer_id, type, notes||null, assignedTo, disposition||'New', order_ref||null, order_amount||null, lead_source||null, order_source||null, ppc_or_outbound||null);
  const inquiryId = result.lastInsertRowid;

  if (Array.isArray(requirements)) {
    const stmt = db.prepare('INSERT INTO requirements (inquiry_id, part_number, quantity, notes) VALUES (?,?,?,?)');
    requirements.forEach(r => { if (r.part_number?.trim()) stmt.run(inquiryId, r.part_number.trim(), r.quantity||null, r.notes||null); });
  }

  try { db.prepare("INSERT INTO activity_log (entity_id, entity_type, user_id, action, comment) VALUES (?,?,?,?,?)").run(inquiryId, 'inquiry', req.user.id, 'Created', `${type} created`); } catch(e) {}

  // Notify purchasing managers
  const customer = db.prepare('SELECT name, company FROM customers WHERE id=?').get(customer_id);
  const pms = db.prepare("SELECT id FROM users WHERE role='purchasing_manager'").all();
  const ins = db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment) VALUES (?,?,?,?,?,?,?)");
  const typeLabel = type==='lead'?'Lead':type==='repeat'?'Repeat':'Online Order';
  pms.forEach(pm => ins.run(pm.id, inquiryId, type, customer?.name||'', req.user.name, `New ${typeLabel} created`, customer?.company||customer?.name||''));

  res.json({ id: inquiryId });
});

// ── PUT + PATCH /api/inquiries/:id ─────────────────────────────
const updateInquiry = (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const db = getDB();
  const existing = db.prepare('SELECT assigned_to, disposition FROM inquiries WHERE id=?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (ROLE.isAE(req.user) && existing.assigned_to !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  const { notes, disposition, assigned_to, order_ref, order_amount, lead_source,
    order_source, ppc_or_outbound, custom_date, requirements } = req.body;
  const updates = []; const params = [];
  if (notes          !== undefined) { updates.push('notes=?');           params.push(notes); }
  if (disposition    !== undefined) { updates.push('disposition=?');     params.push(disposition); }
  if (order_ref      !== undefined) { updates.push('order_ref=?');       params.push(order_ref); }
  if (order_amount   !== undefined) { updates.push('order_amount=?');    params.push(order_amount); }
  if (lead_source    !== undefined) { updates.push('lead_source=?');     params.push(lead_source); }
  if (order_source   !== undefined) { updates.push('order_source=?');    params.push(order_source); }
  if (ppc_or_outbound!==undefined)  { updates.push('ppc_or_outbound=?'); params.push(ppc_or_outbound); }
  if (custom_date    !== undefined) { updates.push('created_at=?');      params.push(custom_date); }
  if (ROLE.isManager(req.user) && assigned_to !== undefined) { updates.push('assigned_to=?'); params.push(assigned_to); }

  if (updates.length) { params.push(req.params.id); db.prepare(`UPDATE inquiries SET ${updates.join(',')} WHERE id=?`).run(...params); }

  // Update requirements if sent
  if (Array.isArray(requirements)) {
    db.prepare('DELETE FROM requirements WHERE inquiry_id=?').run(req.params.id);
    const stmt = db.prepare('INSERT INTO requirements (inquiry_id, part_number, quantity, notes) VALUES (?,?,?,?)');
    requirements.forEach(r => { if (r.part_number?.trim()) stmt.run(req.params.id, r.part_number.trim(), r.quantity||null, r.notes||null); });
  }

  if (disposition && disposition !== existing.disposition) {
    try { db.prepare("INSERT INTO activity_log (entity_id, entity_type, user_id, action, comment) VALUES (?,?,?,?,?)").run(req.params.id, 'inquiry', req.user.id, disposition, ''); } catch(e) {}
    if (disposition === 'Closed Won' || disposition === 'Processed') {
      const inq = db.prepare('SELECT i.*, c.name as customer_name FROM inquiries i JOIN customers c ON i.customer_id=c.id WHERE i.id=?').get(req.params.id);
      const mgrs = db.prepare("SELECT id FROM users WHERE role IN ('purchasing_manager','manager')").all();
      const ins = db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment) VALUES (?,?,?,?,?,?,?)");
      mgrs.forEach(m => ins.run(m.id, req.params.id, inq?.type||'', inq?.customer_name||'', req.user.name, disposition, ''));
    }
  }
  res.json({ success: true });
};
router.put('/:id',   updateInquiry);
router.patch('/:id', updateInquiry);

// ── DELETE /api/inquiries/:id ──────────────────────────────────
router.delete('/:id', (req, res) => {
  if (!ROLE.isManager(req.user)) return res.status(403).json({ error: 'Managers only' });
  getDB().prepare('DELETE FROM inquiries WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── POST /api/inquiries/:id/comments ──────────────────────────
router.post('/:id/comments', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment required' });
  try { getDB().prepare("INSERT INTO activity_log (entity_id, entity_type, user_id, action, comment) VALUES (?,?,?,?,?)").run(req.params.id, 'inquiry', req.user.id, 'Comment', comment.trim()); } catch(e) {}
  res.json({ success: true });
});

// ── GET /api/inquiries/:id/followups ──────────────────────────
router.get('/:id/followups', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  try {
    const rows = getDB().prepare('SELECT f.*, u.name as user_name FROM followups f LEFT JOIN users u ON f.user_id=u.id WHERE f.inquiry_id=? ORDER BY f.follow_up_date ASC').all(req.params.id);
    res.json(rows);
  } catch(e) { res.json([]); }
});

// ── POST /api/inquiries/:id/followups ─────────────────────────
router.post('/:id/followups', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const { note, follow_up_date } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'Note required' });
  try {
    const r = getDB().prepare('INSERT INTO followups (inquiry_id, user_id, note, follow_up_date) VALUES (?,?,?,?)').run(req.params.id, req.user.id, note.trim(), follow_up_date||null);
    res.json({ id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/inquiries/followups/:id ──────────────────────────
router.put('/followups/:id', (req, res) => {
  const { note, follow_up_date, completed } = req.body;
  const db = getDB();
  const updates = []; const params = [];
  if (note         !== undefined) { updates.push('note=?');           params.push(note); }
  if (follow_up_date!==undefined) { updates.push('follow_up_date=?'); params.push(follow_up_date); }
  if (completed    !== undefined) { updates.push('completed=?');      params.push(completed ? 1 : 0); }
  if (!updates.length) return res.json({ success: true });
  params.push(req.params.id);
  try { db.prepare(`UPDATE followups SET ${updates.join(',')} WHERE id=?`).run(...params); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/inquiries/followups/:id ───────────────────────
router.delete('/followups/:id', (req, res) => {
  try { getDB().prepare('DELETE FROM followups WHERE id=?').run(req.params.id); } catch(e) {}
  res.json({ success: true });
});

// ── PATCH /api/inquiries/followup/:id/complete ────────────────
router.patch('/followup/:id/complete', (req, res) => {
  try { getDB().prepare('UPDATE followups SET completed=1 WHERE id=?').run(req.params.id); } catch(e) {}
  res.json({ success: true });
});

// ── POST /api/inquiries/:id/requirements ──────────────────────
router.post('/:id/requirements', (req, res) => {
  if (ROLE.isPurchaser(req.user)) return res.status(403).json({ error: 'Access denied' });
  const { part_number, quantity, notes } = req.body;
  if (!part_number?.trim()) return res.status(400).json({ error: 'part_number required' });
  const r = getDB().prepare('INSERT INTO requirements (inquiry_id, part_number, quantity, notes) VALUES (?,?,?,?)').run(req.params.id, part_number.trim(), quantity||null, notes||null);
  res.json({ id: r.lastInsertRowid });
});

// ── DELETE /api/inquiries/requirements/:id ────────────────────
router.delete('/requirements/:id', (req, res) => {
  if (!ROLE.isManager(req.user) && !ROLE.isAE(req.user)) return res.status(403).json({ error: 'Access denied' });
  getDB().prepare('DELETE FROM requirements WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
