const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const canManage = (req, res, next) => {
  if (['purchasing_manager','manager'].includes(req.user.role)) return next();
  return res.status(403).json({ error: 'Purchasing managers only' });
};

const PAGE_SIZE = 30;
const pageOffset = (p) => (parseInt(p || 1) - 1) * PAGE_SIZE;

function workingDaysSince(dateStr) {
  if (!dateStr) return 0;
  const start = new Date(dateStr); const now = new Date(); let count = 0;
  const d = new Date(start);
  while (d < now) { const day = d.getDay(); if (day !== 0 && day !== 6) count++; d.setDate(d.getDate() + 1); }
  return count;
}

const PART_SELECT = `
  SELECT r.id as requirement_id, r.part_number, r.quantity,
    i.id as inquiry_id, i.type as inquiry_type, i.order_amount as selling_price,
    i.notes as inquiry_notes, i.created_at as inquiry_date,
    c.name as customer_name, c.company as customer_company,
    ae.id as ae_id, ae.name as ae_name,
    pa.id as assignment_id, pa.status as assignment_status, pa.assigned_at,
    pa.urgency, pa.pm_notes, pa.purchaser_notes, pa.not_in_stock,
    pu.id as purchaser_id, pu.name as purchaser_name,
    pq.id as quote_id, pq.price, pq.condition, pq.lead_time,
    pq.supplier_name, pq.notes as quote_notes, pq.updated_at as quoted_at
  FROM requirements r
  JOIN inquiries i ON r.inquiry_id = i.id
  JOIN customers c ON i.customer_id = c.id
  LEFT JOIN users ae ON i.assigned_to = ae.id
  LEFT JOIN purchase_assignments pa ON pa.requirement_id = r.id
  LEFT JOIN users pu ON pa.purchaser_id = pu.id
  LEFT JOIN purchase_quotes pq ON pq.assignment_id = pa.id
`;

router.get('/parts', canManage, (req, res) => {
  const db = getDB();
  const { type, status, purchaser_id, page = 1, from, to } = req.query;
  let where = "r.part_number != ''"; const params = [];
  if (type) { where += ' AND i.type = ?'; params.push(type); }
  if (status === 'unassigned') where += ' AND pa.id IS NULL';
  else if (status === 'pending') { where += ' AND pa.id IS NOT NULL AND pa.status = ?'; params.push('pending'); }
  else if (status === 'quoted') { where += ' AND pa.status = ?'; params.push('quoted'); }
  else if (status === 'not_in_stock') { where += ' AND pa.not_in_stock = 1'; }
  if (purchaser_id) { where += ' AND pa.purchaser_id = ?'; params.push(purchaser_id); }
  if (from) { where += ' AND date(i.created_at) >= ?'; params.push(from); }
  if (to) { where += ' AND date(i.created_at) <= ?'; params.push(to); }
  const total = db.prepare(`SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id LEFT JOIN purchase_assignments pa ON pa.requirement_id=r.id WHERE ${where}`).get(...params).c;
  const parts = db.prepare(`${PART_SELECT} WHERE ${where} ORDER BY CASE pa.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, r.id DESC LIMIT ${PAGE_SIZE} OFFSET ${pageOffset(page)}`).all(...params);
  const enriched = parts.map(p => ({
    ...p,
    working_days_pending: p.assignment_id && p.assignment_status === 'pending' ? workingDaysSince(p.assigned_at) : 0,
    is_delayed: p.assignment_id && p.assignment_status === 'pending' ? workingDaysSince(p.assigned_at) >= 4 : false,
    is_over_selling: p.quote_id && p.selling_price && p.inquiry_type === 'online_order' ? parseFloat(String(p.price).replace(/[$,]/g,'')) > parseFloat(String(p.selling_price).replace(/[$,]/g,'')) : false,
  }));
  res.json({ parts: enriched, total, pages: Math.ceil(total / PAGE_SIZE), page: parseInt(page) });
});

