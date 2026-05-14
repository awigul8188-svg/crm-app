const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDB();
  const userId = req.user.role === 'ae' ? req.user.id : null;
  const userFilter = userId ? 'AND i.assigned_to = ?' : '';
  const params = userId ? [userId] : [];

  const today = new Date().toISOString().split('T')[0];
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const base = `
    SELECT f.id, f.note, f.follow_up_date, f.inquiry_id,
      i.type as inquiry_type, i.assigned_to,
      c.name as customer_name, c.company as customer_company,
      u.name as assigned_name
    FROM followups f
    JOIN inquiries i ON f.inquiry_id = i.id
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN users u ON i.assigned_to = u.id
    WHERE f.completed = 0 ${userFilter}
  `;

  const overdue   = db.prepare(`${base} AND f.follow_up_date < ? ORDER BY f.follow_up_date ASC LIMIT 50`).all(...params, today);
  const dueToday  = db.prepare(`${base} AND f.follow_up_date = ? ORDER BY f.id ASC LIMIT 50`).all(...params, today);
  const upcoming  = db.prepare(`${base} AND f.follow_up_date > ? AND f.follow_up_date <= ? ORDER BY f.follow_up_date ASC LIMIT 50`).all(...params, today, in7days);

  res.json({
    overdue,
    today: dueToday,
    upcoming,
    total: overdue.length + dueToday.length + upcoming.length,
  });
});

// Mark a follow-up complete from notification
router.patch('/:id/complete', (req, res) => {
  const db = getDB();
  db.prepare('UPDATE followups SET completed = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
