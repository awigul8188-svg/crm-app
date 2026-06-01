const express = require('express');
const { getDB } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

const canManage = (req, res, next) => ['manager','purchasing_manager'].includes(req.user.role) ? next() : res.status(403).json({ error: 'Managers only' });
const isManager = (r) => ['manager','purchasing_manager'].includes(r.role);

// ── helpers ──────────────────────────────────────────────────
function currentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const qStart = new Date(year, (quarter - 1) * 3, 1).toISOString().split('T')[0];
  const qEnd   = new Date(year, quarter * 3, 0).toISOString().split('T')[0];
  return { year, quarter, qStart, qEnd };
}

function getRevenue(db, aeId, fromDate, toDate) {
  let where = `(i.disposition = 'Closed Won' OR i.disposition = 'Processed')`;
  const params = [];
  if (aeId)     { where += ' AND i.assigned_to=?';               params.push(aeId); }
  if (fromDate) { where += ' AND date(i.created_at)>=?';          params.push(fromDate); }
  if (toDate)   { where += ' AND date(i.created_at)<=?';          params.push(toDate); }
  const rows = db.prepare(`
    SELECT i.type, i.order_amount,
      (SELECT COALESCE(SUM(CAST(REPLACE(REPLACE(pq.price,'$',''),',','') AS REAL)),0)
       FROM purchase_quotes pq
       JOIN purchase_assignments pa ON pq.assignment_id=pa.id
       JOIN requirements r ON pa.requirement_id=r.id
       WHERE r.inquiry_id=i.id) as quote_value
    FROM inquiries i WHERE ${where}
  `).all(...params);
  return rows.reduce((sum, r) => {
    if (r.type === 'online_order' && r.order_amount) return sum + (parseFloat(String(r.order_amount).replace(/[$,]/g,'')) || 0);
    return sum + (r.quote_value || 0);
  }, 0);
}

// ── GET /api/analytics/targets ───────────────────────────────
router.get('/targets', canManage, (req, res) => {
  const db = getDB();
  const { year, quarter } = req.query;
  let where = '1=1'; const p = [];
  if (year)    { where += ' AND t.year=?';    p.push(parseInt(year)); }
  if (quarter) { where += ' AND t.quarter=?'; p.push(parseInt(quarter)); }
  const targets = db.prepare(`
    SELECT t.*, u.name as ae_name FROM ae_targets t
    JOIN users u ON t.ae_id=u.id WHERE ${where} ORDER BY u.name
  `).all(...p);
  res.json(targets);
});

// ── POST /api/analytics/targets ──────────────────────────────
router.post('/targets', canManage, (req, res) => {
  const { ae_id, year, quarter, revenue_target, leads_target, repeat_target, orders_target, notes } = req.body;
  if (!ae_id || !year || !quarter) return res.status(400).json({ error: 'ae_id, year, quarter required' });
  const db = getDB();
  db.prepare(`
    INSERT INTO ae_targets (ae_id, set_by, year, quarter, revenue_target, leads_target, repeat_target, orders_target, notes)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(ae_id,year,quarter) DO UPDATE SET
      set_by=excluded.set_by, revenue_target=excluded.revenue_target,
      leads_target=excluded.leads_target, repeat_target=excluded.repeat_target,
      orders_target=excluded.orders_target, notes=excluded.notes, updated_at=CURRENT_TIMESTAMP
  `).run(ae_id, req.user.id, year, quarter, revenue_target||0, leads_target||0, repeat_target||0, orders_target||0, notes||null);
  res.json({ success: true });
});

