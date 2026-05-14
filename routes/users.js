const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Get all users (needed for assignment dropdowns)
router.get('/', (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, username, name, role, created_at FROM users ORDER BY name').all();
  res.json(users);
});

// Create user (managers only)
router.post('/', requireManager, (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'username, password, and name are required' });

  const db = getDB();
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare(
      "INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)"
    ).run(username.toLowerCase().trim(), hash, name.trim(), role || 'ae');
    res.json({ id: result.lastInsertRowid, username: username.toLowerCase(), name, role: role || 'ae' });
  } catch {
    res.status(400).json({ error: 'Username already taken' });
  }
});

// Update user (managers only)
router.put('/:id', requireManager, (req, res) => {
  const { name, role, password } = req.body;
  const db = getDB();

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET name = ?, role = ?, password = ? WHERE id = ?').run(name, role, hash, req.params.id);
  } else {
    db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?').run(name, role, req.params.id);
  }

  res.json({ success: true });
});

// Delete user (managers only)
router.delete('/:id', requireManager, (req, res) => {
  const db = getDB();
  // Prevent deleting yourself
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: "You can't delete yourself" });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
