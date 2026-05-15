const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'crm-jwt-secret-change-in-prod';

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify token_version — if password was reset, old tokens are rejected
    const { getDB } = require('../database');
    const user = getDB().prepare('SELECT token_version FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });

    if ((decoded.token_version || 1) !== (user.token_version || 1)) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireManager(req, res, next) {
  if (req.user?.role !== 'manager') return res.status(403).json({ error: 'Managers only' });
  next();
}

module.exports = { authenticate, requireManager, JWT_SECRET };
