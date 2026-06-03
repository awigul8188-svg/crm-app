const express = require('express');
const { getDB } = require('../database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function logActivity(db, entityId, user, action, comment = null) {
  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, user_name, action, comment) VALUES (?, ?, ?, ?, ?, ?)').run('inquiry', entityId, user.id, user.name, action, comment);
}

// Notify all managers about an AE action
function notifyManagers(db, { inquiry_id, inquiry_type, customer_name, actor_name, actor_role, action, comment }) {
  // Only notify when an AE does something (not when a manager acts on their own stuff)
  // Managers still get notified of all AE actions
  const managers = db.prepare("SELECT id FROM users WHERE role = 'manager'").all();
  const insert = db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment) VALUES (?, ?, ?, ?, ?, ?, ?)");
  managers.forEach(m => insert.run(m.id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment));
}

function buildInFilter(column, value) {
  if (!value) return null;
  const values = value.split(',').map(v => v.trim()).filter(Boolean);
  if (!values.length) return null;
  return { sql: `${column} IN (${values.map(() => '?').join(',')})`, params: values };
}

router.get('/', (req, res) => {
  const db = getDB();
  const { type, disposition, lead_source } = req.query;
  let query = `
    SELECT i.*, c.name as customer_name, c.email as customer_email, c.company as customer_company,
      c.phone as customer_phone, c.lead_source, u.name as assigned_name
    FROM inquiries i
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN users u ON i.assigned_to = u.id WHERE 1=1
  `;
  const params = [];
  if (req.user.role === 'ae') { query += ' AND i.assigned_to = ?'; params.push(req.user.id); }
  if (type) { query += ' AND i.type = ?'; params.push(type); }
  if (disposition) { const f = buildInFilter('i.disposition', disposition); if (f) { query += ` AND ${f.sql}`; params.push(...f.params); } }
  if (lead_source) { const f = buildInFilter('c.lead_source', lead_source); if (f) { query += ` AND ${f.sql}`; params.push(...f.params); } }
  query += ' ORDER BY i.created_at DESC';
  const inquiries = db.prepare(query).all(...params);
  res.json(inquiries.map(inq => ({ ...inq, requirements: db.prepare('SELECT * FROM requirements WHERE inquiry_id = ?').all(inq.id) })));
});

