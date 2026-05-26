const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const isManager = (user) => ['manager'].includes(user.role);
const isHR = (user, db) => {
  const p = db.prepare('SELECT nft_role FROM nft_profiles WHERE user_id=?').get(user.id);
  return p?.nft_role === 'hr' || isManager(user);
};
const canManageNFT = (user, db) => isHR(user, db) || isManager(user);

// Multer for NFT uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const nftStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, 'nft');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g,'_')}`)
});
const upload = multer({ storage: nftStorage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ── Profile ────────────────────────────────────────────────
router.get('/profiles', (req, res) => {
  const db = getDB();
  const profiles = db.prepare(`
    SELECT p.*, u.username, u.role as crm_role
    FROM nft_profiles p JOIN users u ON p.user_id = u.id
    ORDER BY p.real_name
  `).all();
  res.json(profiles);
});

router.get('/profiles/me', (req, res) => {
  const db = getDB();
  const p = db.prepare('SELECT p.*, u.username, u.role as crm_role FROM nft_profiles p JOIN users u ON p.user_id=u.id WHERE p.user_id=?').get(req.user.id);
  if (!p) {
    // Auto-create
    db.prepare('INSERT OR IGNORE INTO nft_profiles (user_id, real_name) VALUES (?,?)').run(req.user.id, req.user.name);
    return res.json(db.prepare('SELECT * FROM nft_profiles WHERE user_id=?').get(req.user.id));
  }
  res.json(p);
});

router.get('/profiles/:userId', (req, res) => {
  const db = getDB();
  res.json(db.prepare('SELECT p.*, u.username FROM nft_profiles p JOIN users u ON p.user_id=u.id WHERE p.user_id=?').get(req.params.userId));
});

router.put('/profiles/:userId', (req, res) => {
  const db = getDB();
  const { real_name, job_title, department, phone, hire_date, bio, nft_role } = req.body;
  const target = req.params.userId;
  if (String(target) !== String(req.user.id) && !canManageNFT(req.user, db)) return res.status(403).json({ error: 'Not authorized' });
  db.prepare(`INSERT INTO nft_profiles (user_id, real_name, job_title, department, phone, hire_date, bio, nft_role)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
    real_name=excluded.real_name, job_title=excluded.job_title, department=excluded.department,
    phone=excluded.phone, hire_date=excluded.hire_date, bio=excluded.bio,
    nft_role=COALESCE(excluded.nft_role, nft_role)
  `).run(target, real_name, job_title, department, phone, hire_date, bio, nft_role);
  res.json({ success: true });
});

router.post('/profiles/:userId/photo', upload.single('photo'), (req, res) => {
  const db = getDB();
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/nft/${req.file.filename}`;
  db.prepare('UPDATE nft_profiles SET photo_url=? WHERE user_id=?').run(url, req.params.userId);
  res.json({ url });
});

// ── Salary ─────────────────────────────────────────────────
router.get('/salary', (req, res) => {
  const db = getDB();
  const isAdmin = canManageNFT(req.user, db);
  if (isAdmin) {
    const rows = db.prepare(`SELECT s.*, p.real_name FROM nft_salary s JOIN nft_profiles p ON s.user_id=p.user_id ORDER BY s.month DESC, p.real_name`).all();
    return res.json(rows);
  }
  res.json(db.prepare('SELECT * FROM nft_salary WHERE user_id=? ORDER BY month DESC').all(req.user.id));
});

router.post('/salary', (req, res) => {
  const db = getDB();
  if (!isManager(req.user)) return res.status(403).json({ error: 'Managers only' });
  const { user_id, month, base_salary, bonus, notes } = req.body;
  db.prepare(`INSERT INTO nft_salary (user_id, month, base_salary, bonus, notes, created_by)
    VALUES (?,?,?,?,?,?) ON CONFLICT(user_id, month) DO UPDATE SET base_salary=excluded.base_salary, bonus=excluded.bonus, notes=excluded.notes`
  ).run(user_id, month, base_salary || 0, bonus || 0, notes, req.user.id);
  res.json({ success: true });
});

// Salary deductions (from shop orders)
router.get('/salary/deductions', (req, res) => {
  const db = getDB();
  const userId = canManageNFT(req.user, db) ? (req.query.user_id || req.user.id) : req.user.id;
  const rows = db.prepare(`SELECT o.id, o.total_amount, o.items, o.created_at, o.deduction_status
    FROM nft_shop_orders o WHERE o.user_id=? ORDER BY o.created_at DESC`).all(userId);
  res.json(rows);
});

// ── Targets ────────────────────────────────────────────────
router.get('/targets', (req, res) => {
  const db = getDB();
  const isAdmin = canManageNFT(req.user, db);
  if (isAdmin) return res.json(db.prepare(`SELECT t.*, p.real_name FROM nft_targets t JOIN nft_profiles p ON t.user_id=p.user_id ORDER BY t.quarter DESC, p.real_name`).all());
  res.json(db.prepare('SELECT * FROM nft_targets WHERE user_id=? ORDER BY quarter DESC').all(req.user.id));
});

router.post('/targets', (req, res) => {
  const db = getDB();
  if (!canManageNFT(req.user, db)) return res.status(403).json({ error: 'Not authorized' });
  const { user_id, quarter, sales_target, gp_target, sales_achieved, gp_achieved } = req.body;
  db.prepare(`INSERT INTO nft_targets (user_id, quarter, sales_target, gp_target, sales_achieved, gp_achieved, created_by)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id, quarter) DO UPDATE SET
    sales_target=excluded.sales_target, gp_target=excluded.gp_target,
    sales_achieved=excluded.sales_achieved, gp_achieved=excluded.gp_achieved`
  ).run(user_id, quarter, sales_target||0, gp_target||0, sales_achieved||0, gp_achieved||0, req.user.id);
  res.json({ success: true });
});

// ── BioData ────────────────────────────────────────────────
router.get('/biodata/:userId', (req, res) => {
  const db = getDB();
  const target = parseInt(req.params.userId);
  if (target !== req.user.id && !canManageNFT(req.user, db)) return res.status(403).json({ error: 'Not authorized' });
  res.json(db.prepare('SELECT * FROM nft_biodata WHERE user_id=? ORDER BY created_at DESC').all(target));
});

router.post('/biodata/:userId', upload.single('document'), (req, res) => {
  const db = getDB();
  if (!canManageNFT(req.user, db)) return res.status(403).json({ error: 'HR/Manager only' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/nft/${req.file.filename}`;
  db.prepare('INSERT INTO nft_biodata (user_id, doc_type, doc_name, file_url, file_size, uploaded_by) VALUES (?,?,?,?,?,?)')
    .run(req.params.userId, req.body.doc_type || 'Other', req.body.doc_name || req.file.originalname, url, req.file.size, req.user.id);
  res.json({ success: true, url });
});

router.delete('/biodata/:id', (req, res) => {
  const db = getDB();
  if (!canManageNFT(req.user, db)) return res.status(403).json({ error: 'Not authorized' });
  db.prepare('DELETE FROM nft_biodata WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Kiosk Menu ─────────────────────────────────────────────
router.get('/kiosk/menu', (req, res) => {
  res.json(getDB().prepare('SELECT * FROM nft_kiosk_menu ORDER BY category, name').all());
});

router.post('/kiosk/menu', (req, res) => {
  const db = getDB();
  if (!isManager(req.user) && !['admin'].includes(db.prepare('SELECT nft_role FROM nft_profiles WHERE user_id=?').get(req.user.id)?.nft_role)) return res.status(403).json({ error: 'Not authorized' });
  const { name, category, price, description } = req.body;
  const r = db.prepare('INSERT INTO nft_kiosk_menu (name, category, price, description) VALUES (?,?,?,?)').run(name, category||'Food', price, description);
  res.json({ id: r.lastInsertRowid });
});

router.patch('/kiosk/menu/:id', (req, res) => {
  const db = getDB();
  const { available, name, price, category, description } = req.body;
  if (available !== undefined) db.prepare('UPDATE nft_kiosk_menu SET available=? WHERE id=?').run(available?1:0, req.params.id);
  else db.prepare('UPDATE nft_kiosk_menu SET name=?, price=?, category=?, description=? WHERE id=?').run(name, price, category, description, req.params.id);
  res.json({ success: true });
});

router.delete('/kiosk/menu/:id', (req, res) => {
  getDB().prepare('DELETE FROM nft_kiosk_menu WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Kiosk Orders ───────────────────────────────────────────
router.get('/kiosk/orders', (req, res) => {
  const db = getDB();
  const isAdmin = canManageNFT(req.user, db);
  if (isAdmin) {
    return res.json(db.prepare(`SELECT o.*, p.real_name FROM nft_kiosk_orders o JOIN nft_profiles p ON o.user_id=p.user_id ORDER BY o.created_at DESC LIMIT 100`).all());
  }
  res.json(db.prepare('SELECT * FROM nft_kiosk_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user.id));
});

router.post('/kiosk/orders', (req, res) => {
  const db = getDB();
  const { items, notes } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'No items' });
  const total = items.reduce((s,i) => s + (i.price * i.qty), 0);
  const r = db.prepare('INSERT INTO nft_kiosk_orders (user_id, items, total_amount, notes) VALUES (?,?,?,?)').run(req.user.id, JSON.stringify(items), total, notes);
  res.json({ id: r.lastInsertRowid });
});

router.patch('/kiosk/orders/:id/status', (req, res) => {
  getDB().prepare('UPDATE nft_kiosk_orders SET status=? WHERE id=?').run(req.body.status, req.params.id);
  res.json({ success: true });
});

// ── Shop Products ──────────────────────────────────────────
router.get('/shop/products', (req, res) => {
  res.json(getDB().prepare('SELECT * FROM nft_shop_products ORDER BY category, name').all());
});

router.post('/shop/products', (req, res) => {
  const db = getDB();
  if (!isManager(req.user)) return res.status(403).json({ error: 'Managers only' });
  const { name, description, price, inventory, category } = req.body;
  const r = db.prepare('INSERT INTO nft_shop_products (name, description, price, inventory, category) VALUES (?,?,?,?,?)').run(name, description, price, inventory||0, category||'Merchandise');
  res.json({ id: r.lastInsertRowid });
});

router.put('/shop/products/:id', (req, res) => {
  const db = getDB();
  if (!isManager(req.user)) return res.status(403).json({ error: 'Managers only' });
  const { name, description, price, inventory, category, available } = req.body;
  db.prepare('UPDATE nft_shop_products SET name=?,description=?,price=?,inventory=?,category=?,available=? WHERE id=?').run(name, description, price, inventory, category, available?1:0, req.params.id);
  res.json({ success: true });
});

router.delete('/shop/products/:id', (req, res) => {
  if (!isManager(req.user)) return res.status(403).json({ error: 'Managers only' });
  getDB().prepare('DELETE FROM nft_shop_products WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Shop Orders ────────────────────────────────────────────
router.get('/shop/orders', (req, res) => {
  const db = getDB();
  const isAdmin = canManageNFT(req.user, db);
  if (isAdmin) return res.json(db.prepare(`SELECT o.*, p.real_name FROM nft_shop_orders o JOIN nft_profiles p ON o.user_id=p.user_id ORDER BY o.created_at DESC`).all());
  res.json(db.prepare('SELECT * FROM nft_shop_orders WHERE user_id=? ORDER BY created_at DESC').all(req.user.id));
});

router.post('/shop/orders', (req, res) => {
  const db = getDB();
  const { items } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'No items' });
  const total = items.reduce((s,i) => s + (i.price * i.qty), 0);
  // Check + reduce inventory
  const tx = db.transaction(() => {
    items.forEach(item => {
      const p = db.prepare('SELECT inventory FROM nft_shop_products WHERE id=?').get(item.id);
      if (!p || p.inventory < item.qty) throw new Error(`Insufficient stock for ${item.name}`);
      db.prepare('UPDATE nft_shop_products SET inventory=inventory-? WHERE id=?').run(item.qty, item.id);
    });
    const r = db.prepare('INSERT INTO nft_shop_orders (user_id, items, total_amount) VALUES (?,?,?)').run(req.user.id, JSON.stringify(items), total);
    return r.lastInsertRowid;
  });
  try { const id = tx(); res.json({ id, total }); }
  catch(e) { res.status(400).json({ error: e.message }); }
});

router.patch('/shop/orders/:id', (req, res) => {
  const db = getDB();
  if (!canManageNFT(req.user, db)) return res.status(403).json({ error: 'Not authorized' });
  const { status, deduction_status } = req.body;
  if (status) db.prepare('UPDATE nft_shop_orders SET status=? WHERE id=?').run(status, req.params.id);
  if (deduction_status) db.prepare('UPDATE nft_shop_orders SET deduction_status=? WHERE id=?').run(deduction_status, req.params.id);
  res.json({ success: true });
});

// ── Messages ───────────────────────────────────────────────
router.get('/messages/conversations', (req, res) => {
  const db = getDB();
  const all = db.prepare('SELECT c.*, (SELECT content FROM nft_messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) as last_message, (SELECT created_at FROM nft_messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) as last_at FROM nft_conversations c ORDER BY last_at DESC NULLS LAST').all();
  const mine = all.filter(c => {
    try { const p = JSON.parse(c.participants); return p.includes(req.user.id) || p.includes(String(req.user.id)); }
    catch { return false; }
  });
  // Add participant profiles
  const result = mine.map(c => {
    const participants = JSON.parse(c.participants);
    const profiles = participants.map(uid => db.prepare('SELECT user_id, real_name, photo_url FROM nft_profiles WHERE user_id=?').get(uid)).filter(Boolean);
    return { ...c, profiles };
  });
  res.json(result);
});

router.post('/messages/conversations', (req, res) => {
  const db = getDB();
  const { type, name, participants } = req.body;
  const parts = [...new Set([...participants, req.user.id])];
  // Check existing DM
  if (type === 'dm' && parts.length === 2) {
    const existing = db.prepare('SELECT * FROM nft_conversations WHERE type=?').all('dm');
    const found = existing.find(c => { try { const p = JSON.parse(c.participants); return p.includes(parts[0]) && p.includes(parts[1]); } catch { return false; } });
    if (found) return res.json(found);
  }
  const r = db.prepare('INSERT INTO nft_conversations (type, name, participants, created_by) VALUES (?,?,?,?)').run(type||'dm', name||null, JSON.stringify(parts), req.user.id);
  res.json({ id: r.lastInsertRowid });
});

router.get('/messages/:conversationId', (req, res) => {
  const db = getDB();
  const msgs = db.prepare(`SELECT m.*, p.real_name, p.photo_url FROM nft_messages m JOIN nft_profiles p ON m.sender_id=p.user_id WHERE m.conversation_id=? ORDER BY m.created_at ASC LIMIT 100`).all(req.params.conversationId);
  res.json(msgs);
});

router.post('/messages/:conversationId', upload.single('file'), (req, res) => {
  const db = getDB();
  const { content } = req.body;
  let file_url = null, file_name = null, file_size = 0;
  if (req.file) {
    file_url = `/uploads/nft/${req.file.filename}`;
    file_name = req.file.originalname;
    file_size = req.file.size;
  }
  if (!content && !file_url) return res.status(400).json({ error: 'Message or file required' });
  const r = db.prepare('INSERT INTO nft_messages (conversation_id, sender_id, content, file_url, file_name, file_size) VALUES (?,?,?,?,?,?)')
    .run(req.params.conversationId, req.user.id, content||null, file_url, file_name, file_size);
  const msg = db.prepare('SELECT m.*, p.real_name, p.photo_url FROM nft_messages m JOIN nft_profiles p ON m.sender_id=p.user_id WHERE m.id=?').get(r.lastInsertRowid);
  res.json(msg);
});

// ── News ───────────────────────────────────────────────────
router.get('/news', (req, res) => {
  const db = getDB();
  res.json(db.prepare(`SELECT n.*, p.real_name, p.photo_url as author_photo FROM nft_news n JOIN nft_profiles p ON n.author_id=p.user_id ORDER BY n.created_at DESC`).all());
});

router.post('/news', upload.single('image'), (req, res) => {
  const db = getDB();
  if (!canManageNFT(req.user, db)) return res.status(403).json({ error: 'HR/Manager only' });
  const { title, content } = req.body;
  const image_url = req.file ? `/uploads/nft/${req.file.filename}` : null;
  const r = db.prepare('INSERT INTO nft_news (title, content, image_url, author_id) VALUES (?,?,?,?)').run(title, content, image_url, req.user.id);
  res.json({ id: r.lastInsertRowid });
});

router.delete('/news/:id', (req, res) => {
  const db = getDB();
  if (!canManageNFT(req.user, db)) return res.status(403).json({ error: 'Not authorized' });
  db.prepare('DELETE FROM nft_news WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Cars ───────────────────────────────────────────────────
router.get('/cars', (req, res) => {
  const db = getDB();
  const cars = db.prepare('SELECT * FROM nft_cars ORDER BY sort_order, required_sales_target').all();
  const assignments = db.prepare(`SELECT a.*, p.real_name, c.name as car_name FROM nft_car_assignments a JOIN nft_profiles p ON a.user_id=p.user_id JOIN nft_cars c ON a.car_id=c.id`).all();
  res.json({ cars, assignments });
});

module.exports = router;
