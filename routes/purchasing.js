const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const canManage = (req, res, next) => {
  if (['purchasing_manager','manager'].includes(req.user.role)) return next();
  return res.status(403).json({ error: 'Purchasing managers only' });
};

const isMgr = (role) => ['purchasing_manager','manager'].includes(role);

// Load an assignment plus its inquiry's AE id, for per-record authorization.
function getAssignmentCtx(db, assignmentId) {
  return db.prepare(`SELECT pa.id, pa.purchaser_id, i.assigned_to as ae_id
    FROM purchase_assignments pa
    JOIN requirements r ON pa.requirement_id = r.id
    JOIN inquiries i ON r.inquiry_id = i.id
    WHERE pa.id = ?`).get(assignmentId);
}

const PAGE_SIZE = 30;
const pageOffset = (p) => (parseInt(p || 1) - 1) * PAGE_SIZE;

// Working days since a date (Mon–Fri only)
function workingDaysSince(dateStr) {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  const now = new Date();
  let count = 0;
  const d = new Date(start);
  while (d < now) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Underwater check for online orders: purchaser's BUYING cost (per-unit price × qty)
// exceeds the website selling price the customer already paid (inquiries.order_amount).
// NOTE: order_amount is the whole-order total, so for multi-part orders this only fires when a
// single line's cost exceeds the entire order — conservative (no false positives, may under-flag).
// A fully accurate check needs per-part selling prices or an order-level cost rollup.
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[$,]/g, '')); return isNaN(n) ? 0 : n; };
function isOverSelling(price, quantity, selling_price, type) {
  if (type !== 'online_order' || !selling_price) return false;
  const cost = num(price) * (parseInt(quantity) || 1);
  const sp = num(selling_price);
  return !isNaN(cost) && !isNaN(sp) && cost > sp;
}
// Multi-entry: total buying cost across all sourcing entries (already summed) vs the sale price.
function isOverSellingTotal(totalCost, selling_price, type) {
  if (type !== 'online_order' || !selling_price) return false;
  const sp = num(selling_price);
  return !isNaN(sp) && sp > 0 && (Number(totalCost) || 0) > sp;
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
    pq.supplier_name, pq.notes as quote_notes, pq.updated_at as quoted_at,
    (SELECT COUNT(*) FROM purchase_quotes q WHERE q.assignment_id = pa.id) as quote_count,
    (SELECT COALESCE(SUM(COALESCE(q.quantity,0)),0) FROM purchase_quotes q WHERE q.assignment_id = pa.id) as quoted_qty,
    (SELECT COALESCE(SUM(CAST(REPLACE(REPLACE(IFNULL(q.price,'0'),'$',''),',','') AS REAL) * COALESCE(q.quantity,0)),0)
       FROM purchase_quotes q WHERE q.assignment_id = pa.id) as quoted_total_cost,
    (SELECT GROUP_CONCAT(q.supplier_name, ', ') FROM purchase_quotes q WHERE q.assignment_id = pa.id AND q.supplier_name IS NOT NULL AND q.supplier_name != '') as quote_suppliers
  FROM requirements r
  JOIN inquiries i ON r.inquiry_id = i.id
  JOIN customers c ON i.customer_id = c.id
  LEFT JOIN users ae ON i.assigned_to = ae.id
  LEFT JOIN purchase_assignments pa ON pa.requirement_id = r.id
  LEFT JOIN users pu ON pa.purchaser_id = pu.id
  LEFT JOIN purchase_quotes pq ON pq.id = (SELECT MIN(id) FROM purchase_quotes WHERE assignment_id = pa.id)
`;

// ── Parts list (PM, paginated) ─────────────────────────────────
router.get('/parts', canManage, (req, res) => {
  const db = getDB();
  const { type, status, purchaser_id, page = 1, from, to, search } = req.query;
  let where = "r.part_number != ''";
  const params = [];

  if (type) { where += ' AND i.type = ?'; params.push(type); }
  if (search) { where += ' AND (r.part_number LIKE ? OR c.name LIKE ? OR c.company LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
  if (status === 'unassigned') where += ' AND pa.id IS NULL';
  else if (status === 'pending') { where += ' AND pa.id IS NOT NULL AND pa.status = ?'; params.push('pending'); }
  else if (status === 'quoted') { where += ' AND pa.status = ?'; params.push('quoted'); }
  else if (status === 'not_in_stock') { where += ' AND pa.not_in_stock = 1'; }
  if (purchaser_id) { where += ' AND pa.purchaser_id = ?'; params.push(purchaser_id); }
  if (from) { where += ' AND date(i.created_at) >= ?'; params.push(from); }
  if (to) { where += ' AND date(i.created_at) <= ?'; params.push(to); }

  try {
    const total = db.prepare(`SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id LEFT JOIN purchase_assignments pa ON pa.requirement_id=r.id WHERE ${where}`).get(...params).c;
    const parts = db.prepare(`${PART_SELECT} WHERE ${where} ORDER BY CASE pa.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, r.id DESC LIMIT ${PAGE_SIZE} OFFSET ${pageOffset(page)}`).all(...params);

    // Flag delayed (>4 working days unquoted)
    const enriched = parts.map(p => ({
      ...p,
      working_days_pending: p.assignment_id && p.assignment_status === 'pending'
        ? workingDaysSince(p.assigned_at) : 0,
      is_delayed: p.assignment_id && p.assignment_status === 'pending'
        ? workingDaysSince(p.assigned_at) >= 4 : false,
      shortfall: Math.max(0, (parseFloat(p.quantity) || 0) - (Number(p.quoted_qty) || 0)),
      is_over_selling: p.quote_count > 0 ? isOverSellingTotal(p.quoted_total_cost, p.selling_price, p.inquiry_type) : false,
    }));

    res.json({ parts: enriched, total, pages: Math.ceil(total / PAGE_SIZE), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Parts for an inquiry (assign modal) ───────────────────────
router.get('/inquiry-parts/:inquiryId', canManage, (req, res) => {
  const db = getDB();
  try {
    const parts = db.prepare(`${PART_SELECT} WHERE r.inquiry_id = ? ORDER BY r.id`).all(req.params.inquiryId);
    const inquiry = db.prepare('SELECT i.*, c.name as customer_name, c.company, ae.name as ae_name FROM inquiries i JOIN customers c ON i.customer_id=c.id LEFT JOIN users ae ON i.assigned_to=ae.id WHERE i.id=?').get(req.params.inquiryId);
    res.json({ inquiry, parts: parts.map(p => ({ ...p, is_delayed: p.assignment_id && p.assignment_status === 'pending' ? workingDaysSince(p.assigned_at) >= 4 : false })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Assign / reassign ──────────────────────────────────────────
// Create or update an assignment with consistent reassign semantics. Returns {id, prevPurchaser}.
// - new            → INSERT (urgency defaults to 'normal').
// - same purchaser → update notes/urgency only; PRESERVE status, assigned_at (delay clock), and quotes
//                    (a re-save must not reset a Quoted part to pending — that left status≠quote_count).
// - new purchaser  → reassign: the old purchaser's quotes no longer apply, so clear them and start the
//                    new purchaser fresh (status pending, clock reset).
// urgency/pm_notes are COALESCEd (null = keep existing — inline reassign sends neither, so a Critical
// part keeps its urgency).
function upsertAssignment(db, { requirement_id, purchaser_id, pm_notes, urgency }, byUserId) {
  const existing = db.prepare('SELECT id, purchaser_id FROM purchase_assignments WHERE requirement_id=?').get(requirement_id);
  if (!existing) {
    const r = db.prepare(`INSERT INTO purchase_assignments (requirement_id, purchaser_id, assigned_by, status, pm_notes, urgency)
      VALUES (?, ?, ?, 'pending', ?, ?)`).run(requirement_id, purchaser_id, byUserId, pm_notes || null, urgency || 'normal');
    return { id: r.lastInsertRowid, prevPurchaser: null };
  }
  if (String(existing.purchaser_id) === String(purchaser_id)) {
    db.prepare(`UPDATE purchase_assignments SET assigned_by=?, pm_notes=COALESCE(?, pm_notes), urgency=COALESCE(?, urgency) WHERE id=?`)
      .run(byUserId, pm_notes || null, urgency || null, existing.id);
    return { id: existing.id, prevPurchaser: existing.purchaser_id };
  }
  db.prepare('DELETE FROM purchase_quotes WHERE assignment_id=?').run(existing.id);
  db.prepare(`UPDATE purchase_assignments SET purchaser_id=?, assigned_by=?, status='pending', assigned_at=CURRENT_TIMESTAMP,
    pm_notes=COALESCE(?, pm_notes), urgency=COALESCE(?, urgency) WHERE id=?`)
    .run(purchaser_id, byUserId, pm_notes || null, urgency || null, existing.id);
  return { id: existing.id, prevPurchaser: existing.purchaser_id };
}

router.post('/assign', canManage, (req, res) => {
  const { requirement_id, purchaser_id, pm_notes, urgency } = req.body;
  if (!requirement_id || !purchaser_id) return res.status(400).json({ error: 'requirement_id and purchaser_id required' });
  const db = getDB();

  try {
    const { id: assignmentId, prevPurchaser } = upsertAssignment(db, { requirement_id, purchaser_id, pm_notes, urgency }, req.user.id);
    const existing = prevPurchaser != null ? { purchaser_id: prevPurchaser } : null;

    // Notify new purchaser
    const r = db.prepare('SELECT r.part_number, c.name as customer_name, i.type FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id WHERE r.id=?').get(requirement_id);
    db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment, assignment_id) VALUES (?,?,?,?,?,?,?,?)")
      .run(purchaser_id, null, 'part_assigned', r?.customer_name || '', req.user.name, 'Part assigned to you', r?.part_number || '', assignmentId);

    // Notify old purchaser if reassigned to a different person
    if (existing && String(existing.purchaser_id) !== String(purchaser_id)) {
      db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment, assignment_id) VALUES (?,?,?,?,?,?,?,?)")
        .run(existing.purchaser_id, null, 'part_reassigned', r?.customer_name || '', req.user.name, 'Part reassigned away from you', r?.part_number || '', assignmentId);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Bulk assign ────────────────────────────────────────────────
router.post('/assign-bulk', canManage, (req, res) => {
  const { assignments } = req.body;
  if (!assignments?.length) return res.status(400).json({ error: 'assignments array required' });
  const db = getDB();
  
  try {
    const notifStmt = db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment, assignment_id) VALUES (?,?,?,?,?,?,?,?)");
    let assigned = 0;

    db.transaction(() => {
      assignments.forEach(a => {
        if (!a.purchaser_id) return;
        const r = db.prepare('SELECT r.part_number, c.name as customer_name FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id WHERE r.id=?').get(a.requirement_id);
        // Shared semantics: preserves urgency/status on same-purchaser re-save; clears stale quotes on reassign.
        const { id: assignmentId, prevPurchaser } = upsertAssignment(db, a, req.user.id);
        assigned++;
        if (String(prevPurchaser ?? '') !== String(a.purchaser_id)) {
          notifStmt.run(a.purchaser_id, null, 'part_assigned', r?.customer_name || '', req.user.name, 'Part assigned to you', r?.part_number || '', assignmentId);
        }
        if (prevPurchaser != null && String(prevPurchaser) !== String(a.purchaser_id)) {
          notifStmt.run(prevPurchaser, null, 'part_reassigned', r?.customer_name || '', req.user.name, 'Part reassigned away from you', r?.part_number || '', assignmentId);
        }
      });
    })();
    res.json({ success: true, assigned });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Unassign ──────────────────────────────────────────────────
router.delete('/assign/:reqId', canManage, (req, res) => {
  try {
    getDB().prepare('DELETE FROM purchase_assignments WHERE requirement_id=?').run(req.params.reqId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update assignment (urgency, notes, not_in_stock) ──────────
router.patch('/assignment/:id', (req, res) => {
  const { urgency, pm_notes, purchaser_notes, not_in_stock } = req.body;
  const db = getDB();
  const ctx = getAssignmentCtx(db, req.params.id);
  if (!ctx) return res.status(404).json({ error: 'Assignment not found' });
  const mgr = isMgr(req.user.role);
  if (!mgr && ctx.purchaser_id !== req.user.id) return res.status(403).json({ error: 'Not your assignment' });

  const updates = [];
  const params = [];
  // urgency + pm_notes are manager-only fields; purchasers may only touch their own notes / stock flag.
  if (mgr && urgency !== undefined) { updates.push('urgency=?'); params.push(urgency); }
  if (mgr && pm_notes !== undefined) { updates.push('pm_notes=?'); params.push(pm_notes); }
  if (purchaser_notes !== undefined) { updates.push('purchaser_notes=?'); params.push(purchaser_notes); }
  if (not_in_stock !== undefined) { updates.push('not_in_stock=?'); params.push(not_in_stock ? 1 : 0); }
  if (!updates.length) return res.json({ success: true });
  params.push(req.params.id);
  
  try {
    db.prepare(`UPDATE purchase_assignments SET ${updates.join(',')} WHERE id=?`).run(...params);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── My assigned parts (purchaser, paginated) ──────────────────
router.get('/my-parts', (req, res) => {
  const db = getDB();
  const { type, status, page = 1, from, to } = req.query;
  let where = 'pa.purchaser_id=?';
  const params = [req.user.id];

  if (type) { where += ' AND i.type=?'; params.push(type); }
  if (status === 'pending') { where += " AND pa.status='pending' AND pa.not_in_stock=0"; }
  else if (status === 'quoted') { where += " AND pa.status='quoted'"; }
  else if (status === 'not_in_stock') { where += ' AND pa.not_in_stock=1'; }
  if (from) { where += ' AND date(i.created_at)>=?'; params.push(from); }
  if (to) { where += ' AND date(i.created_at)<=?'; params.push(to); }

  try {
    const total = db.prepare(`SELECT COUNT(*) as c FROM purchase_assignments pa JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id WHERE ${where}`).get(...params).c;
    // `all=1` returns every assigned part (for the filterable list view); otherwise paginate.
    const limitClause = req.query.all ? '' : `LIMIT ${PAGE_SIZE} OFFSET ${pageOffset(page)}`;
    const parts = db.prepare(`${PART_SELECT} WHERE ${where} ORDER BY CASE pa.urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, pa.not_in_stock ASC, pa.assigned_at ASC ${limitClause}`).all(...params);

    const enriched = parts.map(p => ({
      ...p,
      working_days_pending: p.assignment_status === 'pending' && !p.not_in_stock ? workingDaysSince(p.assigned_at) : 0,
      is_delayed: p.assignment_status === 'pending' && !p.not_in_stock ? workingDaysSince(p.assigned_at) >= 4 : false,
    }));

    res.json({ parts: enriched, total, pages: Math.ceil(total / PAGE_SIZE), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single part detail (for quote modal) ──────────────────
router.get('/part/:assignmentId', (req, res) => {
  const db = getDB();
  try {
    const part = db.prepare(`${PART_SELECT} WHERE pa.id=?`).get(req.params.assignmentId);
    if (!part) return res.status(404).json({ error: 'Not found' });
    if (!isMgr(req.user.role) && part.purchaser_id !== req.user.id && part.ae_id !== req.user.id)
      return res.status(403).json({ error: 'Not authorized for this part' });
    const comments = db.prepare('SELECT * FROM part_comments WHERE assignment_id=? ORDER BY created_at ASC').all(req.params.assignmentId);
    const followups = db.prepare('SELECT * FROM purchaser_followups WHERE assignment_id=? ORDER BY follow_up_date ASC, id ASC').all(req.params.assignmentId);
    // All sourcing entries (multi-supplier / partial). One row per supplier line.
    const quotes = db.prepare('SELECT * FROM purchase_quotes WHERE assignment_id=? ORDER BY id').all(req.params.assignmentId);
    res.json({
      ...part,
      working_days_pending: part.assignment_status === 'pending' && !part.not_in_stock ? workingDaysSince(part.assigned_at) : 0,
      is_delayed: part.assignment_status === 'pending' && !part.not_in_stock ? workingDaysSince(part.assigned_at) >= 4 : false,
      shortfall: Math.max(0, (parseFloat(part.quantity) || 0) - (Number(part.quoted_qty) || 0)),
      is_over_selling: part.quote_count > 0 ? isOverSellingTotal(part.quoted_total_cost, part.selling_price, part.inquiry_type) : false,
      comments,
      followups,
      quotes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Submit / update quote ─────────────────────────────────────
router.post('/quote', (req, res) => {
  const { assignment_id, entries, price, condition, lead_time, supplier_name, notes } = req.body;
  if (!assignment_id) return res.status(400).json({ error: 'assignment_id required' });
  const db = getDB();

  try {
    const a = db.prepare(`SELECT pa.*, r.part_number, r.quantity, i.id as inquiry_id, i.assigned_to as ae_id, i.type as inquiry_type, i.order_amount as selling_price, c.name as customer_name FROM purchase_assignments pa JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id WHERE pa.id=?`).get(assignment_id);
    if (!a) return res.status(404).json({ error: 'Assignment not found' });
    if (!isMgr(req.user.role) && a.purchaser_id !== req.user.id) return res.status(403).json({ error: 'Not your assignment' });

    // Accept multiple sourcing entries (supplier/qty/price); fall back to the legacy single-quote shape.
    const list = Array.isArray(entries) ? entries
      : [{ supplier_name, quantity: a.quantity, price, condition, lead_time, notes }];
    const clean = list.filter(e => (e.supplier_name && String(e.supplier_name).trim()) || e.price || e.quantity);

    db.transaction(() => {
      db.prepare('DELETE FROM purchase_quotes WHERE assignment_id=?').run(assignment_id);
      const ins = db.prepare('INSERT INTO purchase_quotes (assignment_id,requirement_id,purchaser_id,price,condition,lead_time,supplier_name,notes,quantity) VALUES (?,?,?,?,?,?,?,?,?)');
      // Credit the quote to the ASSIGNED purchaser, not the editor. A manager editing a
      // purchaser's quote must not re-attribute it to themselves (skews per-purchaser stats).
      // Falls back to the editor only when the assignment has no purchaser (manager-quoted).
      const quoteOwner = a.purchaser_id || req.user.id;
      clean.forEach(e => ins.run(assignment_id, a.requirement_id, quoteOwner,
        e.price ?? null, e.condition ?? null, e.lead_time ?? null, e.supplier_name ?? null, e.notes ?? null,
        e.quantity != null && e.quantity !== '' ? Number(e.quantity) : null));
      db.prepare("UPDATE purchase_assignments SET status=? WHERE id=?").run(clean.length ? 'quoted' : 'pending', assignment_id);
    })();

    // Totals across entries for the over-selling check + notification summary.
    const totalCost = clean.reduce((s, e) => s + num(e.price) * (Number(e.quantity) || 0), 0);
    const quotedQty = clean.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
    const reqQty = parseFloat(a.quantity) || 0;
    const short = Math.max(0, reqQty - quotedQty);
    const isOver = isOverSellingTotal(totalCost, a.selling_price, a.inquiry_type);
    const suppliers = [...new Set(clean.map(e => e.supplier_name).filter(Boolean))].join(', ');
    const overMsg = isOver ? ` ⚠️ OVER selling price ($${a.selling_price})` : '';
    const shortMsg = short > 0 ? `, ${short} short` : '';
    const msg = `${a.part_number} — ${quotedQty}/${reqQty} sourced${shortMsg}${suppliers ? ` · ${suppliers}` : ''}${overMsg}`;

    const notifyUsers = db.prepare("SELECT id FROM users WHERE role IN ('manager','purchasing_manager') OR id=?").all(a.ae_id);
    // assignment_id lets the AE/Manager click the notification straight into the record.
    const insN = db.prepare("INSERT INTO notifications (user_id,inquiry_id,inquiry_type,customer_name,actor_name,action,comment,assignment_id) VALUES (?,?,?,?,?,?,?,?)");
    notifyUsers.forEach(u => insN.run(u.id, a.inquiry_id, 'quote', a.customer_name, req.user.name, isOver ? '⚠️ Quote over selling price' : 'Quote submitted', msg, assignment_id));

    res.json({ success: true, is_over_selling: isOver, quoted_qty: quotedQty, shortfall: short });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Add comment on a part ─────────────────────────────────────
router.post('/comment/:assignmentId', (req, res) => {
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment required' });
  const db = getDB();
  try {
    const ctx = getAssignmentCtx(db, req.params.assignmentId);
    if (!ctx) return res.status(404).json({ error: 'Assignment not found' });
    if (!isMgr(req.user.role) && ctx.purchaser_id !== req.user.id && ctx.ae_id !== req.user.id)
      return res.status(403).json({ error: 'Not authorized for this part' });
    const result = db.prepare('INSERT INTO part_comments (assignment_id, user_id, user_name, user_role, comment) VALUES (?,?,?,?,?)').run(req.params.assignmentId, req.user.id, req.user.name, req.user.role, comment);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Purchaser followups ────────────────────────────────────────
router.post('/followup/:assignmentId', (req, res) => {
  const { note, follow_up_date } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'Note required' });
  const db = getDB();
  try {
    const ctx = getAssignmentCtx(db, req.params.assignmentId);
    if (!ctx) return res.status(404).json({ error: 'Assignment not found' });
    if (!isMgr(req.user.role) && ctx.purchaser_id !== req.user.id) return res.status(403).json({ error: 'Not your assignment' });
    const result = db.prepare('INSERT INTO purchaser_followups (assignment_id, purchaser_id, note, follow_up_date) VALUES (?,?,?,?)').run(req.params.assignmentId, req.user.id, note, follow_up_date || null);
    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/followup/:id/complete', (req, res) => {
  try {
    const db = getDB();
    const fu = db.prepare('SELECT purchaser_id FROM purchaser_followups WHERE id=?').get(req.params.id);
    if (!fu) return res.status(404).json({ error: 'Follow-up not found' });
    if (!isMgr(req.user.role) && fu.purchaser_id !== req.user.id) return res.status(403).json({ error: 'Not your follow-up' });
    db.prepare('UPDATE purchaser_followups SET completed=1 WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Get all quotes (PM) ────────────────────────────────────────
router.get('/quotes', canManage, (req, res) => {
  const db = getDB();
  const { page = 1, type, from, to } = req.query;
  let where = '1=1';
  const params = [];
  if (type) { where += ' AND i.type=?'; params.push(type); }
  if (from) { where += ' AND date(pq.updated_at)>=?'; params.push(from); }
  if (to) { where += ' AND date(pq.updated_at)<=?'; params.push(to); }

  try {
    const total = db.prepare(`SELECT COUNT(*) as c FROM purchase_quotes pq JOIN requirements r ON pq.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id WHERE ${where}`).get(...params).c;
    const quotes = db.prepare(`
      SELECT pq.*, r.part_number, r.quantity as line_quantity, pu.name as purchaser_name,
        c.name as customer_name, c.company as customer_company,
        i.type as inquiry_type, ae.name as ae_name, i.order_amount as selling_price,
        pa.urgency, pa.pm_notes,
        (SELECT COALESCE(SUM(COALESCE(q2.price,0) * COALESCE(q2.quantity,0)), 0)
           FROM purchase_quotes q2 WHERE q2.assignment_id = pq.assignment_id) AS assignment_total_cost
      FROM purchase_quotes pq
      JOIN purchase_assignments pa ON pq.assignment_id=pa.id
      JOIN requirements r ON pq.requirement_id=r.id
      JOIN inquiries i ON r.inquiry_id=i.id
      JOIN customers c ON i.customer_id=c.id
      LEFT JOIN users ae ON i.assigned_to=ae.id
      LEFT JOIN users pu ON pq.purchaser_id=pu.id
      WHERE ${where}
      ORDER BY pq.updated_at DESC
      LIMIT ${PAGE_SIZE} OFFSET ${pageOffset(page)}
    `).all(...params);

    const enriched = quotes.map(q => ({
      ...q,
      // Over-selling is a per-ASSIGNMENT property (Σ cost across all supplier entries vs order total),
      // consistent with the parts list / stats / part detail. assignment_total_cost lets the client Δ
      // column compare against the assignment total too.
      is_over_selling: isOverSellingTotal(q.assignment_total_cost, q.selling_price, q.inquiry_type),
    }));

    res.json({ quotes: enriched, total, pages: Math.ceil(total / PAGE_SIZE), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stats (PM + Purchaser) ─────────────────────────────────────
router.get('/stats', (req, res) => {
  const db = getDB();
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user.id;
  const isPM = ['purchasing_manager','manager'].includes(req.user.role);

  try {
    if (isPM) {
      const totalParts    = db.prepare("SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id WHERE r.part_number!=''").get().c;
      const unassigned    = db.prepare("SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id LEFT JOIN purchase_assignments pa ON pa.requirement_id=r.id WHERE pa.id IS NULL AND r.part_number!=''").get().c;
      const pending       = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE status='pending' AND not_in_stock=0").get().c;
      const quoted        = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE status='quoted'").get().c;
      const notInStock    = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE not_in_stock=1").get().c;
      const quotedToday   = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE date(updated_at)=?").get(today).c;
      const newToday      = db.prepare("SELECT COUNT(*) as c FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id WHERE date(i.created_at)=? AND r.part_number!=''").get(today).c;

      // Delayed: pending > 4 working days — counted in JS so the KPI matches the per-card ⚠️ badge exactly.
      const delayed = db.prepare("SELECT assigned_at FROM purchase_assignments WHERE status='pending' AND not_in_stock=0").all()
        .filter(r => workingDaysSince(r.assigned_at) >= 4).length;

      // Financial
      // One row per assignment: total buying cost = Σ(entry price × entry qty) across its sourcing entries.
      const allQuotes = db.prepare(`SELECT pa.id, i.order_amount as selling_price, i.type,
        SUM(CAST(REPLACE(REPLACE(IFNULL(pq.price,'0'),'$',''),',','') AS REAL) * COALESCE(pq.quantity,0)) as total_cost
        FROM purchase_quotes pq JOIN purchase_assignments pa ON pq.assignment_id=pa.id JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id GROUP BY pa.id`).all();
      let totalQuotedValue = 0, overSellingCount = 0;
      allQuotes.forEach(q => {
        totalQuotedValue += (Number(q.total_cost) || 0);
        if (isOverSellingTotal(q.total_cost, q.selling_price, q.type)) overSellingCount++;
      });
      const avgQuotePrice = allQuotes.length > 0 ? (totalQuotedValue / allQuotes.length).toFixed(2) : 0;

      const byType = db.prepare(`SELECT i.type, COUNT(*) as total, SUM(CASE WHEN pa.id IS NULL THEN 1 ELSE 0 END) as unassigned, SUM(CASE WHEN pa.status='pending' AND pa.not_in_stock=0 THEN 1 ELSE 0 END) as pending, SUM(CASE WHEN pa.status='quoted' THEN 1 ELSE 0 END) as quoted, SUM(CASE WHEN pa.not_in_stock=1 THEN 1 ELSE 0 END) as not_in_stock FROM requirements r JOIN inquiries i ON r.inquiry_id=i.id LEFT JOIN purchase_assignments pa ON pa.requirement_id=r.id WHERE r.part_number!='' GROUP BY i.type`).all();
      const byPurchaser = db.prepare(`SELECT u.id, u.name, COUNT(*) as assigned, SUM(CASE WHEN pa.status='quoted' THEN 1 ELSE 0 END) as quoted_count, SUM(CASE WHEN pa.status='pending' AND pa.not_in_stock=0 THEN 1 ELSE 0 END) as pending_count, SUM(CASE WHEN pa.not_in_stock=1 THEN 1 ELSE 0 END) as not_in_stock FROM purchase_assignments pa JOIN users u ON pa.purchaser_id=u.id GROUP BY pa.purchaser_id ORDER BY assigned DESC`).all();
      const recentQuotes = db.prepare(`SELECT pq.price, pq.condition, pq.updated_at, pq.quantity, r.part_number, pu.name as purchaser_name, c.name as customer_name, i.type as inquiry_type, i.order_amount as selling_price FROM purchase_quotes pq JOIN requirements r ON pq.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id LEFT JOIN users pu ON pq.purchaser_id=pu.id ORDER BY pq.updated_at DESC LIMIT 10`)
        .all().map(q => ({ ...q, is_over_selling: isOverSelling(q.price, q.quantity, q.selling_price, q.inquiry_type) }));
      const urgencyCounts = db.prepare("SELECT urgency, COUNT(*) as count FROM purchase_assignments WHERE status='pending' GROUP BY urgency").all();

      res.json({ isPM:true, totalParts, unassigned, pending, quoted, notInStock, quotedToday, newToday, delayed, totalQuotedValue: totalQuotedValue.toFixed(2), avgQuotePrice, overSellingCount, byType, byPurchaser, recentQuotes, urgencyCounts });
    } else {
      const myAssigned  = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=?").get(userId).c;
      const myPending   = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='pending' AND not_in_stock=0").get(userId).c;
      const myQuoted    = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='quoted'").get(userId).c;
      const myToday     = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND date(updated_at)=?").get(userId, today).c;
      const myWeek      = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND updated_at>=datetime('now','-7 days')").get(userId).c;
      const myMonth     = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND date(updated_at)>=?").get(userId, today.slice(0,8) + '01').c;
      const myNotInStock= db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND not_in_stock=1").get(userId).c;

      // Pending parts (one query drives delayed count, oldest age, and the Needs-Attention list).
      const pendingRows = db.prepare(`SELECT pa.id as assignment_id, pa.assigned_at, pa.urgency, r.part_number, c.name as customer_name
        FROM purchase_assignments pa JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id
        WHERE pa.purchaser_id=? AND pa.status='pending' AND pa.not_in_stock=0`).all(userId);
      const pendingAges = pendingRows.map(p => ({ ...p, days: workingDaysSince(p.assigned_at) }));
      const myDelayed = pendingAges.filter(p => p.days >= 4).length;
      const oldestPendingDays = pendingAges.reduce((m, p) => Math.max(m, p.days), 0);
      const needsAttention = pendingAges.filter(p => p.days >= 4).sort((a, b) => b.days - a.days).slice(0, 8);

      // Avg quoting time (hours) + on-time rate (quoted within 4 working days ≈ 96h)
      const quoteTimes = db.prepare(`SELECT (julianday(pq.created_at)-julianday(pa.assigned_at))*24 as hours FROM purchase_quotes pq JOIN purchase_assignments pa ON pq.assignment_id=pa.id WHERE pa.purchaser_id=?`).all(userId);
      const avgHours = quoteTimes.length > 0 ? (quoteTimes.reduce((s,q) => s+q.hours,0)/quoteTimes.length).toFixed(1) : null;
      const onTimeRate = quoteTimes.length > 0 ? Math.round(quoteTimes.filter(q => q.hours <= 96).length / quoteTimes.length * 100) : null;

      // Over-selling: this purchaser's quotes whose buying cost (price × qty) exceeds the website sell price
      const myQuoteRows = db.prepare(`SELECT pa.id, i.order_amount as selling_price, i.type,
        SUM(CAST(REPLACE(REPLACE(IFNULL(pq.price,'0'),'$',''),',','') AS REAL) * COALESCE(pq.quantity,0)) as total_cost
        FROM purchase_quotes pq JOIN purchase_assignments pa ON pq.assignment_id=pa.id JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id WHERE pq.purchaser_id=? GROUP BY pa.id`).all(userId);
      const myOverSelling = myQuoteRows.filter(q => isOverSellingTotal(q.total_cost, q.selling_price, q.type)).length;

      // My followups
      const overdueFollowups = db.prepare(`SELECT pf.*, r.part_number FROM purchaser_followups pf JOIN purchase_assignments pa ON pf.assignment_id=pa.id JOIN requirements r ON pa.requirement_id=r.id WHERE pf.purchaser_id=? AND pf.completed=0 AND pf.follow_up_date < ? ORDER BY pf.follow_up_date ASC LIMIT 10`).all(userId, today);
      const todayFollowups   = db.prepare(`SELECT pf.*, r.part_number FROM purchaser_followups pf JOIN purchase_assignments pa ON pf.assignment_id=pa.id JOIN requirements r ON pa.requirement_id=r.id WHERE pf.purchaser_id=? AND pf.completed=0 AND pf.follow_up_date = ? LIMIT 10`).all(userId, today);
      const upcomingFollowups= db.prepare(`SELECT pf.*, r.part_number FROM purchaser_followups pf JOIN purchase_assignments pa ON pf.assignment_id=pa.id JOIN requirements r ON pa.requirement_id=r.id WHERE pf.purchaser_id=? AND pf.completed=0 AND pf.follow_up_date > ? AND pf.follow_up_date <= date(?,'+'||7||' days') LIMIT 10`).all(userId, today, today);

      const byType = db.prepare(`SELECT i.type, COUNT(*) as total, SUM(CASE WHEN pa.status='pending' THEN 1 ELSE 0 END) as pending_count, SUM(CASE WHEN pa.status='quoted' THEN 1 ELSE 0 END) as quoted_count FROM purchase_assignments pa JOIN requirements r ON pa.requirement_id=r.id JOIN inquiries i ON r.inquiry_id=i.id WHERE pa.purchaser_id=? GROUP BY i.type`).all(userId);
      const myNotifications = db.prepare("SELECT * FROM notifications WHERE user_id=? AND inquiry_type IN ('part_assigned','part_reassigned','quote') ORDER BY created_at DESC LIMIT 20").all(userId);

      res.json({ isPM:false, myAssigned, myPending, myQuoted, myToday, myWeek, myMonth, myDelayed, myNotInStock,
        avgHours, onTimeRate, myOverSelling, oldestPendingDays, needsAttention,
        byType, followups:{ overdue:overdueFollowups, today:todayFollowups, upcoming:upcomingFollowups }, myNotifications });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Purchasers list ────────────────────────────────────────────
router.get('/purchasers', canManage, (req, res) => {
  try {
    res.json(getDB().prepare("SELECT id, name, username FROM users WHERE role='purchaser' ORDER BY name").all());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Suppliers (shared op_suppliers — purchasers pick + add while quoting) ───────
router.get('/suppliers', (req, res) => {
  const db = getDB();
  const { search } = req.query;
  try {
    const rows = search
      ? db.prepare("SELECT id, company, rep_name, email FROM op_suppliers WHERE company LIKE ? OR rep_name LIKE ? OR email LIKE ? ORDER BY company").all(`%${search}%`, `%${search}%`, `%${search}%`)
      : db.prepare("SELECT id, company, rep_name, email FROM op_suppliers ORDER BY company").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/suppliers', (req, res) => {
  const { company, email, phone, rep_name } = req.body;
  if (!company || !company.trim()) return res.status(400).json({ error: 'Company is required' });
  const db = getDB();
  try {
    // Reuse a same-named supplier (case-insensitive) instead of creating a duplicate.
    const existing = db.prepare("SELECT * FROM op_suppliers WHERE LOWER(company)=LOWER(?)").get(company.trim());
    if (existing) return res.json(existing);
    const result = db.prepare("INSERT INTO op_suppliers (company,email,phone,rep_name) VALUES (?,?,?,?)")
      .run(company.trim(), email || null, phone || null, rep_name || null);
    res.json(db.prepare("SELECT * FROM op_suppliers WHERE id=?").get(result.lastInsertRowid));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;