const Database = require('better-sqlite3');
const path = require('path');

let db = null;

function initializeDB() {
  if (db) return;
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'crm.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT DEFAULT 'user',
      avatar TEXT,
      ringtone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      company TEXT,
      lead_source TEXT,
      assigned_to INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      disposition TEXT,
      assigned_to INTEGER REFERENCES users(id),
      notes TEXT,
      ppc_or_outbound TEXT,
      order_amount REAL,
      order_ref TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
      part_number TEXT,
      quantity INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
      note TEXT,
      follow_up_date DATE,
      completed INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT,
      entity_id INTEGER,
      user_id INTEGER,
      user_name TEXT,
      action TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      inquiry_id INTEGER,
      inquiry_type TEXT,
      customer_name TEXT,
      actor_name TEXT,
      action TEXT,
      comment TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getDB() {
  if (!db) initializeDB();
  return db;
}

function runPurchasingMigrations() {
  const db = getDB();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
        purchaser_id INTEGER NOT NULL REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        status TEXT DEFAULT 'pending',
        urgency TEXT DEFAULT 'normal',
        pm_notes TEXT,
        purchaser_notes TEXT,
        not_in_stock INTEGER DEFAULT 0,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(requirement_id)
      );
      CREATE TABLE IF NOT EXISTS purchase_quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL REFERENCES purchase_assignments(id) ON DELETE CASCADE,
        requirement_id INTEGER NOT NULL,
        purchaser_id INTEGER NOT NULL,
        price TEXT,
        condition TEXT,
        lead_time TEXT,
        supplier_name TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS purchaser_followups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL REFERENCES purchase_assignments(id) ON DELETE CASCADE,
        purchaser_id INTEGER NOT NULL REFERENCES users(id),
        note TEXT NOT NULL,
        follow_up_date DATE,
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS part_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL REFERENCES purchase_assignments(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id),
        user_name TEXT,
        user_role TEXT,
        comment TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch(e) { console.log('Purchasing migration note:', e.message); }
}

function runPurchasingV2Migrations() {
  const db = getDB();
  const cols = ['urgency TEXT DEFAULT "normal"', 'pm_notes TEXT', 'purchaser_notes TEXT', 'not_in_stock INTEGER DEFAULT 0'];
  cols.forEach(col => { try { db.exec('ALTER TABLE purchase_assignments ADD COLUMN ' + col); } catch(e) {} });
}

function runOperationsMigrations() {
  const db = getDB();
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS op_customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS op_suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        rep_name TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS op_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL,
        order_date DATE,
        customer_id INTEGER REFERENCES op_customers(id) ON DELETE SET NULL,
        email TEXT,
        lead_source TEXT,
        rep TEXT,
        ppc_order_rep TEXT,
        buyer TEXT,
        payment_status TEXT,
        order_status TEXT DEFAULT 'Order placed',
        net REAL DEFAULT 0,
        due_date DATE,
        tax_charged REAL DEFAULT 0,
        shipping_charged REAL DEFAULT 0,
        cc_charges REAL DEFAULT 0,
        customer_paid REAL DEFAULT 0,
        rma_amount REAL DEFAULT 0,
        shipped_via TEXT,
        tracking_to_customer TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS op_order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES op_orders(id) ON DELETE CASCADE,
        part_number TEXT,
        description TEXT,
        product TEXT,
        supplier_id INTEGER REFERENCES op_suppliers(id) ON DELETE SET NULL,
        quantity REAL DEFAULT 1,
        product_condition TEXT,
        selling REAL DEFAULT 0,
        buying REAL DEFAULT 0,
        cc_paid REAL DEFAULT 0,
        tax_paid REAL DEFAULT 0,
        shipping_paid REAL DEFAULT 0,
        duty_paid REAL DEFAULT 0,
        paid_to_supplier REAL DEFAULT 0,
        payment_method TEXT,
        payment_due DATE,
        tracking_to_warehouse TEXT,
        ta_po_number TEXT,
        serials TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS op_rma (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rma_number TEXT NOT NULL,
        order_id INTEGER REFERENCES op_orders(id) ON DELETE SET NULL,
        customer_id INTEGER REFERENCES op_customers(id) ON DELETE SET NULL,
        email TEXT,
        return_quantity INTEGER DEFAULT 1,
        return_reason TEXT,
        rma_status TEXT DEFAULT 'Open',
        rma_issue_date DATE,
        rma_completed_date DATE,
        refund_issued REAL DEFAULT 0,
        restocking_fee REAL DEFAULT 0,
        return_tracking_number TEXT,
        return_shipping_paid REAL DEFAULT 0,
        notes TEXT,
        qb_credit_memo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS op_rma_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rma_id INTEGER NOT NULL REFERENCES op_rma(id) ON DELETE CASCADE,
        order_item_id INTEGER REFERENCES op_order_items(id) ON DELETE SET NULL,
        quantity INTEGER DEFAULT 1
      );
    `);
  } catch(e) { console.log('Operations migration note:', e.message); }

  // v2 — add order_item_id to op_rma for Return Item link
  const rmaV2Cols = [
    'order_item_id INTEGER REFERENCES op_order_items(id) ON DELETE SET NULL',
  ];
  rmaV2Cols.forEach(col => { try { db.exec(`ALTER TABLE op_rma ADD COLUMN ${col}`); } catch(e) {} });

  // v3 — add pending flag and CRM source link to op_orders
  const ordersV3Cols = [
    'pending INTEGER DEFAULT 0',
    'crm_inquiry_id INTEGER',
  ];
  ordersV3Cols.forEach(col => { try { db.exec(`ALTER TABLE op_orders ADD COLUMN ${col}`); } catch(e) {} });

  // v4 — reporting period (e.g. "Q2-26") for quarter-based filtering independent of order date
  try { db.exec(`ALTER TABLE op_orders ADD COLUMN reporting_period TEXT`); } catch(e) {}

  // v5 — AR/AP status derived from sheet col G and col N at import time
  try { db.exec(`ALTER TABLE op_orders ADD COLUMN ar_status TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE op_order_items ADD COLUMN ap_status TEXT`); } catch(e) {}

  // v6 — quarter closings (finalized periods)
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS op_quarter_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period TEXT NOT NULL UNIQUE,
      closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_by INTEGER REFERENCES users(id)
    )`);
  } catch(e) {}

  // v7 — per-line-item processing status. 'pending' lines are EXCLUDED from dashboard/stats
  // revenue & GP rollups until set to 'processed'. Defaults to 'processed' so existing/imported
  // data keeps counting unchanged.
  try { db.exec(`ALTER TABLE op_order_items ADD COLUMN line_status TEXT DEFAULT 'processed'`); } catch(e) {}

  // v8 — key/value settings for Operations. Holds 'open_period' = the current OPEN reporting month
  // that new CRM-entered orders are auto-tagged to. "Close month" advances it to the next calendar
  // month. Seeded to 'Jun-26' (the last month of the historical sheet import) if not already set.
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS op_settings (key TEXT PRIMARY KEY, value TEXT)`);
    db.prepare(`INSERT OR IGNORE INTO op_settings (key, value) VALUES ('open_period', 'Jun-26')`).run();
  } catch(e) {}
}

module.exports = { initializeDB, getDB, runPurchasingMigrations, runPurchasingV2Migrations, runOperationsMigrations };
