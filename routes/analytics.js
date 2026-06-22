const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function buildInFilter(column, value) {
  if (!value) return null;
  const values = value.split(',').map(v => v.trim()).filter(Boolean);
  if (!values.length) return null;
  return { sql: `${column} IN (${values.map(() => '?').join(',')})`, params: values };
}

// Parse order amount string to number
function parseAmount(str) {
  if (!str) return 0;
  const n = parseFloat(String(str).replace(/[$,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

// Main analytics (overview)
router.get('/', (req, res) => {
  const db = getDB();
  const { from, to, lead_source, disposition, assigned_to, type } = req.query;
  const userId = req.user.role === 'ae' ? req.user.id : (assigned_to && !assigned_to.includes(',') ? assigned_to : null);
  const filters = []; const params = [];

  if (userId) { filters.push('i.assigned_to = ?'); params.push(userId); }
  if (req.user.role === 'manager' && assigned_to && assigned_to.includes(',')) {
    const f = buildInFilter('i.assigned_to', assigned_to); if (f) { filters.push(f.sql); params.push(...f.params); }
  }
  if (from) { filters.push("date(i.created_at) >= ?"); params.push(from); }
  if (to) { filters.push("date(i.created_at) <= ?"); params.push(to); }
  if (disposition) { const f = buildInFilter('i.disposition', disposition); if (f) { filters.push(f.sql); params.push(...f.params); } }
  if (lead_source) { const f = buildInFilter('c.lead_source', lead_source); if (f) { filters.push(f.sql); params.push(...f.params); } }
  if (type) { const f = buildInFilter('i.type', type); if (f) { filters.push(f.sql); params.push(...f.params); } }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const base = `FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id ${where}`;

  try {
    const totals = db.prepare(`SELECT i.type, COUNT(*) as count ${base} GROUP BY i.type`).all(...params);
    const byDisposition = db.prepare(`SELECT i.disposition, COUNT(*) as count ${base} GROUP BY i.disposition ORDER BY count DESC`).all(...params);
    const bySource = db.prepare(`SELECT c.lead_source as source, COUNT(*) as count ${base} GROUP BY c.lead_source ORDER BY count DESC`).all(...params);
    const byPerson = db.prepare(`SELECT u.name as name, COUNT(*) as count ${base} GROUP BY i.assigned_to, u.name ORDER BY count DESC`).all(...params);

    const trendFilters = [...filters]; const trendParams = [...params];
    if (!from && !to) trendFilters.push("date(i.created_at) >= date('now', '-30 days')");
    const trendWhere = trendFilters.length ? 'WHERE ' + trendFilters.join(' AND ') : '';
    const trend = db.prepare(`SELECT date(i.created_at) as date, i.type, COUNT(*) as count FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id ${trendWhere} GROUP BY date(i.created_at), i.type ORDER BY date ASC`).all(...trendParams);

    const totalCount = db.prepare(`SELECT COUNT(*) as c ${base}`).get(...params).c;
    const wonWhere = 'WHERE ' + [...filters, "i.disposition = 'Closed Won'"].join(' AND ');
    const wonCount = db.prepare(`SELECT COUNT(*) as c FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id ${wonWhere}`).get(...params).c;

    const fuFilters = []; const fuParams = [];
    if (req.user.role === 'ae') { fuFilters.push('i.assigned_to = ?'); fuParams.push(req.user.id); }
    else if (userId) { fuFilters.push('i.assigned_to = ?'); fuParams.push(userId); }
    fuFilters.push("f.completed = 0", "f.follow_up_date >= date('now')");
    const upcomingFollowups = db.prepare(`SELECT f.*, i.type, c.name as customer_name, u.name as assigned_name FROM followups f JOIN inquiries i ON f.inquiry_id = i.id JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id WHERE ${fuFilters.join(' AND ')} ORDER BY f.follow_up_date ASC LIMIT 10`).all(...fuParams);

    res.json({ totals, byDisposition, bySource, byPerson, trend, totalCount, wonCount, upcomingFollowups });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Detailed module analytics
router.get('/module', (req, res) => {
  const db = getDB();
  const { type, from, to, assigned_to } = req.query;
  if (!type) return res.status(400).json({ error: 'type required' });

  const userId = req.user.role === 'ae' ? req.user.id : (assigned_to || null);
  const today = new Date().toISOString().split('T')[0];

  const filters = [`i.type = ?`]; const params = [type];
  if (userId) { filters.push('i.assigned_to = ?'); params.push(userId); }
  if (from) { filters.push("date(i.created_at) >= ?"); params.push(from); }
  if (to) { filters.push("date(i.created_at) <= ?"); params.push(to); }

  const todayFilters = [`i.type = ?`, `date(i.created_at) = ?`]; const todayParams = [type, today];
  if (userId) { todayFilters.push('i.assigned_to = ?'); todayParams.push(userId); }

  const where = 'WHERE ' + filters.join(' AND ');
  const todayWhere = 'WHERE ' + todayFilters.join(' AND ');
  const base = `FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id`;

  try {
    if (type === 'online_order') {
      // Period stats
      const periodTotal = db.prepare(`SELECT COUNT(*) as c ${base} ${where}`).get(...params).c;
      const periodProcessed = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Processed'`).get(...params).c;
      const periodCancelled = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Cancelled'`).get(...params).c;
      const periodVerified = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.order_ref = 'Verified'`).get(...params).c;
      const periodNotVerified = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.order_ref = 'Not Verified'`).get(...params).c;
      const allOrders = db.prepare(`SELECT i.order_amount ${base} ${where}`).all(...params);
      const periodValue = allOrders.reduce((sum, o) => sum + parseAmount(o.order_amount), 0);

      // Today stats
      const todayTotal = db.prepare(`SELECT COUNT(*) as c ${base} ${todayWhere}`).get(...todayParams).c;
      const todayVerified = db.prepare(`SELECT COUNT(*) as c ${base} ${todayWhere} AND i.order_ref = 'Verified'`).get(...todayParams).c;
      const todayNotVerified = db.prepare(`SELECT COUNT(*) as c ${base} ${todayWhere} AND i.order_ref = 'Not Verified'`).get(...todayParams).c;
      const todayOrders = db.prepare(`SELECT i.order_amount ${base} ${todayWhere}`).all(...todayParams);
      const todayValue = todayOrders.reduce((sum, o) => sum + parseAmount(o.order_amount), 0);
      const todayProcessed = db.prepare(`SELECT COUNT(*) as c ${base} ${todayWhere} AND i.disposition = 'Processed'`).get(...todayParams).c;
      const todayCancelled = db.prepare(`SELECT COUNT(*) as c ${base} ${todayWhere} AND i.disposition = 'Cancelled'`).get(...todayParams).c;

      // By source
      const bySource = db.prepare(`SELECT c.lead_source as source, COUNT(*) as count ${base} ${where} GROUP BY c.lead_source ORDER BY count DESC`).all(...params);
      const byPerson = db.prepare(`SELECT u.name, COUNT(*) as count, SUM(CASE WHEN i.disposition='Processed' THEN 1 ELSE 0 END) as processed ${base} ${where} GROUP BY i.assigned_to, u.name ORDER BY count DESC`).all(...params);

      // Trend
      const trend = db.prepare(`SELECT date(i.created_at) as date, COUNT(*) as total, SUM(CASE WHEN i.disposition='Processed' THEN 1 ELSE 0 END) as processed, SUM(CASE WHEN i.disposition='Cancelled' THEN 1 ELSE 0 END) as cancelled ${base} ${where} GROUP BY date(i.created_at) ORDER BY date ASC`).all(...params);

      res.json({ type, today: { total: todayTotal, verified: todayVerified, not_verified: todayNotVerified, value: todayValue, processed: todayProcessed, cancelled: todayCancelled }, period: { total: periodTotal, processed: periodProcessed, cancelled: periodCancelled, verified: periodVerified, not_verified: periodNotVerified, value: periodValue }, bySource, byPerson, trend });

    } else if (type === 'repeat') {
      const periodTotal = db.prepare(`SELECT COUNT(*) as c ${base} ${where}`).get(...params).c;
      const ppc = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.ppc_or_outbound = 'PPC'`).get(...params).c;
      const outbound = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.ppc_or_outbound = 'Outbound Repeat'`).get(...params).c;
      const todayTotal = db.prepare(`SELECT COUNT(*) as c ${base} ${todayWhere}`).get(...todayParams).c;
      const byDisposition = db.prepare(`SELECT i.disposition, COUNT(*) as count ${base} ${where} GROUP BY i.disposition ORDER BY count DESC`).all(...params);
      const byPerson = db.prepare(`SELECT u.name, COUNT(*) as count ${base} ${where} GROUP BY i.assigned_to, u.name ORDER BY count DESC`).all(...params);
      const trend = db.prepare(`SELECT date(i.created_at) as date, COUNT(*) as total ${base} ${where} GROUP BY date(i.created_at) ORDER BY date ASC`).all(...params);
      const closedWon = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Closed Won'`).get(...params).c;

      res.json({ type, today: { total: todayTotal }, period: { total: periodTotal, ppc, outbound, closed_won: closedWon, win_rate: periodTotal > 0 ? Math.round(closedWon / periodTotal * 100) : 0 }, byDisposition, byPerson, trend });

    } else if (type === 'lead') {
      const periodTotal = db.prepare(`SELECT COUNT(*) as c ${base} ${where}`).get(...params).c;
      const todayTotal = db.prepare(`SELECT COUNT(*) as c ${base} ${todayWhere}`).get(...todayParams).c;
      const closedWon = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Closed Won'`).get(...params).c;
      const closedLost = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Closed Lost'`).get(...params).c;
      const byDisposition = db.prepare(`SELECT i.disposition, COUNT(*) as count ${base} ${where} GROUP BY i.disposition ORDER BY count DESC`).all(...params);
      const bySource = db.prepare(`SELECT c.lead_source as source, COUNT(*) as count ${base} ${where} GROUP BY c.lead_source ORDER BY count DESC`).all(...params);
      const byPerson = db.prepare(`SELECT u.name, COUNT(*) as count ${base} ${where} GROUP BY i.assigned_to, u.name ORDER BY count DESC`).all(...params);
      const trend = db.prepare(`SELECT date(i.created_at) as date, COUNT(*) as total, SUM(CASE WHEN i.disposition='Closed Won' THEN 1 ELSE 0 END) as won ${base} ${where} GROUP BY date(i.created_at) ORDER BY date ASC`).all(...params);
      const quoted = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Quoted'`).get(...params).c;
      const bidding = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Bidding'`).get(...params).c;
      const fake = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Fake Lead'`).get(...params).c;
      const noResponse = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'No response'`).get(...params).c;
      const cold = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Cold'`).get(...params).c;
      const inProgress = periodTotal - closedWon - closedLost;

      // Per-AE breakdown for the performance table (manager only)
      const monthStart = new Date(); monthStart.setDate(1);
      const ms = monthStart.toISOString().split('T')[0];
      const aeBase = `FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id JOIN users u ON i.assigned_to = u.id WHERE i.type = 'lead' AND u.role = 'ae'`;
      const aePerformance = db.prepare(`
        SELECT u.id, u.name,
          COUNT(*) as total,
          SUM(CASE WHEN date(i.created_at) = ? THEN 1 ELSE 0 END) as today,
          SUM(CASE WHEN date(i.created_at) >= ? THEN 1 ELSE 0 END) as this_month,
          SUM(CASE WHEN i.disposition='Closed Won' THEN 1 ELSE 0 END) as won,
          SUM(CASE WHEN i.disposition='Closed Lost' THEN 1 ELSE 0 END) as lost,
          SUM(CASE WHEN i.disposition='Quoted' THEN 1 ELSE 0 END) as quoted,
          SUM(CASE WHEN i.disposition='Bidding' THEN 1 ELSE 0 END) as bidding,
          SUM(CASE WHEN i.disposition='Fake Lead' THEN 1 ELSE 0 END) as fake,
          SUM(CASE WHEN i.disposition='No response' THEN 1 ELSE 0 END) as no_response,
          SUM(CASE WHEN i.disposition='Cold' THEN 1 ELSE 0 END) as cold
        ${aeBase} GROUP BY i.assigned_to, u.id, u.name ORDER BY total DESC`).all(today, ms);

      const aeSourceBreakdown = db.prepare(`
        SELECT u.name as ae_name, c.lead_source as source, COUNT(*) as count
        ${aeBase} AND c.lead_source IS NOT NULL
        GROUP BY i.assigned_to, u.name, c.lead_source ORDER BY count DESC`).all();

      const todayPerAE = db.prepare(`
        SELECT u.name, COUNT(*) as count
        ${aeBase} AND date(i.created_at) = ?
        GROUP BY i.assigned_to, u.name ORDER BY count DESC`).all(today);

      res.json({ type, today: { total: todayTotal, perAE: todayPerAE }, period: { total: periodTotal, closed_won: closedWon, closed_lost: closedLost, quoted, bidding, fake, no_response: noResponse, cold, in_progress: inProgress, win_rate: periodTotal > 0 ? Math.round(closedWon / periodTotal * 100) : 0 }, byDisposition, bySource, byPerson, trend, aePerformance, aeSourceBreakdown });
    }
  } catch (err) {
    console.error('Module analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// AE overview — personal dashboard summary
router.get('/ae', (req, res) => {
  const db = getDB();
  const uid = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  const base = `FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.assigned_to = ?`;

  try {
    // Today counts
    const todayLeads   = db.prepare(`SELECT COUNT(*) as c ${base} AND i.type='lead'         AND date(i.created_at)=?`).get(uid, today).c;
    const todayRepeat  = db.prepare(`SELECT COUNT(*) as c ${base} AND i.type='repeat'        AND date(i.created_at)=?`).get(uid, today).c;
    const todayOrders  = db.prepare(`SELECT COUNT(*) as c ${base} AND i.type='online_order'  AND date(i.created_at)=?`).get(uid, today).c;

    // Helper: won/total/rate for a date range (all types combined)
    function stats(from, to) {
      let sql = `SELECT COUNT(*) as total, SUM(CASE WHEN i.disposition='Closed Won' THEN 1 ELSE 0 END) as won ${base}`;
      const p = [uid];
      if (from) { sql += ` AND date(i.created_at) >= ?`; p.push(from); }
      if (to)   { sql += ` AND date(i.created_at) <= ?`; p.push(to); }
      const r = db.prepare(sql).get(...p);
      const total = r.total || 0; const won = r.won || 0;
      return { total, won, win_rate: total > 0 ? Math.round(won / total * 100) : 0 };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const yearStart  = `${now.getFullYear()}-01-01`;

    const month = stats(monthStart, today);
    const year  = stats(yearStart, today);
    const all   = stats(null, null);

    // Weekly trend — last 8 weeks
    const weeklyTrend = [];
    for (let w = 7; w >= 0; w--) {
      const wEnd = new Date(now); wEnd.setDate(wEnd.getDate() - w * 7);
      const wStart = new Date(wEnd); wStart.setDate(wStart.getDate() - 6);
      const r = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN i.disposition='Closed Won' THEN 1 ELSE 0 END) as won ${base} AND date(i.created_at) BETWEEN ? AND ?`).get(uid, wStart.toISOString().split('T')[0], wEnd.toISOString().split('T')[0]);
      weeklyTrend.push({ total: r.total || 0, won: r.won || 0 });
    }

    // Active pipeline (open dispositions)
    const pipeline = db.prepare(`SELECT i.disposition, COUNT(*) as count ${base} AND i.disposition NOT IN ('Closed Won','Closed Lost','Fake Lead','Processed','Cancelled') GROUP BY i.disposition ORDER BY count DESC`).all(uid);

    // Follow-ups
    const fuBase = `FROM followups f JOIN inquiries i ON f.inquiry_id = i.id JOIN customers c ON i.customer_id = c.id WHERE i.assigned_to = ? AND f.completed = 0`;
    const overdue   = db.prepare(`SELECT f.id, f.note, f.follow_up_date, f.inquiry_id, c.name as customer_name ${fuBase} AND f.follow_up_date < ? ORDER BY f.follow_up_date ASC LIMIT 10`).all(uid, today);
    const todayFu   = db.prepare(`SELECT f.id, f.note, f.follow_up_date, f.inquiry_id, c.name as customer_name ${fuBase} AND f.follow_up_date = ? ORDER BY f.follow_up_date ASC LIMIT 10`).all(uid, today);
    const upcoming  = db.prepare(`SELECT f.id, f.note, f.follow_up_date, f.inquiry_id, c.name as customer_name ${fuBase} AND f.follow_up_date > ? ORDER BY f.follow_up_date ASC LIMIT 10`).all(uid, today);

    // Untouched — no activity comment in 7+ days
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const untouched = db.prepare(`SELECT i.id, i.type, i.disposition, c.name as customer_name, i.created_at,
      (SELECT MAX(a.created_at) FROM activity_log a WHERE a.entity_id = i.id AND a.entity_type = 'inquiry') as last_activity
      FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id
      WHERE i.assigned_to = ? AND i.disposition NOT IN ('Closed Won','Closed Lost','Fake Lead','Processed','Cancelled')
      AND (last_activity IS NULL OR last_activity < ?) ORDER BY last_activity ASC LIMIT 8`).all(uid, sevenDaysAgo.toISOString());

    res.json({ today: { leads: todayLeads, repeat: todayRepeat, orders: todayOrders }, month, year, all, weeklyTrend, pipeline, followups: { overdue, today: todayFu, upcoming }, untouched });
  } catch (err) {
    console.error('AE analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Always-current summary for dashboard bento grid
router.get('/summary', (req, res) => {
  const db = getDB();
  const isAE = req.user.role === 'ae';
  const uid = req.user.id;
  try {
    const overdueQ = isAE
      ? `SELECT COUNT(*) as c FROM followups f JOIN inquiries i ON f.inquiry_id = i.id WHERE f.completed=0 AND f.follow_up_date < date('now') AND i.assigned_to=?`
      : `SELECT COUNT(*) as c FROM followups f WHERE f.completed=0 AND f.follow_up_date < date('now')`;
    const overdueCount = db.prepare(overdueQ).get(...(isAE ? [uid] : [])).c;

    const untouchedQ = `SELECT COUNT(*) as c FROM inquiries i
      WHERE i.disposition NOT IN ('Closed Won','Closed Lost','Fake Lead','Processed','Cancelled')
      ${isAE ? 'AND i.assigned_to=?' : ''}
      AND NOT EXISTS (
        SELECT 1 FROM activity_log a WHERE a.entity_id=i.id AND a.entity_type='inquiry'
        AND a.created_at >= datetime('now','-7 days')
      )`;
    const untouchedCount = db.prepare(untouchedQ).get(...(isAE ? [uid] : [])).c;

    const newCustomersToday = isAE ? null : db.prepare(`SELECT COUNT(*) as c FROM customers WHERE date(created_at)=date('now')`).get().c;
    const totalCustomers    = isAE ? null : db.prepare(`SELECT COUNT(*) as c FROM customers`).get().c;

    const fb = isAE ? `FROM inquiries i WHERE i.type='lead' AND i.assigned_to=?` : `FROM inquiries i WHERE i.type='lead'`;
    const fp = isAE ? [uid] : [];
    const funnelTotal   = db.prepare(`SELECT COUNT(*) as c ${fb}`).get(...fp).c;
    const funnelQuoted  = db.prepare(`SELECT COUNT(*) as c ${fb} AND i.disposition='Quoted'`).get(...fp).c;
    const funnelBidding = db.prepare(`SELECT COUNT(*) as c ${fb} AND i.disposition='Bidding'`).get(...fp).c;
    const funnelWon     = db.prepare(`SELECT COUNT(*) as c ${fb} AND i.disposition='Closed Won'`).get(...fp).c;
    const funnelLost    = db.prepare(`SELECT COUNT(*) as c ${fb} AND i.disposition='Closed Lost'`).get(...fp).c;

    let topAE = null;
    if (!isAE) {
      const ms = new Date(); ms.setDate(1);
      const monthStart = ms.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const ae = db.prepare(`
        SELECT u.name, COUNT(*) as total, SUM(CASE WHEN i.disposition='Closed Won' THEN 1 ELSE 0 END) as won
        FROM inquiries i JOIN users u ON i.assigned_to=u.id
        WHERE u.role='ae' AND date(i.created_at) BETWEEN ? AND ?
        GROUP BY i.assigned_to, u.name HAVING total>0
        ORDER BY CAST(won AS REAL)/total DESC LIMIT 1`).get(monthStart, today);
      if (ae) topAE = { name: ae.name, winRate: ae.total>0 ? Math.round(ae.won/ae.total*100) : 0, won: ae.won, total: ae.total };
    }

    res.json({ overdueCount, untouchedCount, newCustomersToday, totalCustomers, conversionFunnel: { total: funnelTotal, quoted: funnelQuoted, bidding: funnelBidding, won: funnelWon, lost: funnelLost }, topAE });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;