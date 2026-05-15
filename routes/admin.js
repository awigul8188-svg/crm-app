const express = require('express');
const { getDB } = require('../database');

const router = express.Router();

// Verify admin key on every request
router.use((req, res, next) => {
  const key = req.headers['x-admin-key'] || req.body?.key;
  const validKey = process.env.ADMIN_KEY;

  if (!validKey) return res.status(503).json({ error: 'Admin access not configured' });
  if (!key || key !== validKey) return res.status(401).json({ error: 'Invalid admin key' });
  next();
});

// GET /api/admin/schema — returns full DB schema so Claude understands the data
router.get('/schema', (req, res) => {
  const db = getDB();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  const schema = {};
  for (const { name } of tables) {
    schema[name] = db.prepare(`PRAGMA table_info(${name})`).all();
  }
  res.json({ schema, tables: tables.map(t => t.name) });
});

// POST /api/admin/query — run any SELECT query
router.post('/query', (req, res) => {
  const { sql, params = [] } = req.body;
  if (!sql) return res.status(400).json({ error: 'sql is required' });

  // Only allow SELECT — no mutations through this endpoint
  const normalized = sql.trim().toLowerCase();
  if (!normalized.startsWith('select') && !normalized.startsWith('with')) {
    return res.status(400).json({ error: 'Only SELECT queries are allowed' });
  }

  try {
    const db = getDB();
    const rows = db.prepare(sql).all(...params);
    res.json({ rows, count: rows.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/admin/stats — quick summary of everything
router.get('/stats', (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];

  const stats = {
    leads:          db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='lead'").get().c,
    repeat:         db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='repeat'").get().c,
    online_orders:  db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='online_order'").get().c,
    customers:      db.prepare("SELECT COUNT(*) as c FROM customers").get().c,
    users:          db.prepare("SELECT COUNT(*) as c FROM users").get().c,
    today_leads:    db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='lead' AND date(created_at)=?").get(today).c,
    today_repeat:   db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='repeat' AND date(created_at)=?").get(today).c,
    today_orders:   db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='online_order' AND date(created_at)=?").get(today).c,
    pending_followups: db.prepare("SELECT COUNT(*) as c FROM followups WHERE completed=0").get().c,
    overdue_followups: db.prepare("SELECT COUNT(*) as c FROM followups WHERE completed=0 AND follow_up_date < ?").get(today).c,
    by_disposition: db.prepare("SELECT disposition, COUNT(*) as count FROM inquiries GROUP BY disposition ORDER BY count DESC").all(),
    by_person:      db.prepare("SELECT u.name, COUNT(*) as count FROM inquiries i JOIN users u ON i.assigned_to=u.id GROUP BY i.assigned_to ORDER BY count DESC").all(),
    unread_notifications: db.prepare("SELECT COUNT(*) as c FROM notifications WHERE read=0").get().c,
  };

  res.json(stats);
});

module.exports = router;