// ── GET /api/analytics/manager-full ─────────────────────────
router.get('/manager-full', canManage, (req, res) => {
  const db = getDB();
  const { year, quarter, qStart, qEnd } = currentQuarter();
  const today = new Date().toISOString().split('T')[0];

  // KPIs
  const totalWon    = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE disposition IN ('Closed Won','Processed')").get().c;
  const totalCount  = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE disposition NOT IN ('Fake Lead') AND disposition IS NOT NULL").get().c;
  const teamWinRate = totalCount > 0 ? Math.round(totalWon / totalCount * 100) : 0;
  const totalRevenue  = getRevenue(db, null, null, null);
  const quarterRevenue = getRevenue(db, null, qStart, qEnd);
  const activePipeline = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE disposition NOT IN ('Closed Won','Closed Lost','Processed','Cancelled','Fake Lead') AND disposition IS NOT NULL").get().c;
  const todayLeads  = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='lead' AND date(created_at)=?").get(today).c;
  const todayOrders = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='online_order' AND date(created_at)=?").get(today).c;
  const todayRepeat = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='repeat' AND date(created_at)=?").get(today).c;

  // AE list
  const aes = db.prepare("SELECT id,name FROM users WHERE role='ae' ORDER BY name").all();

  // Per-AE performance
  const aePerformance = aes.map(ae => {
    const leads   = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN disposition='Closed Won' THEN 1 ELSE 0 END) as won FROM inquiries WHERE type='lead' AND assigned_to=?").get(ae.id);
    const repeats = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN disposition='Closed Won' THEN 1 ELSE 0 END) as won FROM inquiries WHERE type='repeat' AND assigned_to=?").get(ae.id);
    const orders  = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN disposition='Processed' THEN 1 ELSE 0 END) as processed FROM inquiries WHERE type='online_order' AND assigned_to=?").get(ae.id);
    const total   = (leads.total||0)+(repeats.total||0)+(orders.total||0);
    const won     = (leads.won||0)+(repeats.won||0)+(orders.processed||0);
    const winRate = total > 0 ? Math.round(won/total*100) : 0;
    const revenue  = getRevenue(db, ae.id, null, null);
    const qRev     = getRevenue(db, ae.id, qStart, qEnd);
    const qLeads   = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='lead' AND assigned_to=? AND disposition='Closed Won' AND date(created_at) BETWEEN ? AND ?").get(ae.id, qStart, qEnd).c;
    const qRepeats = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='repeat' AND assigned_to=? AND disposition='Closed Won' AND date(created_at) BETWEEN ? AND ?").get(ae.id, qStart, qEnd).c;
    const qOrders  = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='online_order' AND assigned_to=? AND disposition='Processed' AND date(created_at) BETWEEN ? AND ?").get(ae.id, qStart, qEnd).c;
    const target   = db.prepare("SELECT * FROM ae_targets WHERE ae_id=? AND year=? AND quarter=?").get(ae.id, year, quarter) || null;
    const todayA   = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE assigned_to=? AND date(created_at)=?").get(ae.id, today).c;
    // 10-week trend
    const trend = Array.from({length:10}, (_,i) => {
      const d  = new Date(); d.setDate(d.getDate()-(9-i)*7);
      const d2 = new Date(d); d2.setDate(d2.getDate()+6);
      const ws = d.toISOString().split('T')[0]; const we = d2.toISOString().split('T')[0];
      const t  = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN disposition IN ('Closed Won','Processed') THEN 1 ELSE 0 END) as won FROM inquiries WHERE assigned_to=? AND date(created_at) BETWEEN ? AND ?").get(ae.id, ws, we);
      return { total: t.total||0, won: t.won||0 };
    });
    return {
      id: ae.id, name: ae.name, todayCount: todayA,
      leads:   { total:leads.total||0,   won:leads.won||0,         winRate:(leads.total||0)>0?Math.round((leads.won||0)/(leads.total)*100):0 },
      repeats: { total:repeats.total||0, won:repeats.won||0,       winRate:(repeats.total||0)>0?Math.round((repeats.won||0)/(repeats.total)*100):0 },
      orders:  { total:orders.total||0,  processed:orders.processed||0, rate:(orders.total||0)>0?Math.round((orders.processed||0)/(orders.total)*100):0 },
      total, won, winRate, revenue, quarterRevenue: qRev,
      quarter: { leads:qLeads, repeats:qRepeats, orders:qOrders, revenue:qRev },
      target, trend,
    };
  });

  // Revenue by month (last 12)
  const revenueByMonth = Array.from({length:12}, (_,i) => {
    const d  = new Date(); d.setDate(1); d.setMonth(d.getMonth()-(11-i));
    const d2 = new Date(d.getFullYear(), d.getMonth()+1, 0);
    const ms = d.toISOString().split('T')[0]; const me = d2.toISOString().split('T')[0];
    const rev   = getRevenue(db, null, ms, me);
    const count = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE disposition IN ('Closed Won','Processed') AND date(created_at) BETWEEN ? AND ?").get(ms, me).c;
    return { month: d.toLocaleString('default',{month:'short'})+' '+String(d.getFullYear()).slice(2), revenue:Math.round(rev), count };
  });

  // Pipeline by disposition (top 10)
  const pipeline = db.prepare(`
    SELECT disposition, COUNT(*) as count FROM inquiries
    WHERE disposition IS NOT NULL AND disposition != '' AND disposition NOT IN ('Closed Won','Closed Lost','Processed','Cancelled','Fake Lead')
    GROUP BY disposition ORDER BY count DESC LIMIT 10
  `).all();

  // By type summary
  const byType = ['lead','repeat','online_order'].map(type => {
    const r = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN disposition IN ('Closed Won','Processed') THEN 1 ELSE 0 END) as won FROM inquiries WHERE type=?").get(type);
    return { type, total:r.total||0, won:r.won||0, winRate:(r.total||0)>0?Math.round((r.won||0)/(r.total)*100):0 };
  });

  // Today's + overdue AE follow-ups
  const followupsToday = aes.map(ae => {
    const overdue = db.prepare(`
      SELECT f.id, f.note, f.follow_up_date, f.inquiry_id,
        c.name as customer_name, i.type as inquiry_type, i.disposition
      FROM inquiry_followups f
      JOIN inquiries i ON f.inquiry_id=i.id
      JOIN customers c ON i.customer_id=c.id
      WHERE f.user_id=? AND f.completed=0 AND date(f.follow_up_date) < date('now')
      ORDER BY f.follow_up_date ASC LIMIT 8
    `).all(ae.id);
    const todayFU = db.prepare(`
      SELECT f.id, f.note, f.follow_up_date, f.inquiry_id,
        c.name as customer_name, i.type as inquiry_type, i.disposition
      FROM inquiry_followups f
      JOIN inquiries i ON f.inquiry_id=i.id
      JOIN customers c ON i.customer_id=c.id
      WHERE f.user_id=? AND f.completed=0 AND date(f.follow_up_date) = date('now')
      ORDER BY f.follow_up_date ASC LIMIT 8
    `).all(ae.id);
    return { ae_id: ae.id, ae_name: ae.name, overdue, today: todayFU };
  }).filter(ae => ae.overdue.length > 0 || ae.today.length > 0);

  res.json({
    kpis: { totalRevenue, quarterRevenue, totalWon, teamWinRate, activePipeline, todayLeads, todayOrders, todayRepeat },
    aePerformance, revenueByMonth, pipeline, byType, followupsToday,
    meta: { year, quarter, qStart, qEnd },
  });
});