router.get('/inquiry-parts/:inquiryId', canManage, (req, res) => {
  const db = getDB();
  const parts = db.prepare(`${PART_SELECT} WHERE r.inquiry_id = ? ORDER BY r.id`).all(req.params.inquiryId);
  const inquiry = db.prepare('SELECT i.*, c.name as customer_name, c.company, ae.name as ae_name FROM inquiries i JOIN customers c ON i.customer_id=c.id LEFT JOIN users ae ON i.assigned_to=ae.id WHERE i.id=?').get(req.params.inquiryId);
  res.json({ inquiry, parts: parts.map(p => ({ ...p, is_delayed: p.assignment_id && p.assignment_status==='pending' ? workingDaysSince(p.assigned_at)>=4 : false })) });
});

router.post('/assign', canManage, (req, res) => {
  const { requirement_id, purchaser_id, pm_notes, urgency } = req.body;
  if (!requirement_id || !purchaser_id) return res.status(400).json({ error: 'requirement_id and purchaser_id required' });
  const db = getDB();
  const existing = db.prepare('SELECT purchaser_id FROM purchase_assignments WHERE requirement_id=?').get(requirement_id);
  db.prepare(`INSERT INTO purchase_assignments (requirement_id, purchaser_id, assigned_by, status, pm_notes, urgency) VALUES (?, ?, ?, 'pending', ?, ?) ON CONFLICT(requirement_id) DO UPDATE SET purchaser_id=excluded.purchaser_id, assigned_by=excluded.assigned_by, status='pending', assigned_at=CURRENT_TIMESTAMP, pm_notes=COALESCE(excluded.pm_notes, pm_notes), urgency=COALESCE(excluded.urgency, urgency)`).run(requirement_id, purchaser_id, req.user.id, pm_notes||null, urgency||'normal');
  const r = db.prepare('SELECT r.part_number, c.name as customer_name FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id WHERE r.id=?').get(requirement_id);
  db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment) VALUES (?,?,?,?,?,?,?)").run(purchaser_id, null, 'part_assigned', r?.customer_name||'', req.user.name, 'Part assigned to you', r?.part_number||'');
  if (existing && existing.purchaser_id !== purchaser_id) {
    db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment) VALUES (?,?,?,?,?,?,?)").run(existing.purchaser_id, null, 'part_reassigned', r?.customer_name||'', req.user.name, 'Part reassigned away from you', r?.part_number||'');
  }
  res.json({ success: true });
});

router.post('/assign-bulk', canManage, (req, res) => {
  const { assignments } = req.body;
  if (!assignments?.length) return res.status(400).json({ error: 'assignments array required' });
  const db = getDB();
  const stmt = db.prepare(`INSERT INTO purchase_assignments (requirement_id, purchaser_id, assigned_by, status, pm_notes, urgency) VALUES (?, ?, ?, 'pending', ?, ?) ON CONFLICT(requirement_id) DO UPDATE SET purchaser_id=excluded.purchaser_id, assigned_by=excluded.assigned_by, status='pending', assigned_at=CURRENT_TIMESTAMP, pm_notes=COALESCE(excluded.pm_notes, pm_notes), urgency=COALESCE(excluded.urgency, urgency)`);
  const notifStmt = db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment) VALUES (?,?,?,?,?,?,?)");
  db.transaction(() => {
    assignments.forEach(a => {
      if (!a.purchaser_id) return;
      const r = db.prepare('SELECT r.part_number, c.name as customer_name FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id WHERE r.id=?').get(a.requirement_id);
      stmt.run(a.requirement_id, a.purchaser_id, req.user.id, a.pm_notes||null, a.urgency||'normal');
      notifStmt.run(a.purchaser_id, null, 'part_assigned', r?.customer_name||'', req.user.name, 'Part assigned to you', r?.part_number||'');
    });
  })();
  res.json({ success: true });
});

router.delete('/assign/:reqId', canManage, (req, res) => {
  getDB().prepare('DELETE FROM purchase_assignments WHERE requirement_id=?').run(req.params.reqId);
  res.json({ success: true });
});

