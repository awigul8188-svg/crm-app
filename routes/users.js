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
    res.json(db.prepare(`
      SELECT u.id, u.username, u.name, u.role, u.created_at, u.avatar AS avatar_url,
        u.created_by, c.name AS created_by_name
      FROM users u LEFT JOIN users c ON u.created_by = c.id
      ORDER BY u.role DESC, u.name
    `).all());
  } catch (err) {
    // Resilient fallback if created_by/avatar columns aren't present yet — never blank the page.
    try {
      res.json(db.prepare('SELECT id, username, name, role, created_at FROM users ORDER BY role DESC, name').all());
    } catch (e2) {
      res.status(500).json({ error: e2.message });
    }
  }
});

router.post('/', requireManager, (req, res) => {
  const { username, password, name, role } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'username, password, and name are required' });
  const db = getDB();
  const hash = bcrypt.hashSync(password, 10);
  const uname = username.toLowerCase().trim();
  try {
    let result;
    try {
      result = db.prepare("INSERT INTO users (username, password, name, role, created_by) VALUES (?, ?, ?, ?, ?)").run(uname, hash, name.trim(), role || 'ae', req.user.id);
    } catch (e) {
      if (/created_by|no column/i.test(e.message)) {
        result = db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)").run(uname, hash, name.trim(), role || 'ae');
      } else throw e;
    }
    res.json({ id: result.lastInsertRowid, username: uname, name, role: role || 'ae' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Username already taken' });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

router.put('/:id', requireManager, (req, res) => {
  const { name, role, password, username } = req.body;
  const db = getDB();
  const sets = [], params = [];
  if (name !== undefined) { sets.push('name=?'); params.push(String(name).trim()); }
  if (role !== undefined) { sets.push('role=?'); params.push(role); }
  if (username !== undefined && username !== null && String(username).trim()) { sets.push('username=?'); params.push(String(username).toLowerCase().trim()); }
  if (password) { sets.push('password=?'); params.push(bcrypt.hashSync(password, 10)); }
  if (!sets.length) return res.json({ success: true });
  params.push(req.params.id);
  try {
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id=?`).run(...params);
    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
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

// Reset every password for a role to a fresh random one; returns the plaintext list once.
function resetPasswordsForRole(db, role) {
  const targets = db.prepare("SELECT id, name, username FROM users WHERE role = ? ORDER BY name").all(role);
  const results = [];
  db.transaction(() => {
    targets.forEach(t => {
      const newPassword = generatePassword();
      db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(newPassword, 10), t.id);
      results.push({ id: t.id, name: t.name, username: t.username, password: newPassword });
    });
  })();
  return results;
}

// Reset all AE passwords — managers only
router.post('/reset-ae-passwords', requireManager, (req, res) => {
  try {
    res.json({ results: resetPasswordsForRole(getDB(), 'ae') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset all Purchaser passwords — managers and purchasing managers
router.post('/reset-purchaser-passwords', (req, res) => {
  if (!['manager', 'purchasing_manager'].includes(req.user.role)) return res.status(403).json({ error: 'Not authorized' });
  try {
    res.json({ results: resetPasswordsForRole(getDB(), 'purchaser') });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Username base from a buyer/full name: first word, lowercased, alphanumeric only.
function firstNameUsername(name) {
  return String(name || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Distinct Operations buyers + a proposed purchaser username + whether one already exists.
router.get('/buyer-candidates', requireManager, (req, res) => {
  const db = getDB();
  try {
    const buyers = db.prepare("SELECT DISTINCT TRIM(buyer) AS buyer FROM op_orders WHERE buyer IS NOT NULL AND TRIM(buyer) <> '' ORDER BY buyer COLLATE NOCASE").all();
    const usernames = new Set(db.prepare('SELECT LOWER(username) AS u FROM users').all().map(r => r.u));
    // Match against ALL users by name (not just purchasers) so e.g. Abdul (purchasing_manager) is
    // recognized as already existing and isn't offered for purchaser creation.
    const allNames = new Set(db.prepare('SELECT LOWER(name) AS n FROM users').all().map(r => r.n));
    res.json(buyers.map(b => {
      const username = firstNameUsername(b.buyer);
      const exists = allNames.has(b.buyer.toLowerCase()) || usernames.has(username);
      return { buyer: b.buyer, username, exists };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk-create purchaser accounts from selected buyer names. username = first name (deduped),
// password = username + '123'. Returns the credential list once.
router.post('/create-from-buyers', requireManager, (req, res) => {
  const { buyers } = req.body;
  if (!Array.isArray(buyers) || !buyers.length) return res.status(400).json({ error: 'buyers array required' });
  const db = getDB();
  try {
    const taken = new Set(db.prepare('SELECT LOWER(username) AS u FROM users').all().map(r => r.u));
    const results = [];
    db.transaction(() => {
      buyers.forEach(raw => {
        const name = String(raw || '').trim();
        if (!name) return;
        let base = firstNameUsername(name) || 'buyer';
        let username = base, n = 1;
        while (taken.has(username)) { n++; username = base + n; }
        taken.add(username);
        const password = username + '123';
        const hash = bcrypt.hashSync(password, 10);
        try {
          db.prepare("INSERT INTO users (username, password, name, role, created_by) VALUES (?, ?, ?, 'purchaser', ?)").run(username, hash, name, req.user.id);
        } catch (e) {
          db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, 'purchaser')").run(username, hash, name);
        }
        results.push({ name, username, password });
      });
    })();
    res.json({ results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;