// ── GET /api/analytics/ae ─────────────────────────────────────
router.get('/ae', (req, res) => {
  const db = getDB();
  const userId = req.user.id;
  const today  = new Date().toISOString().split('T')[0];
  const { year, quarter, qStart, qEnd } = currentQuarter();

  const count = (type, disp) => {
    const col = type === 'online_order' ? `disposition='Processed'` : `disposition='${disp}'`;
    return db.prepare(`SELECT COUNT(*) as c FROM inquiries WHERE type=? AND assigned_to=? AND ${col}`).get(type, userId).c;
  };
  const countFull = (type) => db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type=? AND assigned_to=?").get(type, userId).c;

  const today_data = {
    leads:  db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='lead' AND assigned_to=? AND date(created_at)=?").get(userId, today).c,
    repeat: db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='repeat' AND assigned_to=? AND date(created_at)=?").get(userId, today).c,
    orders: db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='online_order' AND assigned_to=? AND date(created_at)=?").get(userId, today).c,
  };

  const buildStats = (from, to) => {
    let w = 'assigned_to=?'; const p = [userId];
    if (from) { w += ' AND date(created_at)>=?'; p.push(from); }
    if (to)   { w += ' AND date(created_at)<=?'; p.push(to); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM inquiries WHERE ${w}`).get(...p).c;
    const won   = db.prepare(`SELECT COUNT(*) as c FROM inquiries WHERE ${w} AND disposition IN ('Closed Won','Processed')`).get(...p).c;
    return { total, won, win_rate: total > 0 ? Math.round(won/total*100) : 0 };
  };
  const month   = buildStats(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], today);
  const yearS   = buildStats(`${new Date().getFullYear()}-01-01`, today);
  const all     = buildStats(null, null);
  const quarter_stats = buildStats(qStart, qEnd);

  // Quarterly target
  const target = db.prepare("SELECT * FROM ae_targets WHERE ae_id=? AND year=? AND quarter=?").get(userId, year, quarter) || null;

  // Quarter achievement
  const qLeads   = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='lead' AND assigned_to=? AND disposition='Closed Won' AND date(created_at) BETWEEN ? AND ?").get(userId, qStart, qEnd).c;
  const qRepeats = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='repeat' AND assigned_to=? AND disposition='Closed Won' AND date(created_at) BETWEEN ? AND ?").get(userId, qStart, qEnd).c;
  const qOrders  = db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE type='online_order' AND assigned_to=? AND disposition='Processed' AND date(created_at) BETWEEN ? AND ?").get(userId, qStart, qEnd).c;
  const qRevenue = getRevenue(db, userId, qStart, qEnd);
  const totalRevenue = getRevenue(db, userId, null, null);

  const pipeline = db.prepare(`
    SELECT disposition, COUNT(*) as count FROM inquiries WHERE assigned_to=?
    AND disposition NOT IN ('Closed Won','Closed Lost','Processed','Cancelled','Fake Lead')
    AND disposition IS NOT NULL GROUP BY disposition ORDER BY count DESC
  `).all(userId);

  // Follow-ups
  const followups = {
    overdue:  db.prepare("SELECT f.*,c.name as customer_name,i.type as inquiry_type FROM inquiry_followups f JOIN inquiries i ON f.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id WHERE f.user_id=? AND f.completed=0 AND date(f.follow_up_date) < date('now') ORDER BY f.follow_up_date ASC LIMIT 20").all(userId),
    today:    db.prepare("SELECT f.*,c.name as customer_name,i.type as inquiry_type FROM inquiry_followups f JOIN inquiries i ON f.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id WHERE f.user_id=? AND f.completed=0 AND date(f.follow_up_date) = date('now')").all(userId),
    upcoming: db.prepare("SELECT f.*,c.name as customer_name,i.type as inquiry_type FROM inquiry_followups f JOIN inquiries i ON f.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id WHERE f.user_id=? AND f.completed=0 AND date(f.follow_up_date) > date('now') ORDER BY f.follow_up_date ASC LIMIT 10").all(userId),
  };

  // Weekly trend (last 12 weeks)
  const weeklyTrend = Array.from({length:12}, (_,i) => {
    const d  = new Date(); d.setDate(d.getDate()-(11-i)*7);
    const d2 = new Date(d); d2.setDate(d2.getDate()+6);
    const ws = d.toISOString().split('T')[0]; const we = d2.toISOString().split('T')[0];
    const t  = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN disposition IN ('Closed Won','Processed') THEN 1 ELSE 0 END) as won FROM inquiries WHERE assigned_to=? AND date(created_at) BETWEEN ? AND ?").get(userId, ws, we);
    return { total:t.total||0, won:t.won||0 };
  });

  // Monthly breakdown (last 6)
  const monthlyBreakdown = Array.from({length:6}, (_,i) => {
    const d  = new Date(); d.setDate(1); d.setMonth(d.getMonth()-(5-i));
    const d2 = new Date(d.getFullYear(), d.getMonth()+1, 0);
    const ms = d.toISOString().split('T')[0]; const me = d2.toISOString().split('T')[0];
    const leads   = db.prepare("SELECT COUNT(*) as t, SUM(CASE WHEN disposition='Closed Won' THEN 1 ELSE 0 END) as w FROM inquiries WHERE type='lead' AND assigned_to=? AND date(created_at) BETWEEN ? AND ?").get(userId,ms,me);
    const repeats = db.prepare("SELECT COUNT(*) as t, SUM(CASE WHEN disposition='Closed Won' THEN 1 ELSE 0 END) as w FROM inquiries WHERE type='repeat' AND assigned_to=? AND date(created_at) BETWEEN ? AND ?").get(userId,ms,me);
    const orders  = db.prepare("SELECT COUNT(*) as t, SUM(CASE WHEN disposition='Processed' THEN 1 ELSE 0 END) as w FROM inquiries WHERE type='online_order' AND assigned_to=? AND date(created_at) BETWEEN ? AND ?").get(userId,ms,me);
    return { month: d.toLocaleString('default',{month:'short'}), leads:leads.t||0, leadsWon:leads.w||0, repeats:repeats.t||0, repeatsWon:repeats.w||0, orders:orders.t||0, ordersProcessed:orders.w||0 };
  });

  const untouched = db.prepare(`
    SELECT i.id, c.name as customer_name, c.company as customer_company, i.type, i.disposition,
      MAX(a.created_at) as last_activity, i.created_at
    FROM inquiries i JOIN customers c ON i.customer_id=c.id
    LEFT JOIN inquiry_activity a ON a.inquiry_id=i.id
    WHERE i.assigned_to=? AND i.disposition NOT IN ('Closed Won','Closed Lost','Processed','Cancelled','Fake Lead')
    GROUP BY i.id HAVING (last_activity IS NULL OR last_activity < datetime('now','-7 days'))
    ORDER BY last_activity ASC LIMIT 10
  `).all(userId);

  const recentActivity = db.prepare(`
    SELECT a.id, a.action, a.comment, a.created_at, c.name as customer_name, i.id as entity_id, i.type as inquiry_type
    FROM inquiry_activity a JOIN inquiries i ON a.inquiry_id=i.id JOIN customers c ON i.customer_id=c.id
    WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 20
  `).all(userId);

  res.json({
    today: today_data, month, year: yearS, all, quarter: quarter_stats,
    target, quarterAchievement: { leads:qLeads, repeats:qRepeats, orders:qOrders, revenue:qRevenue },
    totalRevenue, pipeline, followups, weeklyTrend, monthlyBreakdown, untouched, recentActivity,
    meta: { year, quarter, qStart, qEnd },
  });
});

// ── GET /api/analytics/module ─────────────────────────────────
router.get('/module', (req, res) => {
  const db = getDB();
  const userId = req.user.id;
  const { type, from, to } = req.query;
  if (!type) return res.status(400).json({ error: 'type required' });
  const isMan = isManager(req.user);
  let baseWhere = isMan ? `i.type=?` : `i.type=? AND i.assigned_to=?`;
  const baseParams = isMan ? [type] : [type, userId];

  let filterWhere = baseWhere; const filterParams = [...baseParams];
  if (from) { filterWhere += ' AND date(i.created_at)>=?'; filterParams.push(from); }
  if (to)   { filterWhere += ' AND date(i.created_at)<=?'; filterParams.push(to); }

  const today = new Date().toISOString().split('T')[0];
  const todayData = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN type='online_order' AND disposition='Processed' THEN 1 WHEN type!='online_order' AND disposition='Closed Won' THEN 1 ELSE 0 END) as won,
      SUM(CASE WHEN type='online_order' AND disposition='Cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN order_amount IS NOT NULL AND order_amount != '' THEN CAST(REPLACE(REPLACE(order_amount,'$',''),',','') AS REAL) ELSE 0 END) as value,
      SUM(CASE WHEN order_ref IS NOT NULL AND order_ref != '' THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN (order_ref IS NULL OR order_ref='') AND type='online_order' THEN 1 ELSE 0 END) as not_verified,
      SUM(CASE WHEN disposition='Processed' THEN 1 ELSE 0 END) as processed
    FROM inquiries i WHERE ${baseWhere} AND date(i.created_at)=?
  `).get(...baseParams, today);

  const periodData = db.prepare(`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN type='online_order' AND disposition='Processed' THEN 1 WHEN type!='online_order' AND disposition='Closed Won' THEN 1 ELSE 0 END) as won,
      SUM(CASE WHEN disposition='Closed Won' THEN 1 ELSE 0 END) as closed_won,
      SUM(CASE WHEN disposition='Closed Lost' THEN 1 ELSE 0 END) as closed_lost,
      SUM(CASE WHEN disposition='Quoted' THEN 1 ELSE 0 END) as quoted,
      SUM(CASE WHEN disposition='Bidding' THEN 1 ELSE 0 END) as bidding,
      SUM(CASE WHEN disposition='Fake Lead' THEN 1 ELSE 0 END) as fake,
      SUM(CASE WHEN disposition='No response' OR disposition='No Response' THEN 1 ELSE 0 END) as no_response,
      SUM(CASE WHEN disposition='Processed' THEN 1 ELSE 0 END) as processed,
      SUM(CASE WHEN disposition='Cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN order_amount IS NOT NULL AND order_amount != '' THEN CAST(REPLACE(REPLACE(order_amount,'$',''),',','') AS REAL) ELSE 0 END) as value,
      SUM(CASE WHEN order_ref IS NOT NULL AND order_ref !='' THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN (order_ref IS NULL OR order_ref='') AND type='online_order' THEN 1 ELSE 0 END) as not_verified,
      SUM(CASE WHEN ppc_or_outbound='PPC' THEN 1 ELSE 0 END) as ppc,
      SUM(CASE WHEN ppc_or_outbound='Outbound' THEN 1 ELSE 0 END) as outbound,
      SUM(CASE WHEN disposition NOT IN ('Closed Won','Closed Lost','Processed','Cancelled','Fake Lead') AND disposition IS NOT NULL THEN 1 ELSE 0 END) as in_progress
    FROM inquiries i WHERE ${filterWhere}
  `).get(...filterParams);

  const win_rate = (periodData.total||0) > 0 ? Math.round((periodData.won||0)/(periodData.total)*100) : 0;

  const byDisposition = db.prepare(`
    SELECT disposition, COUNT(*) as count FROM inquiries i WHERE ${filterWhere} AND disposition IS NOT NULL
    GROUP BY disposition ORDER BY count DESC
  `).all(...filterParams);

  const bySource = db.prepare(`
    SELECT COALESCE(lead_source, order_source, ppc_or_outbound, 'Unknown') as source, COUNT(*) as count
    FROM inquiries i WHERE ${filterWhere}
    GROUP BY source ORDER BY count DESC LIMIT 10
  `).all(...filterParams);

  // Trend (last 30 days)
  const trend = Array.from({length:30}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-(29-i));
    const ds = d.toISOString().split('T')[0];
    const r = db.prepare(`
      SELECT COUNT(*) as total, SUM(CASE WHEN disposition IN ('Closed Won','Processed') THEN 1 ELSE 0 END) as won,
        SUM(CASE WHEN disposition='Processed' THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN disposition='Cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM inquiries i WHERE ${baseWhere} AND date(i.created_at)=?
    `).get(...baseParams, ds);
    return { date: ds, total:r.total||0, won:r.won||0, processed:r.processed||0, cancelled:r.cancelled||0 };
  });

  res.json({ today: todayData, period: { ...periodData, win_rate }, byDisposition, bySource, trend });
});

