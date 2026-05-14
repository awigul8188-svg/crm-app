const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// List customers
router.get('/', (req, res) => {
  const db = getDB();
  const { search } = req.query;
  let query = `
    SELECT c.*, u.name as assigned_name,
      COUNT(DISTINCT i.id) as inquiry_count
    FROM customers c
    LEFT JOIN users u ON c.assigned_to = u.id
    LEFT JOIN inquiries i ON i.customer_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'ae') {
    query += ' AND c.assigned_to = ?';
    params.push(req.user.id);
  }

  if (search) {
    query += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ' GROUP BY c.id ORDER BY c.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// Create customer
router.post('/', (req, res) => {
  const { name, email, phone, company, lead_source, assigned_to } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const db = getDB();
  const assignee = req.user.role === 'ae' ? req.user.id : (assigned_to || req.user.id);

  const result = db.prepare(
    'INSERT INTO customers (name, email, phone, company, lead_source, assigned_to) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, email || null, phone || null, company || null, lead_source || null, assignee);

  logActivity(db, 'customer', result.lastInsertRowid, req.user, 'Customer created');
  res.json({ id: result.lastInsertRowid });
});

// Get single customer with inquiries
router.get('/:id', (req, res) => {
  const db = getDB();
  const customer = db.prepare(`
    SELECT c.*, u.name as assigned_name
    FROM customers c
    LEFT JOIN users u ON c.assigned_to = u.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const inquiries = db.prepare(`
    SELECT i.*, u.name as assigned_name
    FROM inquiries i
    LEFT JOIN users u ON i.assigned_to = u.id
    WHERE i.customer_id = ?
    ORDER BY i.created_at DESC
  `).all(req.params.id);

  // Attach requirements to each inquiry
  const withReqs = inquiries.map(inq => ({
    ...inq,
    requirements: db.prepare('SELECT * FROM requirements WHERE inquiry_id = ?').all(inq.id)
  }));

  res.json({ ...customer, inquiries: withReqs });
});

// Update customer
router.put('/:id', (req, res) => {
  const { name, email, phone, company, lead_source, assigned_to } = req.body;
  const db = getDB();

  db.prepare(
    'UPDATE customers SET name=?, email=?, phone=?, company=?, lead_source=?, assigned_to=? WHERE id=?'
  ).run(name, email || null, phone || null, company || null, lead_source || null, assigned_to, req.params.id);

  logActivity(db, 'customer', req.params.id, req.user, 'Customer updated');
  res.json({ success: true });
});

function logActivity(db, entityType, entityId, user, action, comment = null) {
  db.prepare(
    'INSERT INTO activity_log (entity_type, entity_id, user_id, user_name, action, comment) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(entityType, entityId, user.id, user.name, action, comment);
}

module.exports = router;
