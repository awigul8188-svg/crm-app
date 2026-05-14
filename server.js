const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_IPS = (process.env.ALLOWED_IPS || '203.99.187.217').split(',').map(ip => ip.trim());

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress;
}

const BLOCKED_HTML = `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d0d0d;color:white;text-align:center"><div><div style="font-size:48px;margin-bottom:16px">🔒</div><h2 style="color:#00D4C8;margin:0 0 8px">Access Restricted</h2><p style="color:rgba(255,255,255,0.5);margin:0">This app is only accessible from the Tech Atlantix office network.</p></div></body></html>`;

app.use(cors());
app.use(express.json());

// Debug — no IP restriction on this route
app.get('/debug-ip', (req, res) => {
  res.json({
    detected_ip: getClientIP(req),
    x_forwarded_for: req.headers['x-forwarded-for'] || 'none',
    remote_address: req.socket.remoteAddress,
    allowed_ips: ALLOWED_IPS,
  });
});

// IP check function
function checkIP(req, res, next) {
  if (process.env.DISABLE_IP_WHITELIST === 'true') return next();
  const clientIP = getClientIP(req);
  if (ALLOWED_IPS.includes(clientIP)) return next();
  console.log(`Blocked IP: ${clientIP}`);
  res.status(403).send(BLOCKED_HTML);
}

// Apply to ALL routes including static files
app.use(checkIP);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/inquiries', require('./routes/inquiries'));
app.use('/api/analytics', require('./routes/analytics'));

// Static files AFTER the IP check
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

initializeDB();
app.listen(PORT, () => console.log(`CRM running on port ${PORT}`));