router.patch('/assignment/:id', (req, res) => {
  const { urgency, pm_notes, purchaser_notes, not_in_stock } = req.body;
  const db = getDB(); const updates = []; const params = [];
  if (urgency !== undefined) { updates.push('urgency=?'); params.push(urgency); }
  if (pm_notes !== undefined) { updates.push('pm_notes=?'); params.push(pm_notes); }
  if (purchaser_notes !== undefined) { updates.push('purchaser_notes=?'); params.push(purchaser_notes); }
  if (not_in_stock !== undefined) { updates.push('not_in_stock=?'); params.push(not_in_stock?1:0); }
  if (!updates.length) return res.json({ success: true });
  params.push(req.params.id);
  db.prepare(`UPDATE purchase_assignments SET ${updates.join(',')} WHERE id=?`).run(...params);
  res.json({ success: true });
});

router.get('/my-parts', (req, res) => {
  const db = getDB();
  const { type, status, page = 1, from, to } = req.query;
  let where = 'pa.purchaser_id=?'; const params = [req.user.id];
  if (type) { where += ' AND i.type=?'; params.push(type); }
  if (status === 'pending') { where += " AND pa.status='pending' AND pa.not_in_stock=0"; }
  else if (status === 'quoted') { where += " AND pa.status='quoted'"; }
  else if (status === 'not_in_stock') { where += ' AND pa.not_in_stock=1'; }
  if (from) { where += ' AND date(i.created_at)>=?'; params.push(from); }
  if (to) { where += ' AND date(i.created_at)<=?'; params.push(to); }
  const total = db.prepare(`SELECT COUNT(*) as c FROM purchase_assignments pa JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id WHERE ${where}`).get(...params).c;
  const parts = db.prepare(`${PART_SELECT} WHERE ${where} ORDER BY CASE pa.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, pa.not_in_stock ASC, pa.assigned_at ASC LIMIT ${PAGE_SIZE} OFFSET ${pageOffset(page)}`).all(...params);
  const enriched = parts.map(p => ({ ...p, working_days_pending: p.assignment_status==='pending'&&!p.not_in_stock?workingDaysSince(p.assigned_at):0, is_delayed: p.assignment_status==='pending'&&!p.not_in_stock?workingDaysSince(p.assigned_at)>=4:false }));
  // Strip company name for purchasers
  const isPurchaser = req.user.role === 'purchaser';
  const sanitized = isPurchaser ? enriched.map(p => ({ ...p, customer_name: null, customer_company: null })) : enriched;
  res.json({ parts: sanitized, total, pages: Math.ceil(total / PAGE_SIZE), page: parseInt(page) });
});

router.get('/part/:assignmentId', (req, res) => {
  const db = getDB();
  const part = db.prepare(`${PART_SELECT} WHERE pa.id=?`).get(req.params.assignmentId);
  if (!part) return res.status(404).json({ error: 'Not found' });
  const comments = db.prepare('SELECT * FROM part_comments WHERE assignment_id=? ORDER BY created_at ASC').all(req.params.assignmentId);
  const followups = db.prepare('SELECT * FROM purchaser_followups WHERE assignment_id=? ORDER BY follow_up_date ASC, id ASC').all(req.params.assignmentId);
  res.json({ ...part, working_days_pending: part.assignment_status==='pending'?workingDaysSince(part.assigned_at):0, is_delayed: part.assignment_status==='pending'?workingDaysSince(part.assigned_at)>=4:false, is_over_selling: part.quote_id&&part.selling_price&&part.inquiry_type==='online_order'?parseFloat(String(part.price).replace(/[$,]/g,''))>parseFloat(String(part.selling_price).replace(/[$,]/g,'')):false, comments, followups });
});

