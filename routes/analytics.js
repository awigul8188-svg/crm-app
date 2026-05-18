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
    const byPerson = db.prepare(`SELECT u.name as name, COUNT(*) as count ${base} GROUP BY i.assigned_to ORDER BY count DESC`).all(...params);

    const trendFilters = [...filters]; const trendParams = [...params];
    if (!from && !to) trendFilters.push("date(i.created_at) >= date('now', '-30 days')");
    const trendWhere = trendFilters.length ? 'WHERE ' + trendFilters.join(' AND ') : '';
    const trend = db.prepare(`SELECT date(i.created_at) as date, i.type, COUNT(*) as count FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id ${trendWhere} GROUP BY date(i.created_at), i.type ORDER BY date ASC`).all(...trendParams);

    const totalCount = db.prepare(`SELECT COUNT(*) as c ${base}`).get(...params).c;
    const wonWhere = 'WHERE ' + [...filters, "i.disposition = 'Closed Won'"].join(' AND ');
    const wonCount = db.prepare(`SELECT COUNT(*) as c FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id ${wonWhere || "WHERE i.disposition = 'Closed Won'"}`).get(...params).c;

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
      const byPerson = db.prepare(`SELECT u.name, COUNT(*) as count, SUM(CASE WHEN i.disposition='Processed' THEN 1 ELSE 0 END) as processed ${base} ${where} GROUP BY i.assigned_to ORDER BY count DESC`).all(...params);

      // Trend
      const trend = db.prepare(`SELECT date(i.created_at) as date, COUNT(*) as total, SUM(CASE WHEN i.disposition='Processed' THEN 1 ELSE 0 END) as processed, SUM(CASE WHEN i.disposition='Cancelled' THEN 1 ELSE 0 END) as cancelled ${base} ${where} GROUP BY date(i.created_at) ORDER BY date ASC`).all(...params);

      res.json({ type, today: { total: todayTotal, verified: todayVerified, not_verified: todayNotVerified, value: todayValue, processed: todayProcessed, cancelled: todayCancelled }, period: { total: periodTotal, processed: periodProcessed, cancelled: periodCancelled, verified: periodVerified, not_verified: periodNotVerified, value: periodValue }, bySource, byPerson, trend });

    } else if (type === 'repeat') {
      const periodTotal = db.prepare(`SELECT COUNT(*) as c ${base} ${where}`).get(...params).c;
      const ppc = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.ppc_or_outbound = 'PPC'`).get(...params).c;
      const outbound = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.ppc_or_outbound = 'Outbound Repeat'`).get(...params).c;
      const todayTotal = db.prepare(`SELECT COUNT(*) as c ${base} ${todayWhere}`).get(...todayParams).c;
      const byDisposition = db.prepare(`SELECT i.disposition, COUNT(*) as count ${base} ${where} GROUP BY i.disposition ORDER BY count DESC`).all(...params);
      const byPerson = db.prepare(`SELECT u.name, COUNT(*) as count ${base} ${where} GROUP BY i.assigned_to ORDER BY count DESC`).all(...params);
      const trend = db.prepare(`SELECT date(i.created_at) as date, COUNT(*) as total ${base} ${where} GROUP BY date(i.created_at) ORDER BY date ASC`).all(...params);
      const closedWon = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Closed Won'`).get(...params).c;

      // Top customers by period
      const topCustomersBase = `FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id WHERE i.type = 'repeat'`;
      const topCustomersDay   = db.prepare(`SELECT c.name, c.company, COUNT(*) as count ${topCustomersBase} AND date(i.created_at) = ? GROUP BY i.customer_id ORDER BY count DESC LIMIT 10`).all(today);
      const topCustomersMonth = db.prepare(`SELECT c.name, c.company, COUNT(*) as count ${topCustomersBase} AND strftime('%Y-%m', i.created_at) = strftime('%Y-%m', 'now') GROUP BY i.customer_id ORDER BY count DESC LIMIT 10`).all();
      const topCustomersYear  = db.prepare(`SELECT c.name, c.company, COUNT(*) as count ${topCustomersBase} AND strftime('%Y', i.created_at) = strftime('%Y', 'now') GROUP BY i.customer_id ORDER BY count DESC LIMIT 10`).all();

      // Top reps by period
      const topRepsDay   = db.prepare(`SELECT u.name, COUNT(*) as count ${topCustomersBase} AND date(i.created_at) = ? GROUP BY i.assigned_to ORDER BY count DESC LIMIT 10`).all(today);
      const topRepsMonth = db.prepare(`SELECT u.name, COUNT(*) as count ${topCustomersBase} AND strftime('%Y-%m', i.created_at) = strftime('%Y-%m', 'now') GROUP BY i.assigned_to ORDER BY count DESC LIMIT 10`).all();
      const topRepsYear  = db.prepare(`SELECT u.name, COUNT(*) as count ${topCustomersBase} AND strftime('%Y', i.created_at) = strftime('%Y', 'now') GROUP BY i.assigned_to ORDER BY count DESC LIMIT 10`).all();

      // Top companies
      const topCompBase = `FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.type = 'repeat' AND c.company IS NOT NULL AND c.company != ''`;
      const topCompDay   = db.prepare(`SELECT c.company as name, COUNT(*) as count ${topCompBase} AND date(i.created_at) = ? GROUP BY c.company ORDER BY count DESC LIMIT 10`).all(today);
      const topCompMonth = db.prepare(`SELECT c.company as name, COUNT(*) as count ${topCompBase} AND strftime('%Y-%m', i.created_at) = strftime('%Y-%m', 'now') GROUP BY c.company ORDER BY count DESC LIMIT 10`).all();
      const topCompYear  = db.prepare(`SELECT c.company as name, COUNT(*) as count ${topCompBase} AND strftime('%Y', i.created_at) = strftime('%Y', 'now') GROUP BY c.company ORDER BY count DESC LIMIT 10`).all();

      res.json({ type, today: { total: todayTotal }, period: { total: periodTotal, ppc, outbound, closed_won: closedWon, win_rate: periodTotal > 0 ? Math.round(closedWon / periodTotal * 100) : 0 }, byDisposition, byPerson, trend, topCustomers: { day: topCustomersDay, month: topCustomersMonth, year: topCustomersYear }, topReps: { day: topRepsDay, month: topRepsMonth, year: topRepsYear }, topCompanies: { day: topCompDay, month: topCompMonth, year: topCompYear } });

    } else if (type === 'lead') {
      const periodTotal  = db.prepare(`SELECT COUNT(*) as c ${base} ${where}`).get(...params).c;
      const todayTotal   = db.prepare(`SELECT COUNT(*) as c ${base} ${todayWhere}`).get(...todayParams).c;
      const closedWon    = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Closed Won'`).get(...params).c;
      const closedLost   = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Closed Lost'`).get(...params).c;
      const inProgress   = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition NOT IN ('Closed Won','Closed Lost','Fake Lead','No response','Cold','Cold Lead')`).get(...params).c;
      const fakeLead     = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Fake Lead'`).get(...params).c;
      const noResponse   = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'No response'`).get(...params).c;
      const quoted       = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Quoted'`).get(...params).c;
      const bidding      = db.prepare(`SELECT COUNT(*) as c ${base} ${where} AND i.disposition = 'Bidding'`).get(...params).c;

      const byDisposition = db.prepare(`SELECT i.disposition, COUNT(*) as count ${base} ${where} GROUP BY i.disposition ORDER BY count DESC`).all(...params);
      const bySource      = db.prepare(`SELECT c.lead_source as source, COUNT(*) as count ${base} ${where} GROUP BY c.lead_source ORDER BY count DESC`).all(...params);
      const trend         = db.prepare(`SELECT date(i.created_at) as date, COUNT(*) as total, SUM(CASE WHEN i.disposition='Closed Won' THEN 1 ELSE 0 END) as won ${base} ${where} GROUP BY date(i.created_at) ORDER BY date ASC`).all(...params);

      // Full AE performance breakdown for leads
      const aeBase = `FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id WHERE i.type = 'lead'`;
      const aePerformance = db.prepare(`
        SELECT 
          u.id,
          u.name,
          u.avatar_url,
          COUNT(*) as total,
          SUM(CASE WHEN i.disposition='Closed Won' THEN 1 ELSE 0 END) as won,
          SUM(CASE WHEN i.disposition='Closed Lost' THEN 1 ELSE 0 END) as lost,
          SUM(CASE WHEN i.disposition='Quoted' THEN 1 ELSE 0 END) as quoted,
          SUM(CASE WHEN i.disposition='Bidding' THEN 1 ELSE 0 END) as bidding,
          SUM(CASE WHEN i.disposition='Fake Lead' THEN 1 ELSE 0 END) as fake,
          SUM(CASE WHEN i.disposition='No response' THEN 1 ELSE 0 END) as no_response,
          SUM(CASE WHEN i.disposition='Cold' OR i.disposition='Cold Lead' THEN 1 ELSE 0 END) as cold,
          SUM(CASE WHEN date(i.created_at) = ? THEN 1 ELSE 0 END) as today,
          SUM(CASE WHEN strftime('%Y-%m', i.created_at) = strftime('%Y-%m','now') THEN 1 ELSE 0 END) as this_month
        FROM inquiries i 
        LEFT JOIN users u ON i.assigned_to = u.id 
        WHERE i.type = 'lead'
        GROUP BY i.assigned_to 
        ORDER BY total DESC
      `).all(today);

      // Top sources per AE
      const aeSourceBreakdown = db.prepare(`
        SELECT u.name as ae_name, c.lead_source as source, COUNT(*) as count
        FROM inquiries i
        LEFT JOIN customers c ON i.customer_id = c.id
        LEFT JOIN users u ON i.assigned_to = u.id
        WHERE i.type = 'lead' AND c.lead_source IS NOT NULL
        GROUP BY i.assigned_to, c.lead_source
        ORDER BY ae_name, count DESC
      `).all();

      // Today per AE
      const todayPerAE = db.prepare(`SELECT u.name, COUNT(*) as count ${aeBase} AND date(i.created_at) = ? GROUP BY i.assigned_to ORDER BY count DESC`).all(today);
      const thisMonthPerAE = db.prepare(`SELECT u.name, COUNT(*) as count ${aeBase} AND strftime('%Y-%m',i.created_at)=strftime('%Y-%m','now') GROUP BY i.assigned_to ORDER BY count DESC`).all();

      res.json({ 
        type, 
        today: { total: todayTotal, perAE: todayPerAE }, 
        period: { total: periodTotal, closed_won: closedWon, closed_lost: closedLost, in_progress: inProgress, fake: fakeLead, no_response: noResponse, quoted, bidding, win_rate: periodTotal > 0 ? Math.round(closedWon / periodTotal * 100) : 0 }, 
        byDisposition, bySource, trend,
        aePerformance, aeSourceBreakdown, thisMonthPerAE
      });
    }
  } catch (err) {
    console.error('Module analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
