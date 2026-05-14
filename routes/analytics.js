const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Parse comma-separated filter values into SQL IN clause
function buildInFilter(column, value) {
  if (!value) return null;
  const values = value.split(',').map(v => v.trim()).filter(Boolean);
  if (!values.length) return null;
  return { sql: `${column} IN (${values.map(() => '?').join(',')})`, params: values };
}

router.get('/', (req, res) => {
  const db = getDB();
  const { from, to, lead_source, disposition, assigned_to, type } = req.query;
  const userId = req.user.role === 'ae' ? req.user.id : (assigned_to && !assigned_to.includes(',') ? assigned_to : null);

  const filters = [];
  const params = [];

  if (userId) { filters.push('i.assigned_to = ?'); params.push(userId); }

  // Multi-value assigned_to for managers
  if (req.user.role === 'manager' && assigned_to && assigned_to.includes(',')) {
    const f = buildInFilter('i.assigned_to', assigned_to);
    if (f) { filters.push(f.sql); params.push(...f.params); }
  }

  if (from) { filters.push("date(i.created_at) >= ?"); params.push(from); }
  if (to) { filters.push("date(i.created_at) <= ?"); params.push(to); }

  // Multi-value disposition filter
  if (disposition) {
    const f = buildInFilter('i.disposition', disposition);
    if (f) { filters.push(f.sql); params.push(...f.params); }
  }

  // Multi-value lead source filter
  if (lead_source) {
    const f = buildInFilter('c.lead_source', lead_source);
    if (f) { filters.push(f.sql); params.push(...f.params); }
  }

  // Multi-value type filter
  if (type) {
    const f = buildInFilter('i.type', type);
    if (f) { filters.push(f.sql); params.push(...f.params); }
  }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const base = `FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id ${where}`;

  try {
    // Totals by type
    const totals = db.prepare(`SELECT i.type, COUNT(*) as count ${base} GROUP BY i.type`).all(...params);

    // By disposition
    const byDisposition = db.prepare(`SELECT i.disposition, COUNT(*) as count ${base} GROUP BY i.disposition ORDER BY count DESC`).all(...params);

    // By lead source
    const bySource = db.prepare(`SELECT c.lead_source as source, COUNT(*) as count ${base} GROUP BY c.lead_source ORDER BY count DESC`).all(...params);

    // By assigned person
    const byPerson = db.prepare(`SELECT u.name as name, COUNT(*) as count ${base} GROUP BY i.assigned_to ORDER BY count DESC`).all(...params);

    // Trend (last 30 days or filtered range)
    const trendFilters = [...filters];
    const trendParams = [...params];
    if (!from && !to) {
      trendFilters.push("date(i.created_at) >= date('now', '-30 days')");
    }
    const trendWhere = trendFilters.length ? 'WHERE ' + trendFilters.join(' AND ') : '';
    const trend = db.prepare(`
      SELECT date(i.created_at) as date, i.type, COUNT(*) as count
      FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id
      ${trendWhere} GROUP BY date(i.created_at), i.type ORDER BY date ASC
    `).all(...trendParams);

    // Total count and closed won (fix: no extra params)
    const totalCount = db.prepare(`SELECT COUNT(*) as c ${base}`).get(...params).c;

    // Won count - add disposition filter separately
    const wonFilters = [...filters, "i.disposition = 'Closed Won'"];
    const wonWhere = 'WHERE ' + wonFilters.join(' AND ');
    const wonCount = db.prepare(`SELECT COUNT(*) as c FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id ${wonWhere}`).get(...params).c;

    // Upcoming follow-ups
    const fuFilters = [];
    const fuParams = [];
    if (req.user.role === 'ae') { fuFilters.push('i.assigned_to = ?'); fuParams.push(req.user.id); }
    else if (userId) { fuFilters.push('i.assigned_to = ?'); fuParams.push(userId); }
    fuFilters.push("f.completed = 0", "f.follow_up_date >= date('now')");
    const upcomingFollowups = db.prepare(`
      SELECT f.*, i.type, i.id as inquiry_id, c.name as customer_name, u.name as assigned_name
      FROM followups f JOIN inquiries i ON f.inquiry_id = i.id
      JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id
      WHERE ${fuFilters.join(' AND ')} ORDER BY f.follow_up_date ASC LIMIT 10
    `).all(...fuParams);

    res.json({ totals, byDisposition, bySource, byPerson, trend, totalCount, wonCount, upcomingFollowups });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
