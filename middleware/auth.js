const jwt = require('jsonwebtoken');

// SECURITY: Fail hard if JWT_SECRET is not configured
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ FATAL ERROR: JWT_SECRET environment variable is not set!');
  console.error('Set JWT_SECRET in your .env file or environment before running the app.');
  process.exit(1);
}

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

// Manager-level roles. purchasing_manager is treated as a full manager (same access as manager).
const MANAGER_ROLES = ['manager', 'purchasing_manager'];
function requireManager(req, res, next) {
  if (!MANAGER_ROLES.includes(req.user?.role)) return res.status(403).json({ error: 'Managers only' });
  next();
}

// CRM data (customers, inquiries/leads/repeat/online-orders, analytics). Manager-level + AE.
// Whitelist (not blacklist) so any future role is denied by default.
const CRM_ROLES = ['manager', 'purchasing_manager', 'ae'];
function requireCrmAccess(req, res, next) {
  if (CRM_ROLES.includes(req.user?.role)) return next();
  return res.status(403).json({ error: 'Not authorized for CRM data' });
}

module.exports = { authenticate, requireManager, requireCrmAccess, CRM_ROLES, MANAGER_ROLES, JWT_SECRET };