// ── GET /api/analytics/purchaser-full ────────────────────────
router.get('/purchaser-full', (req, res) => {
  const db = getDB();
  const userId = req.user.id;
  const today  = new Date().toISOString().split('T')[0];

  const assigned    = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=?").get(userId).c;
  const pending     = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='pending' AND not_in_stock=0").get(userId).c;
  const quotedAll   = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='quoted'").get(userId).c;
  const notInStock  = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND not_in_stock=1").get(userId).c;
  const todayQuotes = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND date(updated_at)=?").get(userId, today).c;
  const weekQuotes  = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND updated_at>=datetime('now','-7 days')").get(userId).c;
  const overdue     = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND status='pending' AND not_in_stock=0 AND assigned_at < datetime('now','-4 days')").get(userId).c;
  const critical    = db.prepare("SELECT COUNT(*) as c FROM purchase_assignments WHERE purchaser_id=? AND urgency='critical' AND status='pending'").get(userId).c;

  // Avg response time (hours from assigned to first quote)
  const times = db.prepare(`
    SELECT (julianday(pq.created_at)-julianday(pa.assigned_at))*24 as hours
    FROM purchase_quotes pq JOIN purchase_assignments pa ON pq.assignment_id=pa.id
    WHERE pa.purchaser_id=? AND hours > 0 AND hours < 240
  `).all(userId);
  const avgHours = times.length > 0 ? +(times.reduce((s,t) => s+t.hours, 0)/times.length).toFixed(1) : null;

  // Daily trend (last 14 days)
  const dailyTrend = Array.from({length:14}, (_,i) => {
    const d  = new Date(); d.setDate(d.getDate()-(13-i));
    const ds = d.toISOString().split('T')[0];
    const c  = db.prepare("SELECT COUNT(*) as c FROM purchase_quotes WHERE purchaser_id=? AND date(updated_at)=?").get(userId, ds);
    return { date: ds, day: d.toLocaleString('default',{weekday:'short'}), count: c.c||0 };
  });

  // By urgency breakdown
  const byUrgency = db.prepare(`
    SELECT urgency, COUNT(*) as count FROM purchase_assignments WHERE purchaser_id=? AND status='pending' GROUP BY urgency
  `).all(userId);

  // By type breakdown
  const byType = db.prepare(`
    SELECT i.type, COUNT(*) as total, SUM(CASE WHEN pa.status='quoted' THEN 1 ELSE 0 END) as quoted
    FROM purchase_assignments pa
    JOIN requirements r ON pa.requirement_id=r.id
    JOIN inquiries i ON r.inquiry_id=i.id
    WHERE pa.purchaser_id=? GROUP BY i.type
  `).all(userId);

  // Follow-ups
  const followupsOverdue = db.prepare(`
    SELECT pf.*, r.part_number, c.name as customer_name
    FROM purchaser_followups pf
    JOIN purchase_assignments pa ON pf.assignment_id=pa.id
    JOIN requirements r ON pa.requirement_id=r.id
    JOIN inquiries i ON r.inquiry_id=i.id
    JOIN customers c ON i.customer_id=c.id
    WHERE pf.purchaser_id=? AND pf.completed=0 AND date(pf.follow_up_date) < date('now')
    ORDER BY pf.follow_up_date ASC LIMIT 10
  `).all(userId);
  const followupsToday = db.prepare(`
    SELECT pf.*, r.part_number, c.name as customer_name
    FROM purchaser_followups pf
    JOIN purchase_assignments pa ON pf.assignment_id=pa.id
    JOIN requirements r ON pa.requirement_id=r.id
    JOIN inquiries i ON r.inquiry_id=i.id
    JOIN customers c ON i.customer_id=c.id
    WHERE pf.purchaser_id=? AND pf.completed=0 AND date(pf.follow_up_date) = date('now')
    ORDER BY pf.follow_up_date ASC LIMIT 10
  `).all(userId);
  const followupsUpcoming = db.prepare(`
    SELECT pf.*, r.part_number, c.name as customer_name
    FROM purchaser_followups pf
    JOIN purchase_assignments pa ON pf.assignment_id=pa.id
    JOIN requirements r ON pa.requirement_id=r.id
    JOIN inquiries i ON r.inquiry_id=i.id
    JOIN customers c ON i.customer_id=c.id
    WHERE pf.purchaser_id=? AND pf.completed=0 AND date(pf.follow_up_date) > date('now')
    ORDER BY pf.follow_up_date ASC LIMIT 10
  `).all(userId);

  // Recent quotes
  const recentQuotes = db.prepare(`
    SELECT pq.*, r.part_number, c.name as customer_name, i.type as inquiry_type
    FROM purchase_quotes pq
    JOIN purchase_assignments pa ON pq.assignment_id=pa.id
    JOIN requirements r ON pa.requirement_id=r.id
    JOIN inquiries i ON r.inquiry_id=i.id
    JOIN customers c ON i.customer_id=c.id
    WHERE pq.purchaser_id=? ORDER BY pq.updated_at DESC LIMIT 10
  `).all(userId);

  res.json({
    stats: { assigned, pending, quotedAll, notInStock, todayQuotes, weekQuotes, overdue, critical, avgHours },
    dailyTrend, byUrgency, byType, recentQuotes,
    followups: { overdue: followupsOverdue, today: followupsToday, upcoming: followupsUpcoming },
  });
});