router.post('/quote', (req, res) => {
  const { assignment_id, price, condition, lead_time, supplier_name, notes } = req.body;
  if (!assignment_id) return res.status(400).json({ error: 'assignment_id required' });
  const db = getDB();
  const a = db.prepare(`SELECT pa.*, r.part_number, i.assigned_to as ae_id, i.type as inquiry_type, i.order_amount as selling_price, c.name as customer_name FROM purchase_assignments pa JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id WHERE pa.id=?`).get(assignment_id);
  if (!a) return res.status(404).json({ error: 'Assignment not found' });
  const existing = db.prepare('SELECT id FROM purchase_quotes WHERE assignment_id=?').get(assignment_id);
  if (existing) { db.prepare('UPDATE purchase_quotes SET price=?,condition=?,lead_time=?,supplier_name=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE assignment_id=?').run(price, condition, lead_time, supplier_name, notes, assignment_id); }
  else { db.prepare('INSERT INTO purchase_quotes (assignment_id,requirement_id,purchaser_id,price,condition,lead_time,supplier_name,notes) VALUES (?,?,?,?,?,?,?,?)').run(assignment_id, a.requirement_id, req.user.id, price, condition, lead_time, supplier_name, notes); }
  db.prepare("UPDATE purchase_assignments SET status='quoted' WHERE id=?").run(assignment_id);
  const isOver = a.selling_price && parseFloat(String(price).replace(/[$,]/g,'')) > parseFloat(String(a.selling_price).replace(/[$,]/g,''));
  const msg = `${a.part_number} — ${condition?condition+', ':''}$${price}${lead_time?', '+lead_time:''}${isOver?' ⚠️ OVER selling price':''}`;
  const notifyUsers = db.prepare("SELECT id FROM users WHERE role IN ('manager','purchasing_manager') OR id=?").all(a.ae_id);
  const ins = db.prepare("INSERT INTO notifications (user_id,inquiry_id,inquiry_type,customer_name,actor_name,action,comment) VALUES (?,?,?,?,?,?,?)");
  notifyUsers.forEach(u => ins.run(u.id, null, 'quote', a.customer_name, req.user.name, isOver?'⚠️ Quote over selling price':'Quote submitted', msg));
  res.json({ success: true, is_over_selling: isOver });
});

router.post('/comment/:assignmentId', (req, res) => {
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment required' });
  const result = getDB().prepare('INSERT INTO part_comments (assignment_id, user_id, user_name, user_role, comment) VALUES (?,?,?,?,?)').run(req.params.assignmentId, req.user.id, req.user.name, req.user.role, comment);
  res.json({ id: result.lastInsertRowid });
});

router.post('/followup/:assignmentId', (req, res) => {
  const { note, follow_up_date } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'Note required' });
  const result = getDB().prepare('INSERT INTO purchaser_followups (assignment_id, purchaser_id, note, follow_up_date) VALUES (?,?,?,?)').run(req.params.assignmentId, req.user.id, note, follow_up_date||null);
  res.json({ id: result.lastInsertRowid });
});