router.get('/stats', (req, res) => {
  const db = getDB();
  const userId = req.user.role === 'ae' ? req.user.id : null;
  const w = userId ? 'AND assigned_to = ?' : '';
  const p = (extra = []) => userId ? [userId, ...extra] : extra;
  const count = (type) => db.prepare(`SELECT COUNT(*) as c FROM inquiries WHERE type=? ${w}`).get(...p([type])).c;
  const today = new Date().toISOString().split('T')[0];
  const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const upcomingFollowups = db.prepare(`SELECT COUNT(*) as c FROM followups f JOIN inquiries i ON f.inquiry_id = i.id WHERE f.completed=0 AND f.follow_up_date BETWEEN ? AND ? ${userId ? 'AND i.ass[...]
  res.json({ leads: count('lead'), repeat: count('repeat'), orders: count('online_order'), upcomingFollowups });
});

router.post('/', (req, res) => {
  const { customer_id, type, disposition, assigned_to, notes, requirements, ppc_or_outbound, order_amount, order_ref, custom_date } = req.body;
  if (!customer_id || !type) return res.status(400).json({ error: 'customer_id and type required' });
  const db = getDB();
  const assignee = req.user.role === 'ae' ? req.user.id : (assigned_to || req.user.id);

  // Use custom_date if provided, otherwise now
  const createdAt = custom_date ? new Date(custom_date).toISOString() : new Date().toISOString();

  const result = db.prepare('INSERT INTO inquiries (customer_id, type, disposition, assigned_to, notes, ppc_or_outbound, order_amount, order_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, [...]
  const inquiryId = result.lastInsertRowid;

  if (requirements?.length) {
    const ins = db.prepare('INSERT INTO requirements (inquiry_id, part_number, quantity) VALUES (?, ?, ?)');
    requirements.forEach(r => { if (r.part_number?.trim()) ins.run(inquiryId, r.part_number, r.quantity); });
  }

  logActivity(db, inquiryId, req.user, `${type} created`);

  // Notify managers if AE created this
  const customer = db.prepare('SELECT name FROM customers WHERE id = ?').get(customer_id);
  notifyManagers(db, {
    inquiry_id: inquiryId, inquiry_type: type,
    customer_name: customer?.name || 'Unknown',
    actor_name: req.user.name,
    actor_role: req.user.role,
    action: `New ${type === 'lead' ? 'Lead' : type === 'repeat' ? 'Repeat Inquiry' : 'Online Order'} created`,
    comment: null,
  });

  res.json({ id: inquiryId });
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const inquiry = db.prepare(`SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.company as customer_company, c.lead_source, u.name as assigned_name FROM [...]
  if (!inquiry) return res.status(404).json({ error: 'Not found' });
  const requirements = db.prepare('SELECT * FROM requirements WHERE inquiry_id = ? ORDER BY id').all(req.params.id);
  const followups = db.prepare(`SELECT f.*, u.name as created_by_name FROM followups f LEFT JOIN users u ON f.created_by = u.id WHERE f.inquiry_id = ? ORDER BY f.created_at DESC`).all(req.params.i[...]
  const activity = db.prepare("SELECT * FROM activity_log WHERE entity_type='inquiry' AND entity_id=? ORDER BY created_at DESC").all(req.params.id);
  res.json({ ...inquiry, requirements, followups, activity });
});

router.put('/:id', (req, res) => {
  const { disposition, assigned_to, notes, requirements, ppc_or_outbound, order_amount, order_ref } = req.body;
  const db = getDB();

  // Get inquiry info for notification
  const inquiry = db.prepare('SELECT i.type, c.name as customer_name FROM inquiries i JOIN customers c ON i.customer_id = c.id WHERE i.id = ?').get(req.params.id);

  db.prepare('UPDATE inquiries SET disposition=?, assigned_to=?, notes=?, ppc_or_outbound=?, order_amount=?, order_ref=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(disposition, assigned_to, n[...]
  if (requirements !== undefined) {
    db.prepare('DELETE FROM requirements WHERE inquiry_id = ?').run(req.params.id);
    if (requirements.length) { const ins = db.prepare('INSERT INTO requirements (inquiry_id, part_number, quantity) VALUES (?, ?, ?)'); requirements.forEach(r => { if (r.part_number?.trim()) ins.[...]
  }

  logActivity(db, req.params.id, req.user, 'Inquiry updated');

  notifyManagers(db, {
    inquiry_id: parseInt(req.params.id),
    inquiry_type: inquiry?.type,
    customer_name: inquiry?.customer_name || 'Unknown',
    actor_name: req.user.name,
    actor_role: req.user.role,
    action: `Disposition changed to "${disposition}"`,
    comment: null,
  });

  res.json({ success: true });
});

router.delete('/:id', requireManager, (req, res) => {
  getDB().prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/comments', (req, res) => {
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  const db = getDB();

  const inquiry = db.prepare('SELECT i.type, c.name as customer_name FROM inquiries i JOIN customers c ON i.customer_id = c.id WHERE i.id = ?').get(req.params.id);

  logActivity(db, req.params.id, req.user, 'Comment', comment);

  notifyManagers(db, {
    inquiry_id: parseInt(req.params.id),
    inquiry_type: inquiry?.type,
    customer_name: inquiry?.customer_name || 'Unknown',
    actor_name: req.user.name,
    actor_role: req.user.role,
    action: 'Added a comment',
    comment: comment.length > 80 ? comment.slice(0, 80) + '...' : comment,
  });

  res.json({ success: true });
});

router.post('/:id/followups', (req, res) => {
  const { note, follow_up_date } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'Note required' });
  const db = getDB();

  const inquiry = db.prepare('SELECT i.type, c.name as customer_name FROM inquiries i JOIN customers c ON i.customer_id = c.id WHERE i.id = ?').get(req.params.id);

  const result = db.prepare('INSERT INTO followups (inquiry_id, note, follow_up_date, created_by) VALUES (?, ?, ?, ?)').run(req.params.id, note, follow_up_date || null, req.user.id);
  logActivity(db, req.params.id, req.user, 'Follow-up added', note);

  notifyManagers(db, {
    inquiry_id: parseInt(req.params.id),
    inquiry_type: inquiry?.type,
    customer_name: inquiry?.customer_name || 'Unknown',
    actor_name: req.user.name,
    actor_role: req.user.role,
    action: `Added a follow-up${follow_up_date ? ` for ${follow_up_date}` : ''}`,
    comment: note.length > 80 ? note.slice(0, 80) + '...' : note,
  });

  res.json({ id: result.lastInsertRowid });
});

router.put('/followups/:id', (req, res) => {
  const { completed, note, follow_up_date } = req.body;
  getDB().prepare('UPDATE followups SET completed=?, note=?, follow_up_date=? WHERE id=?').run(completed ? 1 : 0, note, follow_up_date || null, req.params.id);
  res.json({ success: true });
});

router.delete('/followups/:id', requireManager, (req, res) => {
  getDB().prepare('DELETE FROM followups WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;

function runPurchasingMigrations() {
  const db = getDB();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
        purchaser_id INTEGER NOT NULL REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        status TEXT DEFAULT 'pending',
        urgency TEXT DEFAULT 'normal',
        pm_notes TEXT,
        purchaser_notes TEXT,
        not_in_stock INTEGER DEFAULT 0,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(requirement_id)
      );
      CREATE TABLE IF NOT EXISTS purchase_quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL REFERENCES purchase_assignments(id) ON DELETE CASCADE,
        requirement_id INTEGER NOT NULL,
        purchaser_id INTEGER NOT NULL,
        price TEXT,
        condition TEXT,
        lead_time TEXT,
        supplier_name TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS purchaser_followups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL REFERENCES purchase_assignments(id) ON DELETE CASCADE,
        purchaser_id INTEGER NOT NULL REFERENCES users(id),
        note TEXT NOT NULL,
        follow_up_date DATE,
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS part_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL REFERENCES purchase_assignments(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        user_name TEXT,
        user_role TEXT,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch(e) { console.log('Purchasing migration note:', e.message); }
}
module.exports.runPurchasingMigrations = runPurchasingMigrations;

function runPurchasingV2Migrations() {
  const db = getDB();
  const cols = ["urgency TEXT DEFAULT 'normal'", 'pm_notes TEXT', 'purchaser_notes TEXT', 'not_in_stock INTEGER DEFAULT 0'];
  cols.forEach(col => { try { db.exec('ALTER TABLE purchase_assignments ADD COLUMN ' + col); } catch(e) {} });
}
module.exports.runPurchasingV2Migrations = runPurchasingV2Migrations;
