const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Generate a random strong password
function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 5; i++) pwd += all[Math.floor(Math.random() * all.length)];
  // Shuffle
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

router.get('/', (req, res) => {
  const db = getDB();
  try {
    res.json(db.prepare('SELECT id, username, name, role, created_at FROM users ORDER BY role DESC, name').all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireManager, (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'username, password, and name are required' });
  const db = getDB();
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)").run(username.toLowerCase().trim(), hash, name.trim(), role || 'ae');
    res.json({ id: result.lastInsertRowid, username: username.toLowerCase(), name, role: role || 'ae' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Username already taken' });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

router.put('/:id', requireManager, (req, res) => {
  const { name, role, password } = req.body;
  const db = getDB();
  try {
    if (password) {
      db.prepare('UPDATE users SET name=?, role=?, password=? WHERE id=?').run(name, role, bcrypt.hashSync(password, 10), req.params.id);
    } else {
      db.prepare('UPDATE users SET name=?, role=? WHERE id=?').run(name, role, req.params.id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', requireManager, (req, res) => {
  const db = getDB();
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: "Can't delete yourself" });
  try {
    db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset all AE passwords to random — managers only
router.post('/reset-ae-passwords', requireManager, (req, res) => {
  const db = getDB();
  try {
    const aes = db.prepare("SELECT id, name, username FROM users WHERE role = 'ae' ORDER BY name").all();
    if (!aes.length) return res.json({ results: [] });

    const results = [];
    db.transaction(() => {
      aes.forEach(ae => {
        const newPassword = generatePassword();
        const hash = bcrypt.hashSync(newPassword, 10);
        db.prepare('UPDATE users SET password=? WHERE id=?').run(hash, ae.id);
        results.push({ id: ae.id, name: ae.name, username: ae.username, password: newPassword });
      });
    })();

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;