const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// \u2500\u2500 Rate limiter (no extra packages needed) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Tracks failed attempts per IP in memory
const attempts = new Map(); // ip -> { count, firstAttempt }

const WINDOW_MS  = 15 * 60 * 1000; // 15 minutes
const MAX_FAILS  = 10;              // max failed attempts per window

function getRateLimit(ip) {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    return { blocked: false, remaining: MAX_FAILS };
  }
  return {
    blocked: record.count >= MAX_FAILS,
    remaining: Math.max(0, MAX_FAILS - record.count),
    resetsIn: Math.ceil((WINDOW_MS - (now - record.firstAttempt)) / 60000),
  };
}

function recordFailure(ip) {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    record.count++;
  }
}

function clearFailures(ip) {
  attempts.delete(ip);
}

// Clean up old entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of attempts.entries()) {
    if (now - record.firstAttempt > WINDOW_MS) attempts.delete(ip);
  }
}, 30 * 60 * 1000);
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  // Get real IP (behind Render proxy)
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  // Check rate limit
  const limit = getRateLimit(ip);
  if (limit.blocked) {
    console.log(`Rate limit hit for IP: ${ip}`);
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${limit.resetsIn} minute${limit.resetsIn !== 1 ? 's' : ''}.`
    });
  }

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    recordFailure(ip);
    const updated = getRateLimit(ip);
    const remaining = updated.remaining;
    return res.status(401).json({
      error: remaining > 0
        ? `Invalid username or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : `Too many failed attempts. Try again in 15 minutes.`
    });
  }

  // Success \u2014 clear failed attempts for this IP
  clearFailures(ip);

  const token = jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

router.get('/me', authenticate, (req, res) => {
  res.json(req.user);
});

module.exports = router;
