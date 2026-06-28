const express = require('express');
const { getDB } = require('../database');
const { authenticate, requireManager, requireCrmAccess } = require('../middleware/auth');
const { businessToday, localDate } = require('./businessTime');

const router = express.Router();
router.use(authenticate);
router.use(requireCrmAccess); // sales-side only — purchasing roles get 403

// Dispositions that take an inquiry out of the AE's "active" queue, per type.
function terminalDispositions(type) {
  return type === 'online_order' ? ['Processed', 'Cancelled'] : ['Closed Won', 'Closed Lost', 'Fake Lead', 'No response'];
}

function logActivity(db, entityId, user, action, comment = null) {
  db.prepare('INSERT INTO activity_log (entity_type, entity_id, user_id, user_name, action, comment) VALUES (?, ?, ?, ?, ?, ?)').run('inquiry', entityId, user.id, user.name, action, comment);
}

// Notify all managers about an AE action
function notifyManagers(db, { inquiry_id, inquiry_type, customer_name, actor_name, actor_role, action, comment }) {
  // Only notify when an AE does something (not when a manager acts on their own stuff)
  // Managers still get notified of all AE actions
  try {
    const managers = db.prepare("SELECT id FROM users WHERE role = 'manager'").all();
    const insert = db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment) VALUES (?, ?, ?, ?, ?, ?, ?)");
    managers.forEach(m => insert.run(m.id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment));
  } catch (err) {
    console.error('Notification logic error:', err.message);
  }
}

// Notify purchasing managers when parts are added to an inquiry, so they can assign purchasers.
// Targets the purchasing_manager role ONLY (per owner's call) — assigning parts is their job, even when
// a plain manager created the inquiry. inquiry_type is suffixed '_parts' — the PM "New Parts" tab filters on it.
function notifyPurchasingManagers(db, { inquiry_id, type, customer_name, actor_name, partNumbers }) {
  try {
    if (!partNumbers || !partNumbers.length) return;
    // Manager-level users (manager + purchasing_manager) all reach the Purchasing dashboard and can
    // assign parts, so all get the new-parts notification — not just purchasing_manager.
    const pms = db.prepare("SELECT id FROM users WHERE role IN ('manager','purchasing_manager')").all();
    if (!pms.length) return;
    const comment = partNumbers.slice(0, 8).join(', ') + (partNumbers.length > 8 ? ` +${partNumbers.length - 8} more` : '');
    const insert = db.prepare("INSERT INTO notifications (user_id, inquiry_id, inquiry_type, customer_name, actor_name, action, comment) VALUES (?, ?, ?, ?, ?, ?, ?)");
    pms.forEach(m => insert.run(m.id, inquiry_id, `${type}_parts`, customer_name, actor_name, 'added parts', comment));
  } catch (err) {
    console.error('Purchasing notification error:', err.message);
  }
}

function buildInFilter(column, value) {
  if (!value) return null;
  const values = value.split(',').map(v => v.trim()).filter(Boolean);
  if (!values.length) return null;
  return { sql: `${column} IN (${values.map(() => '?').join(',')})`, params: values };
}

