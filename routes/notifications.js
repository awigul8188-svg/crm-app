const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/notifications ──────────────────────────────────────
// Returns shape Notifications.jsx expects:
// { activity: [...], followups: { overdue, today, upcoming } }
router.get('/', (req, res) => {
  const db = getDB();
  const userId = req.user.id;
  const role   = req.user.role;
  const today  = new Date().toISOString().split('T')[0];

  // Role-based notification type filter for activity feed
  let typeFilter = '';
  if (role === 'purchaser')          typeFilter = `AND inquiry_type IN ('part_assigned','part_reassigned','quote')`;
  else if (role === 'purchasing_manager') typeFilter = `AND inquiry_type IN ('lead','repeat','online_order','quote','part_assigned','Closed Won','Processed')`;
  else if (role === 'ae')            typeFilter = `AND inquiry_type NOT IN ('part_assigned','part_reassigned')`;
  // manager sees all

  // Activity/notifications feed
  const activity = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id=? ${typeFilter}
    ORDER BY created_at DESC LIMIT 100
  `).all(userId);

  // Follow-ups (from followups table, linked to user's inquiries)
  let overdue = [], todayFU = [], upcoming = [];
  try {
    const fuBase = role === 'manager'
      ? `SELECT f.*, c.name as customer_name, c.company as customer_company, i.type as inquiry_type, ae.name as assigned_name
         FROM followups f
         JOIN inquiries i ON f.inquiry_id=i.id
         JOIN customers c ON i.customer_id=c.id
         LEFT JOIN users ae ON i.assigned_to=ae.id
         WHERE f.completed=0`
      : `SELECT f.*, c.name as customer_name, c.company as customer_company, i.type as inquiry_type, ae.name as assigned_name
         FROM followups f
         JOIN inquiries i ON f.inquiry_id=i.id
         JOIN customers c ON i.customer_id=c.id
         LEFT JOIN users ae ON i.assigned_to=ae.id
         WHERE f.completed=0 AND i.assigned_to=?`;

    const params = role === 'manager' ? [] : [userId];

    overdue  = db.prepare(`${fuBase} AND date(f.follow_up_date) < ? ORDER BY f.follow_up_date ASC LIMIT 20`).all(...params, today);
    todayFU  = db.prepare(`${fuBase} AND date(f.follow_up_date) = ? ORDER BY f.follow_up_date ASC`).all(...params, today);
    upcoming = db.prepare(`${fuBase} AND date(f.follow_up_date) > ? AND date(f.follow_up_date) <= date(?, '+7 days') ORDER BY f.follow_up_date ASC LIMIT 20`).all(...params, today, today);
  } catch(e) {
    // followups table may not exist yet
  }

  res.json({
    activity,
    followups: { overdue, today: todayFU, upcoming },
  });
});

// ── GET /api/notifications/count ───────────────────────────────
router.get('/count', (req, res) => {
  const db = getDB();
  const userId = req.user.id;
  const role   = req.user.role;
  let typeFilter = '';
  if (role === 'purchaser')          typeFilter = `AND inquiry_type IN ('part_assigned','part_reassigned','quote')`;
  else if (role === 'purchasing_manager') typeFilter = `AND inquiry_type IN ('lead','repeat','online_order','quote','part_assigned','Closed Won','Processed')`;
  else if (role === 'ae')            typeFilter = `AND inquiry_type NOT IN ('part_assigned','part_reassigned')`;
  const count = db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND read=0 ${typeFilter}`).get(userId).c;
  res.json({ count });
});

// ── PATCH /api/notifications/:id/read ──────────────────────────
router.patch('/:id/read', (req, res) => {
  getDB().prepare('UPDATE notifications SET read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ── POST /api/notifications/read-all  (api.js uses POST) ───────
// ── PATCH /api/notifications/read-all (also support PATCH) ─────
const readAll = (req, res) => {
  getDB().prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(req.user.id);
  res.json({ success: true });
};
router.post('/read-all',  readAll);
router.patch('/read-all', readAll);

// ── DELETE /api/notifications/:id ──────────────────────────────
router.delete('/:id', (req, res) => {
  getDB().prepare('DELETE FROM notifications WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ── PATCH /api/notifications/followup/:id/complete (legacy) ────
router.patch('/followup/:id/complete', (req, res) => {
  const db = getDB();
  try { db.prepare('UPDATE followups SET completed=1 WHERE id=?').run(req.params.id); } catch(e) {}
  res.json({ success: true });
});

module.exports = router;