// ── GET /api/analytics/pm-followups ──────────────────────────
router.get('/pm-followups', canManage, (req, res) => {
  const db = getDB();
  const purchasers = db.prepare("SELECT id, name FROM users WHERE role='purchaser' ORDER BY name").all();
  const result = purchasers.map(p => {
    const overdue = db.prepare(`
      SELECT pf.*, r.part_number, c.name as customer_name
      FROM purchaser_followups pf
      JOIN purchase_assignments pa ON pf.assignment_id=pa.id
      JOIN requirements r ON pa.requirement_id=r.id
      JOIN inquiries i ON r.inquiry_id=i.id
      JOIN customers c ON i.customer_id=c.id
      WHERE pf.purchaser_id=? AND pf.completed=0 AND date(pf.follow_up_date) < date('now')
      ORDER BY pf.follow_up_date ASC LIMIT 8
    `).all(p.id);
    const today = db.prepare(`
      SELECT pf.*, r.part_number, c.name as customer_name
      FROM purchaser_followups pf
      JOIN purchase_assignments pa ON pf.assignment_id=pa.id
      JOIN requirements r ON pa.requirement_id=r.id
      JOIN inquiries i ON r.inquiry_id=i.id
      JOIN customers c ON i.customer_id=c.id
      WHERE pf.purchaser_id=? AND pf.completed=0 AND date(pf.follow_up_date) = date('now')
      ORDER BY pf.follow_up_date ASC LIMIT 8
    `).all(p.id);
    return { purchaser_id: p.id, purchaser_name: p.name, overdue, today };
  }).filter(p => p.overdue.length > 0 || p.today.length > 0);
  res.json(result);
});

// ── PATCH /api/analytics/followup/:id/complete ───────────────
router.patch('/followup/:id/complete', (req, res) => {
  getDB().prepare('UPDATE inquiry_followups SET completed=1 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
