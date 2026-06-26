const express = require('express');
const { getDB } = require('../database');
const { authenticate, requireManager, requireCrmAccess } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);
router.use(requireCrmAccess); // sales-side only — purchasing roles get 403

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
  
  try {
    const result = db.prepare('INSERT INTO customers (name, email, phone, company, lead_source, assigned_to) VALUES (?, ?, ?, ?, ?, ?)').run(name, email || null, phone || null, company || null, lead_source || null, assignee);
    db.prepare("INSERT INTO activity_log (entity_type, entity_id, user_id, user_name, action) VALUES ('customer', ?, ?, ?, 'Customer created')").run(result.lastInsertRowid, req.user.id, req.user.name);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const db = getDB();
  
  try {
    db.prepare('UPDATE customers SET name=?, email=?, phone=?, company=?, lead_source=?, assigned_to=? WHERE id=?').run(name, email || null, phone || null, company || null, lead_source || null, assigned_to, req.params.id);
    db.prepare("INSERT INTO activity_log (entity_type, entity_id, user_id, user_name, action) VALUES ('customer', ?, ?, ?, 'Customer updated')").run(req.params.id, req.user.id, req.user.name);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete - managers only
router.delete('/:id', requireManager, (req, res) => {
  const db = getDB();
  try {
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;