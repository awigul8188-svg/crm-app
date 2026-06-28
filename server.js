const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { initializeDB, runPurchasingMigrations, runPurchasingV2Migrations, runOperationsMigrations, runInquiryViewsMigration, runBuyerMigration, runQuoteEntriesMigration, runImportedFlagMigration, runQuotesMigration } = require('./database');

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
app.use('/api', (req, res, next) => {
  res.header('Content-Type', 'application/json; charset=utf-8');
  next();
});

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
app.use('/api/ringtone', require('./routes/ringtone'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/purchasing', require('./routes/purchasing'));
app.use('/api/operations', require('./routes/operations'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/quotes', require('./routes/quotes'));

// Temporary public debug endpoint — remove after GP investigation
app.get('/api/debug-rep-gp', (req, res) => {
  try {
    const { getDB } = require('./database');
    const db = getDB();
    const period = req.query.period || 'Q2-26';
    const rows = db.prepare(`
      SELECT o.order_number, o.rep,
        ROUND(COALESCE(SUM(i.selling*i.quantity),0)+COALESCE(o.tax_charged,0)+COALESCE(o.shipping_charged,0)
          -COALESCE(SUM(i.buying*i.quantity+i.cc_paid+i.shipping_paid+i.tax_paid+i.duty_paid),0)
          -COALESCE(o.rma_amount,0),2) AS gp,
        ROUND(COALESCE(SUM(i.selling*i.quantity),0),2) AS item_rev,
        ROUND(COALESCE(SUM(i.buying*i.quantity+i.cc_paid+i.shipping_paid+i.tax_paid+i.duty_paid),0),2) AS cost
      FROM op_orders o LEFT JOIN op_order_items i ON i.order_id=o.id
      WHERE o.reporting_period=? AND (o.pending IS NULL OR o.pending=0)
      GROUP BY o.id ORDER BY o.rep, o.order_number
    `).all(period);
    const byRep = {};
    for (const r of rows) {
      if (!byRep[r.rep]) byRep[r.rep] = { total_gp: 0, orders: [] };
      byRep[r.rep].orders.push({ n: r.order_number, gp: r.gp, rev: r.item_rev, cost: r.cost });
      byRep[r.rep].total_gp = +(byRep[r.rep].total_gp + r.gp).toFixed(2);
    }
    res.json(byRep);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));

initializeDB();
runPurchasingMigrations();
runPurchasingV2Migrations();
runOperationsMigrations();
runInquiryViewsMigration();
runBuyerMigration();
runQuoteEntriesMigration();
runImportedFlagMigration();
runQuotesMigration();
server.listen(PORT, () => console.log(`CRM running on port ${PORT}`));
