const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function logActivity(db, entityId, user, action, comment = null) {
  db.prepare(
    'INSERT INTO activity_log (entity_type, entity_id, user_id, user_name, action, comment) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('inquiry', entityId, user.id, user.name, action, comment);
}

// List inquiries (filtered by type, status, user)
router.get('/', (req, res) => {
  const db = getDB();
  const { type, status } = req.query;

  let query = `
    SELECT i.*,
      c.name as customer_name, c.email as customer_email, c.company as customer_company, c.phone as customer_phone,
      u.name as assigned_name
    FROM inquiries i
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN users u ON i.assigned_to = u.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'ae') {
    query += ' AND i.assigned_to = ?';
    params.push(req.user.id);
  }
  if (type) { query += ' AND i.type = ?'; params.push(type); }
  if (status) { query += ' AND i.status = ?'; params.push(status); }

  query += ' ORDER BY i.created_at DESC';

  const inquiries = db.prepare(query).all(...params);
  const withReqs = inquiries.map(inq => ({
    ...inq,
    requirements: db.prepare('SELECT * FROM requirements WHERE inquiry_id = ?').all(inq.id)
  }));

  res.json(withReqs);
});

// Dashboard stats
router.get('/stats', (req, res) => {
  const db = getDB();
  const userId = req.user.role === 'ae' ? req.user.id : null;
  const whereUser = userId ? 'AND assigned_to = ?' : '';
  const getParam = (extra = []) => userId ? [userId, ...extra] : extra;

  const stat = (type, status) => {
    const q = `SELECT COUNT(*) as c FROM inquiries WHERE type=? AND status=? ${whereUser}`;
    return db.prepare(q).get(...getParam([type, status])).c;
  };

  // Upcoming followups (next 7 days)
  const today = new Date().toISOString().split('T')[0];
  const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const fuQuery = `
    SELECT COUNT(*) as c FROM followups f
    JOIN inquiries i ON f.inquiry_id = i.id
    WHERE f.completed = 0 AND f.follow_up_date BETWEEN ? AND ? ${userId ? 'AND i.assigned_to = ?' : ''}
  `;
  const fuParams = userId ? [today, next7, userId] : [today, next7];
  const upcomingFollowups = db.prepare(fuQuery).get(...fuParams).c;

  res.json({
    leads: { open: stat('lead','open'), in_progress: stat('lead','in_progress'), closed: stat('lead','closed') },
    repeat: { open: stat('repeat','open'), in_progress: stat('repeat','in_progress'), closed: stat('repeat','closed') },
    orders: { open: stat('online_order','open'), in_progress: stat('online_order','in_progress'), closed: stat('online_order','closed') },
    upcomingFollowups
  });
});

// Create inquiry
router.post('/', (req, res) => {
  const { customer_id, type, status, assigned_to, notes, requirements } = req.body;
  if (!customer_id || !type) return res.status(400).json({ error: 'customer_id and type are required' });

  const db = getDB();
  const assignee = req.user.role === 'ae' ? req.user.id : (assigned_to || req.user.id);

  const result = db.prepare(
    'INSERT INTO inquiries (customer_id, type, status, assigned_to, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(customer_id, type, status || 'open', assignee, notes || null);

  const inquiryId = result.lastInsertRowid;

  if (requirements?.length) {
    const ins = db.prepare('INSERT INTO requirements (inquiry_id, part_number, quantity) VALUES (?, ?, ?)');
    requirements.forEach(r => ins.run(inquiryId, r.part_number, r.quantity));
  }

  logActivity(db, inquiryId, req.user, `${type} inquiry created`);
  res.json({ id: inquiryId });
});

// Get single inquiry
router.get('/:id', (req, res) => {
  const db = getDB();
  const inquiry = db.prepare(`
    SELECT i.*,
      c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
      c.company as customer_company, c.lead_source,
      u.name as assigned_name
    FROM inquiries i
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN users u ON i.assigned_to = u.id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!inquiry) return res.status(404).json({ error: 'Not found' });

  const requirements = db.prepare('SELECT * FROM requirements WHERE inquiry_id = ? ORDER BY id').all(req.params.id);
  const followups = db.prepare(`
    SELECT f.*, u.name as created_by_name
    FROM followups f LEFT JOIN users u ON f.created_by = u.id
    WHERE f.inquiry_id = ? ORDER BY f.created_at DESC
  `).all(req.params.id);
  const activity = db.prepare(
    "SELECT * FROM activity_log WHERE entity_type='inquiry' AND entity_id=? ORDER BY created_at DESC"
  ).all(req.params.id);

  res.json({ ...inquiry, requirements, followups, activity });
});

// Update inquiry
router.put('/:id', (req, res) => {
  const { status, assigned_to, notes, requirements } = req.body;
  const db = getDB();

  db.prepare(
    'UPDATE inquiries SET status=?, assigned_to=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(status, assigned_to, notes, req.params.id);

  if (requirements !== undefined) {
    db.prepare('DELETE FROM requirements WHERE inquiry_id = ?').run(req.params.id);
    if (requirements.length) {
      const ins = db.prepare('INSERT INTO requirements (inquiry_id, part_number, quantity) VALUES (?, ?, ?)');
      requirements.forEach(r => ins.run(req.params.id, r.part_number, r.quantity));
    }
  }

  logActivity(db, req.params.id, req.user, 'Inquiry updated');
  res.json({ success: true });
});

// Add comment
router.post('/:id/comments', (req, res) => {
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  const db = getDB();
  logActivity(db, req.params.id, req.user, 'Comment', comment);
  res.json({ success: true });
});

// List followups
router.get('/:id/followups', (req, res) => {
  const db = getDB();
  res.json(db.prepare(`
    SELECT f.*, u.name as created_by_name
    FROM followups f LEFT JOIN users u ON f.created_by = u.id
    WHERE f.inquiry_id = ? ORDER BY f.completed ASC, f.follow_up_date ASC
  `).all(req.params.id));
});

// Add followup
router.post('/:id/followups', (req, res) => {
  const { note, follow_up_date } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'Note is required' });
  const db = getDB();

  const result = db.prepare(
    'INSERT INTO followups (inquiry_id, note, follow_up_date, created_by) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, note, follow_up_date || null, req.user.id);

  logActivity(db, req.params.id, req.user, 'Follow-up added', note);
  res.json({ id: result.lastInsertRowid });
});

// Update followup
router.put('/followups/:id', (req, res) => {
  const { completed, note, follow_up_date } = req.body;
  const db = getDB();
  db.prepare('UPDATE followups SET completed=?, note=?, follow_up_date=? WHERE id=?')
    .run(completed ? 1 : 0, note, follow_up_date || null, req.params.id);
  res.json({ success: true });
});

// Delete followup
router.delete('/followups/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM followups WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Activity log
router.get('/:id/activity', (req, res) => {
  const db = getDB();
  res.json(db.prepare(
    "SELECT * FROM activity_log WHERE entity_type='inquiry' AND entity_id=? ORDER BY created_at DESC"
  ).all(req.params.id));
});

module.exports = router;
