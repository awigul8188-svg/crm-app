const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'nft_secret_key';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_MSG_FILE = 5 * 1024 * 1024;   // 5MB

// Multer setup
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const nftStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, 'nft');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g,'_')}`)
});
const upload = multer({ storage: nftStorage, limits: { fileSize: MAX_FILE_SIZE } });
const msgUpload = multer({ storage: nftStorage, limits: { fileSize: MAX_MSG_FILE } });

// NFT Auth middleware
const authNFT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'NFT authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'nft') return res.status(401).json({ error: 'Invalid NFT token' });
    const user = getDB().prepare('SELECT id, username, real_name, role, job_title, department, photo_url, token_version FROM nft_users WHERE id=?').get(payload.id);
    if (!user || user.token_version !== payload.tv) return res.status(401).json({ error: 'Session expired' });
    req.nftUser = user;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
};

const isManager  = (u) => u.role === 'manager';
const isHR       = (u) => ['manager','hr'].includes(u.role);
const isFinance  = (u) => ['manager','finance'].includes(u.role);
const isAdmin    = (u) => ['manager','admin'].includes(u.role);
const canSeeAll  = (u) => ['manager','hr','finance'].includes(u.role);

// ── AUTH ────────────────────────────────────────────────────
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const db = getDB();
  const user = db.prepare('SELECT * FROM nft_users WHERE username=?').get(username.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, role: user.role, real_name: user.real_name, type: 'nft', tv: user.token_version }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id:user.id, username:user.username, real_name:user.real_name, role:user.role, job_title:user.job_title, photo_url:user.photo_url } });
});

router.get('/auth/me', authNFT, (req, res) => res.json(req.nftUser));

// ── USER MANAGEMENT (Manager only) ─────────────────────────
router.get('/users', authNFT, (req, res) => {
  if (!canSeeAll(req.nftUser) && !isAdmin(req.nftUser)) return res.status(403).json({ error: 'Not authorized' });
  const db = getDB();
  const rows = db.prepare('SELECT id, username, real_name, role, job_title, department, photo_url, phone, hire_date, created_at FROM nft_users ORDER BY real_name').all();
  res.json(rows);
});

router.post('/users', authNFT, async (req, res) => {
  if (!isManager(req.nftUser)) return res.status(403).json({ error: 'Managers only' });
  const { username, password, real_name, role, job_title, department } = req.body;
  const allowedRoles = ['hr','finance','admin','employee'];
  if (!allowedRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (!username || !password || !real_name) return res.status(400).json({ error: 'username, password, real_name required' });
  const db = getDB();
  try {
    const hash = bcrypt.hashSync(password, 10);
    const r = db.prepare('INSERT INTO nft_users (username, password, real_name, role, job_title, department, created_by) VALUES (?,?,?,?,?,?,?)').run(username.toLowerCase().trim(), hash, real_name, role, job_title||'', department||'', req.nftUser.id);
    res.json({ id: r.lastInsertRowid });
  } catch(e) { res.status(400).json({ error: 'Username already taken' }); }
});

router.put('/users/:id', authNFT, async (req, res) => {
  const db = getDB();
  const target = db.prepare('SELECT * FROM nft_users WHERE id=?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  // Managers can edit anyone; others can only edit themselves
  if (!isManager(req.nftUser) && String(target.id) !== String(req.nftUser.id)) return res.status(403).json({ error: 'Not authorized' });
  const { real_name, job_title, department, phone, hire_date, bio, username, password } = req.body;
  if (username && username !== target.username) {
    const ex = db.prepare('SELECT id FROM nft_users WHERE username=? AND id!=?').get(username.toLowerCase().trim(), req.params.id);
    if (ex) return res.status(400).json({ error: 'Username taken' });
    db.prepare('UPDATE nft_users SET username=? WHERE id=?').run(username.toLowerCase().trim(), req.params.id);
  }
  if (password) db.prepare('UPDATE nft_users SET password=?, token_version=token_version+1 WHERE id=?').run(bcrypt.hashSync(password,10), req.params.id);
  db.prepare('UPDATE nft_users SET real_name=?, job_title=?, department=?, phone=?, hire_date=?, bio=? WHERE id=?').run(real_name, job_title, department, phone, hire_date, bio, req.params.id);
  res.json({ success: true });
});

router.delete('/users/:id', authNFT, (req, res) => {
  if (!isManager(req.nftUser)) return res.status(403).json({ error: 'Managers only' });
  const db = getDB(); const target = db.prepare('SELECT role FROM nft_users WHERE id=?').get(req.params.id);
  if (!target || target.role === 'manager') return res.status(400).json({ error: 'Cannot delete managers' });
  db.prepare('DELETE FROM nft_users WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.post('/users/:id/photo', authNFT, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/nft/${req.file.filename}`;
  getDB().prepare('UPDATE nft_users SET photo_url=? WHERE id=?').run(url, req.params.id);
  res.json({ url });
});

