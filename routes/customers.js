const express = require('express');
const { getDB } = require('../database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDB();
  const { search } = req.query;
  let query = `SELECT c.*, u.name as assigned_name, COUNT(DISTINCT i.id) as inquiry_count FROM customers c LEFT JOIN users u ON c.assigned_to = u.id LEFT JOIN inquiries i ON i.customer_id = c.id WHERE 1=1`;
  const params = [];
  if (req.user.role === 'ae') { query += ' AND c.assigned_to = ?'; params.push(req.user.id); }
  if (search) { query += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
  query += ' GROUP BY c.id ORDER BY c.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', (req, res) => {
  const { name, email, phone, company, lead_source, assigned_to } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const db = getDB();
  const assignee = req.user.role === 'ae' ? req.user.id : (assigned_to || req.user.id);
  const result = db.prepare('INSERT INTO customers (name, email, phone, company, lead_source, assigned_to) VALUES (?, ?, ?, ?, ?, ?)').run(name, email || null, phone || null, company || null, lead_source || null, assignee);
  db.prepare("INSERT INTO activity_log (entity_type, entity_id, user_id, user_name, action) VALUES ('customer', ?, ?, ?, 'Customer created')").run(result.lastInsertRowid, req.user.id, req.user.name);
  res.json({ id: result.lastInsertRowid });
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const customer = db.prepare(`SELECT c.*, u.name as assigned_name FROM customers c LEFT JOIN users u ON c.assigned_to = u.id WHERE c.id = ?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Not found' });
  const inquiries = db.prepare(`SELECT i.*, u.name as assigned_name FROM inquiries i LEFT JOIN users u ON i.assigned_to = u.id WHERE i.customer_id = ? ORDER BY i.created_at DESC`).all(req.params.id);
  const withReqs = inquiries.map(inq => ({ ...inq, requirements: db.prepare('SELECT * FROM requirements WHERE inquiry_id = ?').all(inq.id) }));
  res.json({ ...customer, inquiries: withReqs });
});

router.put('/:id', (req, res) => {
  const { name, email, phone, company, lead_source, assigned_to } = req.body;
  const db = getDB();
  db.prepare('UPDATE customers SET name=?, email=?, phone=?, company=?, lead_source=?, assigned_to=? WHERE id=?').run(name, email || null, phone || null, company || null, lead_source || null, assigned_to, req.params.id);
  db.prepare("INSERT INTO activity_log (entity_type, entity_id, user_id, user_name, action) VALUES ('customer', ?, ?, ?, 'Customer updated')").run(req.params.id, req.user.id, req.user.name);
  res.json({ success: true });
});

// Delete - managers only
router.delete('/:id', requireManager, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;

// Global search across customers + inquiries
router.get('/search', (req, res) => {
  const db = getDB();
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ customers: [], inquiries: [] });

  const like = `%${q}%`;
  const userId = req.user.id;
  const isManager = req.user.role === 'manager';

  const customers = db.prepare(`
    SELECT id, name, company, email, phone FROM customers
    WHERE name LIKE ? OR company LIKE ? OR email LIKE ? OR phone LIKE ?
    LIMIT 6
  `).all(like, like, like, like);

  const inqWhere = isManager
    ? `WHERE (c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR r.part_number LIKE ?) GROUP BY i.id`
    : `WHERE i.assigned_to = ${userId} AND (c.name LIKE ? OR c.company LIKE ? OR c.email LIKE ? OR r.part_number LIKE ?) GROUP BY i.id`;

  const inquiries = db.prepare(`
    SELECT i.id, i.type, i.disposition, i.created_at,
      c.name as customer_name, c.company as customer_company,
      GROUP_CONCAT(r.part_number, ', ') as parts
    FROM inquiries i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN requirements r ON r.inquiry_id = i.id
    ${inqWhere}
    ORDER BY i.created_at DESC LIMIT 8
  `).all(like, like, like, like);

  res.json({ customers, inquiries });
});
