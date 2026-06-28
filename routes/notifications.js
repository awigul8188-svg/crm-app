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
    // Quote notifications surface here for manager/PM/AE. The purchasing_manager ALSO gets the
    // new-parts-to-assign notifications ('*_parts') — those feed the PM dashboard "New Parts" tab.
    // Generic lead/repeat/order activity (creates, disposition changes, comments) is NOT shown in
    // notifications for anyone — only on the record's own page.
    let activity = [];
    let unreadActivity = 0;
    if (['manager', 'purchasing_manager', 'ae'].includes(req.user.role)) {
      const typeCond = ['manager', 'purchasing_manager'].includes(req.user.role)
        ? "(n.inquiry_type = 'quote' OR n.inquiry_type IN ('lead_parts','repeat_parts','online_order_parts'))"
        : "n.inquiry_type = 'quote'";
      activity = db.prepare(`
        SELECT n.*, CASE WHEN n.inquiry_type = 'quote' THEN '$' ELSE '📦' END as type_icon
        FROM notifications n
        WHERE n.user_id = ? AND ${typeCond}
        -- Hide *_parts notifications whose inquiry was deleted (defends against orphans).
        AND (n.inquiry_type = 'quote' OR n.inquiry_id IS NULL OR EXISTS (SELECT 1 FROM inquiries i2 WHERE i2.id = n.inquiry_id))
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

// Mark a follow-up complete. Only a manager, the inquiry's assignee, or the follow-up's
// creator may complete it — previously any authenticated user could complete any follow-up by id.
router.patch('/followup/:id/complete', (req, res) => {
  const db = getDB();
  try {
    const fu = db.prepare('SELECT f.created_by, i.assigned_to FROM followups f JOIN inquiries i ON f.inquiry_id = i.id WHERE f.id = ?').get(req.params.id);
    if (!fu) return res.status(404).json({ error: 'Follow-up not found' });
    const isManager = ['manager', 'purchasing_manager'].includes(req.user.role);
    if (!isManager && fu.assigned_to !== req.user.id && fu.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not your follow-up' });
    }
    db.prepare('UPDATE followups SET completed = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;