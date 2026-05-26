const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { initializeDB, runPurchasingMigrations, runPurchasingV2Migrations, runNFTMigrations } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Upload directory on persistent disk
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
['avatars', 'ringtones'].forEach(sub => {
  const dir = path.join(UPLOAD_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const ALLOWED_IPS = (process.env.ALLOWED_IPS || '203.99.187.217').split(',').map(ip => ip.trim());
const DISABLED = process.env.DISABLE_IP_WHITELIST === 'true';
const BLOCKED_HTML = `<!DOCTYPE html><html><head><title>Access Restricted</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d0d0d;color:white;text-align:center"><div><div style="font-size:48px;margin-bottom:16px">🔒</div><h2 style="color:#00D4C8;margin:0 0 8px">Access Restricted</h2><p style="color:rgba(255,255,255,0.5);margin:0">Only accessible from the Tech Atlantix office.</p></div></body></html>`;

const server = http.createServer((req, res) => {
  if (req.url === '/debug-ip') {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detected_ip: ip, allowed_ips: ALLOWED_IPS, disabled: DISABLED }));
    return;
  }
  if (!DISABLED) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.socket.remoteAddress;
    if (!ALLOWED_IPS.includes(ip)) {
      res.writeHead(403, { 'Content-Type': 'text/html' });
      res.end(BLOCKED_HTML);
      return;
    }
  }
  app(req, res);
});

app.use(cors());
app.use(express.json());

// Serve uploaded files (avatars, ringtones)
app.use('/uploads', express.static(UPLOAD_DIR));

// Make upload dir available to routes
app.set('uploadDir', UPLOAD_DIR);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/inquiries', require('./routes/inquiries'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/import', require('./routes/import'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/purchasing', require('./routes/purchasing'));
app.use('/api/nft', require('./routes/nft'));
app.use('/api/ringtone', require('./routes/ringtone'));
app.use('/api/upload', require('./routes/upload'));

const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));

initializeDB();
runPurchasingMigrations();
runPurchasingV2Migrations();
runNFTMigrations();
server.listen(PORT, () => console.log(`CRM running on port ${PORT}`));