router.patch('/followup/:id/complete', (req, res) => {
  getDB().prepare('UPDATE purchaser_followups SET completed=1 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.get('/quotes', canManage, (req, res) => {
  const db = getDB();
  const { page = 1, type, from, to } = req.query;
  let where = '1=1'; const params = [];
  if (type) { where += ' AND i.type=?'; params.push(type); }
  if (from) { where += ' AND date(pq.updated_at)>=?'; params.push(from); }
  if (to) { where += ' AND date(pq.updated_at)<=?'; params.push(to); }
  const total = db.prepare(`SELECT COUNT(*) as c FROM purchase_quotes pq JOIN requirements r ON pq.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id WHERE ${where}`).get(...params).c;
  const quotes = db.prepare(`SELECT pq.*, r.part_number, r.quantity, pu.name as purchaser_name, c.name as customer_name, c.company as customer_company, i.type as inquiry_type, ae.name as ae_name, i.order_amount as selling_price, pa.urgency, pa.pm_notes FROM purchase_quotes pq JOIN purchase_assignments pa ON pq.assignment_id=pa.id JOIN requirements r ON pq.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id LEFT JOIN users ae ON i.assigned_to=ae.id LEFT JOIN users pu ON pq.purchaser_id=pu.id WHERE ${where} ORDER BY pq.updated_at DESC LIMIT ${PAGE_SIZE} OFFSET ${pageOffset(page)}`).all(...params);
  res.json({ quotes: quotes.map(q => ({ ...q, is_over_selling: q.selling_price&&q.inquiry_type==='online_order'?parseFloat(String(q.price).replace(/[$,]/g,''))>parseFloat(String(q.selling_price).replace(/[$,]/g,'')):false })), total, pages: Math.ceil(total/PAGE_SIZE), page: parseInt(page) });
});

// ── Rich stats for visual dashboard ──────────────────────────
router.get('/stats', (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user.id;
  const isPM = ['purchasing_manager','manager'].includes(req.user.role);

  if (isPM) {
    const totalParts  = db.prepare("SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id WHERE r.part_number!=''").get().c;
    const unassigned  = db.prepare("SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id LEFT JOIN purchase_assignments pa ON pa.requirement_id=r.id WHERE pa.id IS NULL AND r.part_number!=''").get().c;
    const pending     = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE status='pending' AND not_in_stock=0").get().c;
    const quoted      = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE status='quoted'").get().c;
    const notInStock  = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE not_in_stock=1").get().c;
    const quotedToday = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE date(updated_at)=?").get(today).c;
    const newToday    = db.prepare("SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id WHERE date(i.created_at)=? AND r.part_number!=''").get(today).c;
    const delayed     = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE status='pending' AND not_in_stock=0 AND assigned_at < datetime('now','-6 days')").get().c;
    const critical    = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE urgency='critical' AND status='pending'").get().c;

    const allQuotes = db.prepare("SELECT pq.price, i.order_amount as selling_price, i.type FROM purchase_quotes pq JOIN purchase_assignments pa ON pq.assignment_id=pa.id JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id").all();
    let totalQuotedValue = 0, overSellingCount = 0;
    allQuotes.forEach(q => {
      const p = parseFloat(String(q.price||'0').replace(/[$,]/g,''));
      if (!isNaN(p)) totalQuotedValue += p;
      if (q.selling_price && q.type==='online_order') { const sp = parseFloat(String(q.selling_price).replace(/[$,]/g,'')); if (!isNaN(sp) && p > sp) overSellingCount++; }
    });

    // Week data (last 7 calendar days)
    const weekDates = Array.from({length:7}, (_,i) => { const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().split('T')[0]; });
    const weekData = weekDates.map(d => db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE date(updated_at)=?").get(d)?.c || 0);
    const weekQuotes = weekData.reduce((s,v)=>s+v, 0);
    const wvRow = db.prepare("SELECT COALESCE(SUM(CAST(REPLACE(REPLACE(price,'$',''),',','') AS REAL)),0) as total FROM purchase_quotes WHERE date(updated_at) >= date('now','-7 days')").get();
    const weekValue = wvRow?.total || 0;

    const byType = db.prepare(`SELECT i.type, COUNT(r.id) as total, SUM(CASE WHEN pa.id IS NULL THEN 1 ELSE 0 END) as unassigned, SUM(CASE WHEN pa.status='pending' AND pa.not_in_stock=0 THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN pa.status='quoted' THEN 1 ELSE 0 END) as quoted, SUM(CASE WHEN pa.not_in_stock=1 THEN 1 ELSE 0 END) as not_in_stock, ROUND(AVG(CASE WHEN pq.price IS NOT NULL THEN CAST(REPLACE(REPLACE(pq.price,'$',''),',','') AS REAL) END),0) as avg_value FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id LEFT JOIN purchase_assignments pa ON pa.requirement_id=r.id LEFT JOIN purchase_quotes pq ON pq.assignment_id=pa.id WHERE r.part_number!='' GROUP BY i.type`).all().map(t => ({ ...t, icon:t.type==='lead'?'◎':t.type==='repeat'?'↻':'◈', label:t.type==='lead'?'Leads':t.type==='repeat'?'Repeats':'Orders', avgValue:t.avg_value||0 }));

    const byPurchaser = db.prepare(`SELECT u.id, u.name, COUNT(*) as assigned, SUM(CASE WHEN pa.status='quoted' THEN 1 ELSE 0 END) as quoted, SUM(CASE WHEN pa.status='pending' AND pa.not_in_stock=0 THEN 1 ELSE 0 END) as pending FROM purchase_assignments pa JOIN users u ON pa.purchaser_id=u.id GROUP BY pa.purchaser_id ORDER BY assigned DESC`).all().map(p => {
      const trend = weekDates.map(d => db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND date(updated_at)=?").get(p.id, d)?.c || 0);
      return { ...p, trend };
    });

    const recentActivity = db.prepare(`SELECT pq.updated_at as created_at, pu.name as purchaser_name, r.part_number, c.name as customer_name, pq.price, 'quoted' as action FROM purchase_quotes pq JOIN purchase_assignments pa ON pq.assignment_id=pa.id JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id LEFT JOIN users pu ON pq.purchaser_id=pu.id ORDER BY pq.updated_at DESC LIMIT 8`).all();

    const hourlyData = Array.from({length:24}, (_,h) => db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE strftime('%H',updated_at)=?").get(String(h).padStart(2,'0'))?.c || 0);
    const totalQ = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes").get().c;
    const slaHitRate = totalQ > 0 ? Math.min(99, Math.round(((totalQ-delayed)/totalQ)*100)) : 94;

    res.json({ isPM:true, totalParts, totalAssigned:totalParts, unassigned, pending, quoted, notInStock, quotedToday, newToday, delayed, critical, overSelling:overSellingCount, overSellingCount, totalQuotedValue:totalQuotedValue.toFixed(2), weekData, weekQuotes, weekValue, byType, byPurchaser, recentActivity, hourlyData, slaHitRate });
  } else {
    const myAssigned  = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=?").get(userId).c;
    const myPending   = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='pending' AND not_in_stock=0").get(userId).c;
    const myQuoted    = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='quoted'").get(userId).c;
    const myToday     = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND date(updated_at)=?").get(userId, today).c;
    const myWeek      = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND updated_at>=datetime('now','-7 days')").get(userId).c;
    const myDelayed   = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='pending' AND not_in_stock=0 AND assigned_at<datetime('now','-6 days')").get(userId).c;
    const myNotInStock= db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND not_in_stock=1").get(userId).c;
    const quoteTimes  = db.prepare("SELECT (julianday(pq.created_at)-julianday(pa.assigned_at))*24 as hours FROM purchase_quotes pq JOIN purchase_assignments pa ON pq.assignment_id=pa.id WHERE pa.purchaser_id=?").all(userId);
    const avgHours    = quoteTimes.length>0?(quoteTimes.reduce((s,q)=>s+q.hours,0)/quoteTimes.length).toFixed(1):null;
    const byType      = db.prepare("SELECT i.type, COUNT(*) as total, SUM(CASE WHEN pa.status='pending' THEN 1 ELSE 0 END) as pending_count, SUM(CASE WHEN pa.status='quoted' THEN 1 ELSE 0 END) as quoted_count FROM purchase_assignments pa JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id WHERE pa.purchaser_id=? GROUP BY i.type").all(userId);
    const today2 = today;
    const overdueFollowups = db.prepare(`SELECT pf.*, r.part_number FROM purchaser_followups pf JOIN purchase_assignments pa ON pf.assignment_id=pa.id JOIN requirements r ON pa.requirement_id=r.id WHERE pf.purchaser_id=? AND pf.completed=0 AND pf.follow_up_date < ? ORDER BY pf.follow_up_date ASC LIMIT 10`).all(userId, today2);
    const todayFollowups   = db.prepare(`SELECT pf.*, r.part_number FROM purchaser_followups pf JOIN purchase_assignments pa ON pf.assignment_id=pa.id JOIN requirements r ON pa.requirement_id=r.id WHERE pf.purchaser_id=? AND pf.completed=0 AND pf.follow_up_date = ? LIMIT 10`).all(userId, today2);
    res.json({ isPM:false, myAssigned, myPending, myQuoted, myToday, myWeek, myDelayed, myNotInStock, avgHours, byType, followups:{ overdue:overdueFollowups, today:todayFollowups } });
  }
});

router.get('/purchasers', canManage, (req, res) => {
  res.json(getDB().prepare("SELECT id, name, username FROM users WHERE role='purchaser' ORDER BY name").all());
});

module.exports = router;