router.get('/', (req, res) => {
  const db = getDB();
  const { type, disposition, lead_source, from, to, assigned_to } = req.query;
  let query = `
    SELECT i.*, c.name as customer_name, c.email as customer_email, c.company as customer_company,
      c.phone as customer_phone, c.lead_source, u.name as assigned_name
    FROM inquiries i
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN users u ON i.assigned_to = u.id WHERE 1=1
  `;
  const params = [];
  if (req.user.role === 'ae') { query += ' AND i.assigned_to = ?'; params.push(req.user.id); }
  if (type) { query += ' AND i.type = ?'; params.push(type); }
  if (disposition) { const f = buildInFilter('i.disposition', disposition); if (f) { query += ` AND ${f.sql}`; params.push(...f.params); } }
  if (lead_source) { const f = buildInFilter('c.lead_source', lead_source); if (f) { query += ` AND ${f.sql}`; params.push(...f.params); } }
  // Managers can scope to one or more reps (comma-list); AEs are already locked to their own id above.
  if (assigned_to && req.user.role !== 'ae') { const f = buildInFilter('i.assigned_to', assigned_to); if (f) { query += ` AND ${f.sql}`; params.push(...f.params); } }
  if (from) { query += ` AND ${localDate('i.created_at')} >= ?`; params.push(from); }
  if (to)   { query += ` AND ${localDate('i.created_at')} <= ?`; params.push(to); }
  query += ' ORDER BY i.created_at DESC';
  
  try {
    const inquiries = db.prepare(query).all(...params);
    // Batch the requirements in a single IN-query instead of one query per inquiry (N+1).
    const ids = inquiries.map(i => i.id);
    const byInq = {};
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      for (const r of db.prepare(`SELECT * FROM requirements WHERE inquiry_id IN (${ph})`).all(...ids)) {
        (byInq[r.inquiry_id] = byInq[r.inquiry_id] || []).push(r);
      }
    }
    res.json(inquiries.map(inq => ({ ...inq, requirements: byInq[inq.id] || [] })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/stats', (req, res) => {
  const db = getDB();
  const userId = req.user.role === 'ae' ? req.user.id : null;
  const w = userId ? 'AND assigned_to = ?' : '';
  const p = (extra = []) => userId ? [userId, ...extra] : extra;
  
  try {
    const count = (type) => db.prepare(`SELECT COUNT(*) as c FROM inquiries WHERE type=? ${w}`).get(...p([type])).c;
    const today = businessToday();
    const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const upcomingFollowups = db.prepare(`SELECT COUNT(*) as c FROM followups f JOIN inquiries i ON f.inquiry_id = i.id WHERE f.completed=0 AND f.follow_up_date BETWEEN ? AND ? ${userId ? 'AND i.assigned_to=?' : ''}`).get(...(userId ? [today, next7, userId] : [today, next7])).c;
    res.json({ leads: count('lead'), repeat: count('repeat'), orders: count('online_order'), upcomingFollowups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AE "Newly Assigned" widget: the rep's active inquiries of a type they haven't viewed yet.
// Server-side "seen" state (inquiry_views) so it's consistent across browsers. Defined before
// '/:id' so the literal path wins.
router.get('/new', (req, res) => {
  if (req.user.role !== 'ae') return res.json([]);
  const { type } = req.query;
  if (!type) return res.status(400).json({ error: 'type required' });
  const db = getDB();
  try {
    const terminal = terminalDispositions(type);
    const ph = terminal.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT i.id, i.type, i.disposition, i.order_amount, i.created_at, c.name as customer_name, c.lead_source
      FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.assigned_to = ? AND i.type = ? AND i.disposition NOT IN (${ph})
        AND NOT EXISTS (SELECT 1 FROM inquiry_views v WHERE v.inquiry_id = i.id AND v.user_id = ?)
      ORDER BY i.created_at DESC`).all(req.user.id, type, ...terminal, req.user.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark every currently-new inquiry of a type as seen ("Read all").
router.post('/seen-all', (req, res) => {
  const { type } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });
  const db = getDB();
  try {
    const terminal = terminalDispositions(type);
    const ph = terminal.map(() => '?').join(',');
    db.prepare(`
      INSERT OR IGNORE INTO inquiry_views (user_id, inquiry_id)
      SELECT ?, i.id FROM inquiries i
      WHERE i.assigned_to = ? AND i.type = ? AND i.disposition NOT IN (${ph})`).run(req.user.id, req.user.id, type, ...terminal);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { customer_id, type, disposition, assigned_to, notes, requirements, ppc_or_outbound, order_amount, order_ref, custom_date } = req.body;
  if (!customer_id || !type) return res.status(400).json({ error: 'customer_id and type required' });
  const db = getDB();
  const assignee = req.user.role === 'ae' ? req.user.id : (assigned_to || req.user.id);

  const createdAt = custom_date ? new Date(custom_date).toISOString() : new Date().toISOString();

  try {
    const result = db.prepare('INSERT INTO inquiries (customer_id, type, disposition, assigned_to, notes, ppc_or_outbound, order_amount, order_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(customer_id, type, disposition || 'Initial Contact', assignee, notes || null, ppc_or_outbound || null, order_amount || null, order_ref || null, createdAt, createdAt);
    const inquiryId = result.lastInsertRowid;

    const newParts = [];
    if (requirements?.length) {
      const ins = db.prepare('INSERT INTO requirements (inquiry_id, part_number, quantity) VALUES (?, ?, ?)');
      requirements.forEach(r => { if (r.part_number?.trim()) { ins.run(inquiryId, r.part_number, r.quantity); newParts.push(r.part_number.trim()); } });
    }

    logActivity(db, inquiryId, req.user, `${type} created`);

    const customer = db.prepare('SELECT name FROM customers WHERE id = ?').get(customer_id);
    notifyPurchasingManagers(db, { inquiry_id: inquiryId, type, customer_name: customer?.name || 'Unknown', actor_name: req.user.name, partNumbers: newParts });
    notifyManagers(db, {
      inquiry_id: inquiryId, inquiry_type: type,
      customer_name: customer?.name || 'Unknown',
      actor_name: req.user.name,
      actor_role: req.user.role,
      action: `New ${type === 'lead' ? 'Lead' : type === 'repeat' ? 'Repeat Inquiry' : 'Online Order'} created`,
      comment: null,
    });

    res.json({ id: inquiryId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const db = getDB();
  try {
    const inquiry = db.prepare(`SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.company as customer_company, c.lead_source, u.name as assigned_name FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id WHERE i.id = ?`).get(req.params.id);
    if (!inquiry) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'ae' && inquiry.assigned_to !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    // Enrich each part with its sourcing entries (multi-supplier / partial). Each part can have
    // several supplier quotes; we attach the full list plus a sourced/shortfall summary for the rep.
    const numVal = (v) => { const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : n; };
    const reqRows = db.prepare('SELECT * FROM requirements WHERE inquiry_id = ? ORDER BY id').all(req.params.id);
    const requirements = reqRows.map(r => {
      const a = db.prepare('SELECT id, status, not_in_stock, purchaser_id FROM purchase_assignments WHERE requirement_id = ?').get(r.id);
      const quotes = a ? db.prepare(`SELECT pq.price, pq.condition, pq.lead_time, pq.supplier_name, pq.quantity, pq.updated_at, pu.name AS purchaser_name
        FROM purchase_quotes pq LEFT JOIN users pu ON pq.purchaser_id = pu.id WHERE pq.assignment_id = ? ORDER BY pq.id`).all(a.id) : [];
      const quoted_qty = quotes.reduce((s, q) => s + (Number(q.quantity) || 0), 0);
      const quote_total_cost = quotes.reduce((s, q) => s + numVal(q.price) * (Number(q.quantity) || 0), 0);
      return {
        ...r, quotes, quoted_qty, quote_total_cost,
        assignment_status: a?.status || null, not_in_stock: a?.not_in_stock || 0,
        shortfall: Math.max(0, (parseFloat(r.quantity) || 0) - quoted_qty),
      };
    });
    const followups = db.prepare(`SELECT f.*, u.name as created_by_name FROM followups f LEFT JOIN users u ON f.created_by = u.id WHERE f.inquiry_id = ? ORDER BY f.created_at DESC`).all(req.params.id);
    const activity = db.prepare("SELECT * FROM activity_log WHERE entity_type='inquiry' AND entity_id=? ORDER BY created_at DESC").all(req.params.id);
    res.json({ ...inquiry, requirements, followups, activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { disposition, assigned_to, notes, requirements, ppc_or_outbound, order_amount, order_ref, custom_date } = req.body;
  const db = getDB();

  try {
    const inquiry = db.prepare('SELECT i.type, i.disposition as old_disposition, i.assigned_to, c.name as customer_name FROM inquiries i JOIN customers c ON i.customer_id = c.id WHERE i.id = ?').get(req.params.id);
    if (!inquiry) return res.status(404).json({ error: 'Not found' });
    // AEs may only edit their own inquiries, and cannot reassign them.
    if (req.user.role === 'ae' && inquiry.assigned_to !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    // Managers keep the current assignee when the request omits assigned_to (or sends null),
    // so a partial update (e.g. just a disposition change) can't silently unassign the inquiry.
    // A new assignee must be a real user.
    const newAssignee = req.user.role === 'ae' ? inquiry.assigned_to : (assigned_to ?? inquiry.assigned_to);
    if (req.user.role !== 'ae' && newAssignee != null && String(newAssignee) !== String(inquiry.assigned_to)) {
      const target = db.prepare('SELECT id FROM users WHERE id = ?').get(newAssignee);
      if (!target) return res.status(400).json({ error: 'Assigned user not found' });
    }
    const createdAt = custom_date ? new Date(custom_date).toISOString() : null;
    const dispositionChanged = disposition !== inquiry.old_disposition;

    db.prepare(`UPDATE inquiries SET disposition=?, assigned_to=?, notes=?, ppc_or_outbound=?, order_amount=?, order_ref=?, created_at=COALESCE(?, created_at), updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(disposition, newAssignee, notes, ppc_or_outbound || null, order_amount || null, order_ref || null, createdAt, req.params.id);
    // Reassigned to a different rep → clear seen state so it surfaces as "new" for the new owner.
    if (String(newAssignee) !== String(inquiry.assigned_to)) {
      db.prepare('DELETE FROM inquiry_views WHERE inquiry_id = ?').run(req.params.id);
    }
    let addedParts = [];
    if (requirements !== undefined) {
      // Capture the existing part numbers so we only notify PMs about NEWLY added parts (not every edit).
      const oldParts = new Set(db.prepare('SELECT part_number FROM requirements WHERE inquiry_id = ?').all(req.params.id).map(r => (r.part_number || '').trim().toLowerCase()).filter(Boolean));
      db.prepare('DELETE FROM requirements WHERE inquiry_id = ?').run(req.params.id);
      if (requirements.length) { const ins = db.prepare('INSERT INTO requirements (inquiry_id, part_number, quantity) VALUES (?, ?, ?)'); requirements.forEach(r => { if (r.part_number?.trim()) ins.run(req.params.id, r.part_number, r.quantity); }); }
      addedParts = (requirements || []).filter(r => r.part_number?.trim() && !oldParts.has(r.part_number.trim().toLowerCase())).map(r => r.part_number.trim());
    }

    // If the inquiry is moving OUT of its won/processed state, void the PENDING draft op_order
    // that Closed-Won/Processed created (linked by crm_inquiry_id). Only pending drafts are
    // removed — a finalized (non-pending) order is left untouched. Prevents orphaned drafts
    // with no matching won inquiry. Re-winning recreates the draft (from-crm dedups by inquiry).
    const wonStates = inquiry.type === 'online_order' ? ['Processed'] : ['Closed Won'];
    if (dispositionChanged && wonStates.includes(inquiry.old_disposition) && !wonStates.includes(disposition)) {
      try {
        const drafts = db.prepare('SELECT id FROM op_orders WHERE crm_inquiry_id = ? AND pending = 1').all(req.params.id);
        const delItemPay = db.prepare('DELETE FROM op_item_payments WHERE order_item_id IN (SELECT id FROM op_order_items WHERE order_id = ?)');
        const delItems   = db.prepare('DELETE FROM op_order_items WHERE order_id = ?');
        const delOrdPay  = db.prepare('DELETE FROM op_order_payments WHERE order_id = ?');
        const delOrder   = db.prepare('DELETE FROM op_orders WHERE id = ?');
        drafts.forEach(o => { delItemPay.run(o.id); delItems.run(o.id); delOrdPay.run(o.id); delOrder.run(o.id); });
        if (drafts.length) logActivity(db, req.params.id, req.user, `Voided ${drafts.length} pending draft order(s) — disposition left "${inquiry.old_disposition}"`);
      } catch (e) { console.error('Void pending draft order error:', e.message); }
    }

    logActivity(db, req.params.id, req.user, 'Inquiry updated');
    if (addedParts.length) notifyPurchasingManagers(db, { inquiry_id: parseInt(req.params.id), type: inquiry?.type, customer_name: inquiry?.customer_name || 'Unknown', actor_name: req.user.name, partNumbers: addedParts });

    if (dispositionChanged) {
      notifyManagers(db, {
        inquiry_id: parseInt(req.params.id),
        inquiry_type: inquiry?.type,
        customer_name: inquiry?.customer_name || 'Unknown',
        actor_name: req.user.name,
        actor_role: req.user.role,
        action: `Disposition changed to "${disposition}"`,
        comment: null,
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark a single inquiry as seen by the current user (clears it from "Newly Assigned").
router.post('/:id/seen', (req, res) => {
  try {
    getDB().prepare('INSERT OR IGNORE INTO inquiry_views (user_id, inquiry_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireManager, (req, res) => {
  try {
    getDB().prepare('DELETE FROM inquiries WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/comments', (req, res) => {
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  const db = getDB();

  try {
    const inquiry = db.prepare('SELECT i.type, c.name as customer_name FROM inquiries i JOIN customers c ON i.customer_id = c.id WHERE i.id = ?').get(req.params.id);

    logActivity(db, req.params.id, req.user, 'Comment', comment);

    notifyManagers(db, {
      inquiry_id: parseInt(req.params.id),
      inquiry_type: inquiry?.type,
      customer_name: inquiry?.customer_name || 'Unknown',
      actor_name: req.user.name,
      actor_role: req.user.role,
      action: 'Added a comment',
      comment: comment.length > 80 ? comment.slice(0, 80) + '...' : comment,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/followups', (req, res) => {
  const { note, follow_up_date } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'Note required' });
  const db = getDB();

  try {
    const inquiry = db.prepare('SELECT i.type, c.name as customer_name FROM inquiries i JOIN customers c ON i.customer_id = c.id WHERE i.id = ?').get(req.params.id);

    const result = db.prepare('INSERT INTO followups (inquiry_id, note, follow_up_date, created_by) VALUES (?, ?, ?, ?)').run(req.params.id, note, follow_up_date || null, req.user.id);
    logActivity(db, req.params.id, req.user, 'Follow-up added', note);

    notifyManagers(db, {
      inquiry_id: parseInt(req.params.id),
      inquiry_type: inquiry?.type,
      customer_name: inquiry?.customer_name || 'Unknown',
      actor_name: req.user.name,
      actor_role: req.user.role,
      action: `Added a follow-up${follow_up_date ? ` for ${follow_up_date}` : ''}`,
      comment: note.length > 80 ? note.slice(0, 80) + '...' : note,
    });

    res.json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/followups/:id', (req, res) => {
  const { completed, note, follow_up_date } = req.body;
  const db = getDB();
  try {
    // Same ownership rule as completing a follow-up: manager, inquiry assignee, or creator only.
    const fu = db.prepare('SELECT f.created_by, i.assigned_to FROM followups f JOIN inquiries i ON f.inquiry_id = i.id WHERE f.id = ?').get(req.params.id);
    if (!fu) return res.status(404).json({ error: 'Follow-up not found' });
    const isManager = ['manager', 'purchasing_manager'].includes(req.user.role);
    if (!isManager && fu.assigned_to !== req.user.id && fu.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not your follow-up' });
    }
    db.prepare('UPDATE followups SET completed=?, note=?, follow_up_date=? WHERE id=?').run(completed ? 1 : 0, note, follow_up_date || null, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/followups/:id', requireManager, (req, res) => {
  try {
    getDB().prepare('DELETE FROM followups WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;