router.post('/users/reset-passwords', authNFT, (req, res) => {
  if (!isManager(req.nftUser)) return res.status(403).json({ error: 'Managers only' });
  const db = getDB(); const { role } = req.body;
  const users = db.prepare('SELECT id, real_name, username FROM nft_users WHERE role=?').all(role||'employee');
  const results = users.map(u => {
    const pwd = Math.random().toString(36).slice(2,10) + 'A1!';
    db.prepare('UPDATE nft_users SET password=?, token_version=token_version+1 WHERE id=?').run(bcrypt.hashSync(pwd,10), u.id);
    return { ...u, password: pwd };
  });
  res.json({ results });
});

// ── SALARY (Finance + Manager) ─────────────────────────────
router.get('/salary', authNFT, (req, res) => {
  const db = getDB();
  if (isFinance(req.nftUser) || isHR(req.nftUser)) {
    return res.json(db.prepare('SELECT s.*, u.real_name FROM nft_salary s JOIN nft_users u ON s.user_id=u.id ORDER BY s.month DESC, u.real_name').all());
  }
  res.json(db.prepare('SELECT * FROM nft_salary WHERE user_id=? ORDER BY month DESC').all(req.nftUser.id));
});

router.post('/salary', authNFT, (req, res) => {
  if (!isFinance(req.nftUser)) return res.status(403).json({ error: 'Finance/Manager only' });
  const { user_id, month, base_salary, bonus, notes } = req.body;
  const db = getDB();
  db.prepare(`INSERT INTO nft_salary (user_id,month,base_salary,bonus,notes,created_by) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,month) DO UPDATE SET base_salary=excluded.base_salary,bonus=excluded.bonus,notes=excluded.notes`).run(user_id,month,base_salary||0,bonus||0,notes,req.nftUser.id);
  res.json({ success: true });
});

// ── TARGETS ────────────────────────────────────────────────
router.get('/targets', authNFT, (req, res) => {
  const db = getDB();
  if (canSeeAll(req.nftUser)) return res.json(db.prepare('SELECT t.*, u.real_name FROM nft_targets t JOIN nft_users u ON t.user_id=u.id ORDER BY t.quarter DESC, u.real_name').all());
  res.json(db.prepare('SELECT * FROM nft_targets WHERE user_id=? ORDER BY quarter DESC').all(req.nftUser.id));
});

router.post('/targets', authNFT, (req, res) => {
  if (!isManager(req.nftUser)) return res.status(403).json({ error: 'Managers only' });
  const { user_id, quarter, sales_target, gp_target, sales_achieved, gp_achieved } = req.body;
  getDB().prepare(`INSERT INTO nft_targets (user_id,quarter,sales_target,gp_target,sales_achieved,gp_achieved,created_by) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,quarter) DO UPDATE SET sales_target=excluded.sales_target,gp_target=excluded.gp_target,sales_achieved=excluded.sales_achieved,gp_achieved=excluded.gp_achieved`).run(user_id,quarter,sales_target||0,gp_target||0,sales_achieved||0,gp_achieved||0,req.nftUser.id);
  res.json({ success: true });
});

