const express = require('express');
const { getDB } = require('../database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// AE polls this to check if their ringtone should be playing
// GET /api/ringtone/status
router.get('/status', (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT ringtone_active, ringtone_url FROM users WHERE id = ?').get(req.user.id);
  res.json({
    active: !!(user?.ringtone_active),
    url: user?.ringtone_url || null,
  });
});

// Manager plays ringtone for a specific AE
// POST /api/ringtone/:userId/play
router.post('/:userId/play', requireManager, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT ringtone_url FROM users WHERE id = ?').get(req.params.userId);
  if (!user?.ringtone_url) return res.status(400).json({ error: 'No ringtone uploaded for this user' });
  db.prepare('UPDATE users SET ringtone_active = 1 WHERE id = ?').run(req.params.userId);
  res.json({ success: true });
});

// Manager stops ringtone for a specific AE
// POST /api/ringtone/:userId/stop
router.post('/:userId/stop', requireManager, (req, res) => {
  const db = getDB();
  db.prepare('UPDATE users SET ringtone_active = 0 WHERE id = ?').run(req.params.userId);
  res.json({ success: true });
});

// Manager stops ALL ringtones
// POST /api/ringtone/stop-all
router.post('/stop-all', requireManager, (req, res) => {
  getDB().prepare("UPDATE users SET ringtone_active = 0 WHERE role = 'ae'").run();
  res.json({ success: true });
});

// Get ringtone status for all AEs (for manager view)
// GET /api/ringtone/all
router.get('/all', requireManager, (req, res) => {
  const db = getDB();
  const users = db.prepare("SELECT id, name, ringtone_url, ringtone_active FROM users WHERE role = 'ae'").all();
  res.json(users);
});

module.exports = router;
