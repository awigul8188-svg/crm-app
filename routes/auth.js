const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'crm-jwt-secret-change-in-prod';

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
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
