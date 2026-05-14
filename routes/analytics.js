const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDB();
  const { from, to, lead_source, disposition, assigned_to, type } = req.query;
  const userId = req.user.role === 'ae' ? req.user.id : (assigned_to || null);

  const filters = [];
  const params = [];

  if (userId) { filters.push('i.assigned_to = ?'); params.push(userId); }
  if (from) { filters.push("date(i.created_at) >= ?"); params.push(from); }
  if (to) { filters.push("date(i.created_at) <= ?"); params.push(to); }
  if (lead_source) { filters.push('c.lead_source = ?'); params.push(lead_source); }
  if (disposition) { filters.push('i.disposition = ?'); params.push(disposition); }
  if (type) { filters.push('i.type = ?'); params.push(type); }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : '';

  const base = `FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id ${where}`;

  // Totals by type
  const totals = db.prepare(`SELECT i.type, COUNT(*) as count ${base} GROUP BY i.type`).all(...params);

  // By disposition
  const byDisposition = db.prepare(`SELECT i.disposition, COUNT(*) as count ${base} GROUP BY i.disposition ORDER BY count DESC`).all(...params);

  // By lead source
  const bySource = db.prepare(`SELECT c.lead_source as source, COUNT(*) as count ${base} GROUP BY c.lead_source ORDER BY count DESC`).all(...params);

  // By assigned person
  const byPerson = db.prepare(`SELECT u.name as name, COUNT(*) as count ${base} GROUP BY i.assigned_to ORDER BY count DESC`).all(...params);

  // By date (last 30 days trend)
  const trendFilters = [...filters];
  const trendParams = [...params];
  if (!from && !to) {
    trendFilters.push("date(i.created_at) >= date('now', '-30 days')");
  }
  const trendWhere = trendFilters.length ? 'WHERE ' + trendFilters.join(' AND ') : '';
  const trend = db.prepare(`
    SELECT date(i.created_at) as date, i.type, COUNT(*) as count
    FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id
    ${trendWhere}
    GROUP BY date(i.created_at), i.type
    ORDER BY date ASC
  `).all(...trendParams);

  // Closed Won rate
  const wonFilters = [...filters, "i.disposition = 'Closed Won'"];
  const totalCount = db.prepare(`SELECT COUNT(*) as c ${base}`).get(...params).c;
  const wonCount = db.prepare(`SELECT COUNT(*) as c FROM inquiries i LEFT JOIN customers c ON i.customer_id = c.id LEFT JOIN users u ON i.assigned_to = u.id WHERE ${wonFilters.join(' AND ')}`).get(...params, 'Closed Won').c;

  // Upcoming follow-ups
  const fuParams = userId ? [userId] : [];
  const fuWhere = userId ? 'AND i.assigned_to = ?' : '';
  const upcomingFollowups = db.prepare(`
    SELECT f.*, i.type, c.name as customer_name, u.name as assigned_name
    FROM followups f
    JOIN inquiries i ON f.inquiry_id = i.id
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN users u ON i.assigned_to = u.id
    WHERE f.completed = 0 AND f.follow_up_date >= date('now') ${fuWhere}
    ORDER BY f.follow_up_date ASC LIMIT 10
  `).all(...fuParams);

  res.json({ totals, byDisposition, bySource, byPerson, trend, totalCount, wonCount, upcomingFollowups });
});

module.exports = router;
