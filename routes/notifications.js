const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/notifications ──────────────────────────────────────
// Role-filtered: each user sees only their relevant notifications
router.get('/', (req, res) => {
  const db = getDB();
  const { page = 1, unread_only } = req.query;
  const userId = req.user.id;
  const role   = req.user.role;
  const limit  = 50;
  const offset = (parseInt(page) - 1) * limit;

  let typeFilter = '';
  // Purchasers only see part assignment / quote notifications
  if (role === 'purchaser') {
    typeFilter = `AND n.inquiry_type IN ('part_assigned','part_reassigned','quote')`;
  }
  // PM sees new inquiries + unassigned + quote notifications
  else if (role === 'purchasing_manager') {
    typeFilter = `AND n.inquiry_type IN ('lead','repeat','online_order','quote','part_assigned','Closed Won','Processed')`;
  }
  // AEs see their own inquiry notifications
  else if (role === 'ae') {
    typeFilter = `AND n.inquiry_type NOT IN ('part_assigned','part_reassigned')`;
  }
  // Managers see everything

  const unreadFilter = unread_only === 'true' ? 'AND n.read=0' : '';

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM notifications n
    WHERE n.user_id=? ${typeFilter} ${unreadFilter}
  `).get(userId).c;

  const rows = db.prepare(`
    SELECT n.* FROM notifications n
    WHERE n.user_id=? ${typeFilter} ${unreadFilter}
    ORDER BY n.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).all(userId);

  res.json({ notifications: rows, total, pages: Math.ceil(total / limit), unread: db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND read=0 ${typeFilter}`).get(userId).c });
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

// ── PATCH /api/notifications/read-all ──────────────────────────
router.patch('/read-all', (req, res) => {
  getDB().prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(req.user.id);
  res.json({ success: true });
});

// ── DELETE /api/notifications/:id ──────────────────────────────
router.delete('/:id', (req, res) => {
  getDB().prepare('DELETE FROM notifications WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ── PATCH /api/notifications/followup/:id/complete (legacy) ────
router.patch('/followup/:id/complete', (req, res) => {
  try {
    getDB().prepare('UPDATE inquiry_followups SET completed=1 WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.json({ success: true }); }
});

module.exports = router;
