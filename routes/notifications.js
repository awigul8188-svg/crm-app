const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get all notifications for current user
router.get('/', (req, res) => {
  const db = getDB();
  // purchaser/buyer have no CRM follow-ups/activity here (they use their own dashboards). Everyone
  // else (manager, purchasing_manager, ae) gets the CRM feed below.
  if (['purchaser', 'buyer'].includes(req.user.role)) {
    return res.json({ followups: { overdue: [], today: [], upcoming: [] }, activity: [], total: 0, unreadActivity: 0 });
  }
  const userId = req.user.role === 'ae' ? req.user.id : null;
  const userFilter = userId ? 'AND i.assigned_to = ?' : '';
  const params = userId ? [userId] : [];

  const today = new Date().toISOString().split('T')[0];
  const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const base = `
    SELECT f.id, f.note, f.follow_up_date, f.inquiry_id,
      i.type as inquiry_type, c.name as customer_name, c.company as customer_company,
      u.name as assigned_name
    FROM followups f
    JOIN inquiries i ON f.inquiry_id = i.id
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN users u ON i.assigned_to = u.id
    WHERE f.completed = 0 ${userFilter}
  `;

  try {
    const overdue  = db.prepare(`${base} AND f.follow_up_date < ? ORDER BY f.follow_up_date ASC LIMIT 50`).all(...params, today);
    const dueToday = db.prepare(`${base} AND f.follow_up_date = ? ORDER BY f.id ASC LIMIT 50`).all(...params, today);
    const upcoming = db.prepare(`${base} AND f.follow_up_date > ? AND f.follow_up_date <= ? ORDER BY f.follow_up_date ASC LIMIT 50`).all(...params, today, in7days);

    // Activity notifications — manager-level (manager + purchasing_manager) get all of theirs; AEs get
    // theirs too. Only QUOTE notifications surface here now — generic lead/repeat/order activity
    // (creates, disposition changes, comments) is shown ONLY on the record's own page, not in notifications.
    let activity = [];
    let unreadActivity = 0;
    if (['manager', 'purchasing_manager', 'ae'].includes(req.user.role)) {
      activity = db.prepare(`
        SELECT n.*, '$' as type_icon
        FROM notifications n
        WHERE n.user_id = ? AND n.inquiry_type = 'quote'
        ORDER BY n.created_at DESC
        LIMIT 100
      `).all(req.user.id);
      unreadActivity = activity.filter(n => !n.read).length;
    }

    const followupCount = overdue.length + dueToday.length + upcoming.length;

    res.json({
      followups: { overdue, today: dueToday, upcoming },
      activity,
      total: followupCount + unreadActivity,
      unreadActivity,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark a single notification as read
router.patch('/:id/read', (req, res) => {
  const db = getDB();
  try {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark all activity notifications as read
router.post('/read-all', (req, res) => {
  const db = getDB();
  try {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark a follow-up complete
router.patch('/followup/:id/complete', (req, res) => {
  const db = getDB();
  try {
    db.prepare('UPDATE followups SET completed = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;