// ── BIODATA ─────────────────────────────────────────────────
router.get('/biodata/:userId', authNFT, (req, res) => {
  const target = parseInt(req.params.userId);
  if (target !== req.nftUser.id && !isHR(req.nftUser)) return res.status(403).json({ error: 'Not authorized' });
  res.json(getDB().prepare('SELECT * FROM nft_biodata WHERE user_id=? ORDER BY created_at DESC').all(target));
});

router.post('/biodata/:userId', authNFT, upload.single('document'), (req, res) => {
  if (!isHR(req.nftUser)) return res.status(403).json({ error: 'HR/Manager only' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/nft/${req.file.filename}`;
  getDB().prepare('INSERT INTO nft_biodata (user_id,doc_type,doc_name,file_url,file_size,uploaded_by) VALUES (?,?,?,?,?,?)').run(req.params.userId,req.body.doc_type||'Other',req.body.doc_name||req.file.originalname,url,req.file.size,req.nftUser.id);
  res.json({ success:true, url });
});

router.delete('/biodata/:id', authNFT, (req, res) => {
  if (!isHR(req.nftUser)) return res.status(403).json({ error: 'Not authorized' });
  getDB().prepare('DELETE FROM nft_biodata WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── KIOSK MENU (Admin + Manager) ───────────────────────────
router.get('/kiosk/menu', authNFT, (req, res) => res.json(getDB().prepare('SELECT * FROM nft_kiosk_menu ORDER BY category,name').all()));

router.post('/kiosk/menu', authNFT, (req, res) => {
  if (!isAdmin(req.nftUser)) return res.status(403).json({ error: 'Admin only' });
  const { name, category, price, description } = req.body;
  const r = getDB().prepare('INSERT INTO nft_kiosk_menu (name,category,price,description) VALUES (?,?,?,?)').run(name,category||'Food',price,description);
  res.json({ id: r.lastInsertRowid });
});

router.patch('/kiosk/menu/:id', authNFT, (req, res) => {
  if (!isAdmin(req.nftUser)) return res.status(403).json({ error: 'Admin only' });
  const { available, name, price, category, description } = req.body;
  if (available!==undefined) getDB().prepare('UPDATE nft_kiosk_menu SET available=? WHERE id=?').run(available?1:0, req.params.id);
  else getDB().prepare('UPDATE nft_kiosk_menu SET name=?,price=?,category=?,description=? WHERE id=?').run(name,price,category,description,req.params.id);
  res.json({ success: true });
});

router.delete('/kiosk/menu/:id', authNFT, (req, res) => {
  if (!isAdmin(req.nftUser)) return res.status(403).json({ error: 'Admin only' });
  getDB().prepare('DELETE FROM nft_kiosk_menu WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.get('/kiosk/orders', authNFT, (req, res) => {
  const db = getDB();
  if (isAdmin(req.nftUser)) return res.json(db.prepare('SELECT o.*, u.real_name FROM nft_kiosk_orders o JOIN nft_users u ON o.user_id=u.id ORDER BY o.created_at DESC LIMIT 100').all());
  res.json(db.prepare('SELECT * FROM nft_kiosk_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.nftUser.id));
});

router.post('/kiosk/orders', authNFT, (req, res) => {
  const { items, notes } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'No items' });
  const total = items.reduce((s,i) => s+(i.price*i.qty), 0);
  const r = getDB().prepare('INSERT INTO nft_kiosk_orders (user_id,items,total_amount,notes) VALUES (?,?,?,?)').run(req.nftUser.id,JSON.stringify(items),total,notes);
  res.json({ id: r.lastInsertRowid });
});

router.patch('/kiosk/orders/:id/status', authNFT, (req, res) => {
  if (!isAdmin(req.nftUser)) return res.status(403).json({ error: 'Admin only' });
  getDB().prepare('UPDATE nft_kiosk_orders SET status=? WHERE id=?').run(req.body.status, req.params.id);
  res.json({ success: true });
});

// ── SHOP PRODUCTS (Admin + Manager) ────────────────────────
router.get('/shop/products', authNFT, (req, res) => res.json(getDB().prepare('SELECT * FROM nft_shop_products ORDER BY category,name').all()));

router.post('/shop/products', authNFT, (req, res) => {
  if (!isAdmin(req.nftUser)) return res.status(403).json({ error: 'Admin only' });
  const { name, description, price, inventory, category } = req.body;
  const r = getDB().prepare('INSERT INTO nft_shop_products (name,description,price,inventory,category) VALUES (?,?,?,?,?)').run(name,description,price,inventory||0,category||'Merchandise');
  res.json({ id: r.lastInsertRowid });
});

router.put('/shop/products/:id', authNFT, (req, res) => {
  if (!isAdmin(req.nftUser)) return res.status(403).json({ error: 'Admin only' });
  const { name, description, price, inventory, category, available } = req.body;
  getDB().prepare('UPDATE nft_shop_products SET name=?,description=?,price=?,inventory=?,category=?,available=? WHERE id=?').run(name,description,price,inventory,category,available?1:0,req.params.id);
  res.json({ success: true });
});

router.delete('/shop/products/:id', authNFT, (req, res) => {
  if (!isAdmin(req.nftUser)) return res.status(403).json({ error: 'Admin only' });
  getDB().prepare('DELETE FROM nft_shop_products WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.get('/shop/orders', authNFT, (req, res) => {
  const db = getDB();
  if (isAdmin(req.nftUser) || isFinance(req.nftUser)) return res.json(db.prepare('SELECT o.*, u.real_name FROM nft_shop_orders o JOIN nft_users u ON o.user_id=u.id ORDER BY o.created_at DESC').all());
  res.json(db.prepare('SELECT * FROM nft_shop_orders WHERE user_id=? ORDER BY created_at DESC').all(req.nftUser.id));
});

router.post('/shop/orders', authNFT, (req, res) => {
  const { items } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'No items' });
  const db = getDB(); const total = items.reduce((s,i) => s+(i.price*i.qty), 0);
  const tx = db.transaction(() => {
    items.forEach(item => {
      const p = db.prepare('SELECT inventory FROM nft_shop_products WHERE id=?').get(item.id);
      if (!p || p.inventory < item.qty) throw new Error(`Insufficient stock for ${item.name}`);
      db.prepare('UPDATE nft_shop_products SET inventory=inventory-? WHERE id=?').run(item.qty, item.id);
    });
    return db.prepare('INSERT INTO nft_shop_orders (user_id,items,total_amount) VALUES (?,?,?)').run(req.nftUser.id, JSON.stringify(items), total).lastInsertRowid;
  });
  try { res.json({ id: tx(), total }); } catch(e) { res.status(400).json({ error: e.message }); }
});

router.patch('/shop/orders/:id', authNFT, (req, res) => {
  if (!isAdmin(req.nftUser) && !isFinance(req.nftUser)) return res.status(403).json({ error: 'Not authorized' });
  const { status, deduction_status } = req.body;
  const db = getDB();
  if (status) db.prepare('UPDATE nft_shop_orders SET status=? WHERE id=?').run(status, req.params.id);
  if (deduction_status) db.prepare('UPDATE nft_shop_orders SET deduction_status=? WHERE id=?').run(deduction_status, req.params.id);
  res.json({ success: true });
});

// ── MESSAGES ────────────────────────────────────────────────
router.get('/messages/conversations', authNFT, (req, res) => {
  const db = getDB();
  const all = db.prepare('SELECT c.*, (SELECT content FROM nft_messages WHERE conversation_id=c.id ORDER BY created_at DESC LIMIT 1) as last_message FROM nft_conversations c ORDER BY created_at DESC').all();
  const mine = all.filter(c => { try { const p=JSON.parse(c.participants||'[]'); return p.includes(req.nftUser.id)||p.includes(String(req.nftUser.id)); } catch { return false; } });
  const result = mine.map(c => {
    const parts = JSON.parse(c.participants||'[]');
    const profiles = parts.map(uid => db.prepare('SELECT id as user_id, real_name, photo_url FROM nft_users WHERE id=?').get(uid)).filter(Boolean);
    return { ...c, profiles };
  });
  res.json(result);
});

router.post('/messages/conversations', authNFT, (req, res) => {
  const db = getDB(); const { type, name, participants } = req.body;
  const parts = [...new Set([...participants, req.nftUser.id])];
  if (type === 'dm' && parts.length === 2) {
    const ex = db.prepare("SELECT * FROM nft_conversations WHERE type='dm'").all().find(c => { try { const p=JSON.parse(c.participants||'[]'); return p.includes(parts[0])&&p.includes(parts[1]); } catch { return false; } });
    if (ex) return res.json(ex);
  }
  const r = db.prepare('INSERT INTO nft_conversations (type,name,participants,created_by) VALUES (?,?,?,?)').run(type||'dm',name||null,JSON.stringify(parts),req.nftUser.id);
  res.json({ id: r.lastInsertRowid });
});

router.get('/messages/:convId', authNFT, (req, res) => {
  const msgs = getDB().prepare('SELECT m.*, u.real_name, u.photo_url FROM nft_messages m JOIN nft_users u ON m.sender_id=u.id WHERE m.conversation_id=? ORDER BY m.created_at ASC LIMIT 100').all(req.params.convId);
  res.json(msgs);
});

router.post('/messages/:convId', authNFT, msgUpload.single('file'), (req, res) => {
  const { content } = req.body;
  let fu=null,fn=null,fs=0;
  if (req.file) { fu=`/uploads/nft/${req.file.filename}`; fn=req.file.originalname; fs=req.file.size; }
  if (!content && !fu) return res.status(400).json({ error: 'Message or file required' });
  const r = getDB().prepare('INSERT INTO nft_messages (conversation_id,sender_id,content,file_url,file_name,file_size) VALUES (?,?,?,?,?,?)').run(req.params.convId,req.nftUser.id,content||null,fu,fn,fs);
  const msg = getDB().prepare('SELECT m.*,u.real_name,u.photo_url FROM nft_messages m JOIN nft_users u ON m.sender_id=u.id WHERE m.id=?').get(r.lastInsertRowid);
  res.json(msg);
});

// ── NEWS ────────────────────────────────────────────────────
router.get('/news', authNFT, (req, res) => res.json(getDB().prepare('SELECT n.*,u.real_name,u.photo_url as author_photo FROM nft_news n JOIN nft_users u ON n.author_id=u.id ORDER BY n.created_at DESC').all()));

router.post('/news', authNFT, upload.single('image'), (req, res) => {
  if (!isManager(req.nftUser) && req.nftUser.role !== 'hr') return res.status(403).json({ error: 'Manager/HR only' });
  const { title, content } = req.body;
  const image_url = req.file ? `/uploads/nft/${req.file.filename}` : null;
  const r = getDB().prepare('INSERT INTO nft_news (title,content,image_url,author_id) VALUES (?,?,?,?)').run(title,content,image_url,req.nftUser.id);
  res.json({ id: r.lastInsertRowid });
});

router.delete('/news/:id', authNFT, (req, res) => {
  if (!isManager(req.nftUser) && req.nftUser.role !== 'hr') return res.status(403).json({ error: 'Not authorized' });
  getDB().prepare('DELETE FROM nft_news WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── CARS ────────────────────────────────────────────────────
router.get('/cars', authNFT, (req, res) => {
  const db = getDB();
  res.json({ cars: db.prepare('SELECT * FROM nft_cars ORDER BY sort_order').all(), assignments: db.prepare('SELECT a.*,u.real_name,c.name as car_name FROM nft_car_assignments a JOIN nft_users u ON a.user_id=u.id JOIN nft_cars c ON a.car_id=c.id').all() });
});

module.exports = router;
