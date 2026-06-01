const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Role-based type filter
function typeFilter(role) {
  if (role === 'purchaser')          return `AND n.inquiry_type IN ('part_assigned','part_reassigned','quote')`;
  if (role === 'purchasing_manager') return `AND n.inquiry_type IN ('lead','repeat','online_order','quote','part_assigned','Closed Won','Processed')`;
  if (role === 'ae')                 return `AND n.inquiry_type NOT IN ('part_assigned','part_reassigned')`;
  return ''; // manager sees all
}

// ── GET /api/notifications ──────────────────────────────────────
router.get('/', (req, res) => {
  const db = getDB();
  const { page = 1, unread_only } = req.query;
  const userId = req.user.id;
  const limit  = 50;
  const offset = (parseInt(page) - 1) * limit;
  const tf = typeFilter(req.user.role);
  const unreadFilter = unread_only === 'true' ? 'AND n.read=0' : '';

  const total = db.prepare(`SELECT COUNT(*) as c FROM notifications n WHERE n.user_id=? ${tf} ${unreadFilter}`).get(userId).c;
  const rows  = db.prepare(`SELECT n.* FROM notifications n WHERE n.user_id=? ${tf} ${unreadFilter} ORDER BY n.created_at DESC LIMIT ${limit} OFFSET ${offset}`).all(userId);
  const unread = db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND read=0 ${tf}`).get(userId).c;

  res.json({ notifications: rows, total, pages: Math.ceil(total / limit), unread });
});

// ── GET /api/notifications/count ───────────────────────────────
router.get('/count', (req, res) => {
  const db = getDB();
  const tf = typeFilter(req.user.role);
  const count = db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND read=0 ${tf}`).get(req.user.id).c;
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
  try { db.prepare('UPDATE inquiry_followups SET completed=1 WHERE id=?').run(req.params.id); } catch(e) {}
  res.json({ success: true });
});

module.exports = router;
