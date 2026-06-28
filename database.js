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
  // Link part_assigned/part_reassigned notifications to the assignment so the purchaser's
  // notifications can deep-link straight to the exact part. Older rows stay NULL.
  try { db.exec('ALTER TABLE notifications ADD COLUMN assignment_id INTEGER'); } catch(e) {}

  // Track which user (manager) created each user account. Pre-existing users stay NULL.
  // No REFERENCES clause — SQLite can reject ADD COLUMN with a foreign-key reference.
  try { db.exec('ALTER TABLE users ADD COLUMN created_by INTEGER'); } catch(e) {}

  // Backfill assignment_id for pre-existing 'part_assigned' notifications so older ones are also
  // clickable. Match on purchaser + part number + customer, taking the most recent assignment.
  // Only touches NULL rows, so it's cheap on every boot.
  try {
    db.exec(`
      UPDATE notifications
      SET assignment_id = (
        SELECT pa.id FROM purchase_assignments pa
        JOIN requirements r ON pa.requirement_id = r.id
        JOIN inquiries i ON r.inquiry_id = i.id
        JOIN customers c ON i.customer_id = c.id
        WHERE pa.purchaser_id = notifications.user_id
          AND r.part_number = notifications.comment
          AND c.name = notifications.customer_name
        ORDER BY pa.assigned_at DESC LIMIT 1
      )
      WHERE assignment_id IS NULL
        AND inquiry_type = 'part_assigned'
        AND comment IS NOT NULL AND comment != ''
    `);
  } catch(e) { console.log('Notification assignment_id backfill note:', e.message); }
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

  // One-time: historical orders with no buyer were sourced by the purchasing manager (Abdul).
  // Attribute them to him so the dashboard byBuyer card credits Abdul instead of "Unknown".
  // Guarded by a settings flag → runs ONCE; future blank-buyer orders stay blank (still show "Unknown").
  try {
    const done = db.prepare("SELECT value FROM op_settings WHERE key='abdul_buyer_backfill'").get();
    if (!done) {
      db.prepare("UPDATE op_orders SET buyer='Abdul' WHERE buyer IS NULL OR TRIM(buyer)='' OR LOWER(TRIM(buyer))='unknown'").run();
      db.prepare("INSERT OR REPLACE INTO op_settings (key, value) VALUES ('abdul_buyer_backfill', '1')").run();
    }
  } catch(e) {}

  // One-time: a sheet re-import created op_orders with vendor_complete=0 (the column default), so every
  // historical (already-fulfilled) order flooded the buyer's To-Do queue. Mark all current finalized
  // (non-pending) orders complete — same intent as runBuyerMigration's original backfill. Guarded → runs
  // ONCE; future imports now stamp vendor_complete=1 themselves (routes/import.js), and live CRM orders
  // stay pending=1 so they're untouched.
  try {
    const done = db.prepare("SELECT value FROM op_settings WHERE key='import_vendor_complete_backfill'").get();
    if (!done) {
      db.prepare("UPDATE op_orders SET vendor_complete=1 WHERE (pending IS NULL OR pending=0) AND COALESCE(vendor_complete,0)=0").run();
      db.prepare("INSERT OR REPLACE INTO op_settings (key, value) VALUES ('import_vendor_complete_backfill', '1')").run();
    }
  } catch(e) {}

  // v9 — customer payment records (AR receipts). An order's customer_paid is kept in sync as the
  // SUM of these rows, so "Received" / balance / paid-status all derive from the payment log
  // instead of a hand-typed number.
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS op_order_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES op_orders(id) ON DELETE CASCADE,
      amount REAL DEFAULT 0,
      payment_date DATE,
      method TEXT,
      reference TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch(e) {}

  // v10 — supplier (AP) payment terms on a line item. Used to auto-fill payment_due
  // (= order date + N days) so AP aging / overdue-to-pay works, mirroring the AR side.
  try { db.exec(`ALTER TABLE op_order_items ADD COLUMN supplier_terms TEXT`); } catch(e) {}

  // v11 — supplier payment records (AP disbursements). A line item's paid_to_supplier is kept in
  // sync as the SUM of these rows, so "Paid" / balance / status derive from the payment log.
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS op_item_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_item_id INTEGER NOT NULL REFERENCES op_order_items(id) ON DELETE CASCADE,
      amount REAL DEFAULT 0,
      payment_date DATE,
      method TEXT,
      reference TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch(e) {}

  // v12 — RMA cost-recovery flag for the new (post-sheet) return logic. 1 = the returned goods'
  // cost is recovered (sent back to vendor / restocked), 0 = scrapped (cost eaten). Drives the GP
  // reversal for COMPLETED RMAs only. Historical imported orders have no RMA records, so their
  // rma_amount stays 0 and their numbers are untouched.
  try { db.exec(`ALTER TABLE op_rma ADD COLUMN cost_recovered INTEGER DEFAULT 1`); } catch(e) {}
}

// Per-user "seen" state for the AE "Newly Assigned" lead/order widgets (replaces per-browser
// localStorage). A row means user has viewed that inquiry; absence = it's still "new" to them.
function runInquiryViewsMigration() {
  const db = getDB();
  // Detect first creation so we backfill exactly once (otherwise a restart would re-mark
  // genuinely-unseen inquiries as seen).
  const existed = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inquiry_views'").get();
  db.exec(`
    CREATE TABLE IF NOT EXISTS inquiry_views (
      user_id INTEGER NOT NULL,
      inquiry_id INTEGER NOT NULL,
      seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, inquiry_id)
    );
  `);
  if (!existed) {
    // Treat everything that already exists as seen by its current assignee, so the switch-over
    // doesn't flag a rep's entire book. Only assignments made AFTER this will surface as new.
    try { db.prepare("INSERT OR IGNORE INTO inquiry_views (user_id, inquiry_id) SELECT assigned_to, id FROM inquiries WHERE assigned_to IS NOT NULL").run(); }
    catch(e) { console.log('inquiry_views backfill note:', e.message); }
  }
}

// Vendor/fulfillment workflow (the "Buyer" role, e.g. Kevin) — adds order-level fulfillment
// tracking + a per-order "vendor side complete" flag so closed-won orders surface in his queue.
function runBuyerMigration() {
  const db = getDB();
  const hadFlag = db.prepare("PRAGMA table_info(op_orders)").all().some(c => c.name === 'vendor_complete');
  const cols = [
    "fulfillment_status TEXT",        // Awaiting PO | PO Placed | Shipped to Warehouse | Received | Shipped to Customer | Delivered
    "vendor_complete INTEGER DEFAULT 0",
    "vendor_completed_at DATETIME",
    "vendor_completed_by INTEGER",
  ];
  cols.forEach(c => { try { db.exec(`ALTER TABLE op_orders ADD COLUMN ${c}`); } catch(e) {} });
  // Per-line "sourced by" — the purchaser who quoted this supplier line (carried from the quote at Closed Won).
  try { db.exec('ALTER TABLE op_order_items ADD COLUMN sourced_by TEXT'); } catch(e) {}
  if (!hadFlag) {
    // First run: everything already finalized (non-pending) is treated as done so the queue isn't
    // flooded with historical orders. Currently-pending orders stay in the queue (need vendor work).
    try { db.prepare("UPDATE op_orders SET vendor_complete = 1 WHERE pending IS NULL OR pending = 0").run(); }
    catch(e) { console.log('buyer backfill note:', e.message); }
  }
}

// Multi-supplier sourcing: a line item can now have MULTIPLE quote entries, each with its own
// quantity (split across suppliers / partial availability). Adds quantity to purchase_quotes.
function runQuoteEntriesMigration() {
  const db = getDB();
  try { db.exec('ALTER TABLE purchase_quotes ADD COLUMN quantity REAL'); } catch(e) {}
  // Existing single quotes represented the whole line → backfill quantity = requirement quantity.
  // Only fills NULLs, so it's safe on every boot (new multi-entries always set quantity).
  try { db.prepare(`UPDATE purchase_quotes SET quantity = (SELECT r.quantity FROM requirements r WHERE r.id = purchase_quotes.requirement_id) WHERE quantity IS NULL`).run(); }
  catch(e) { console.log('quote quantity backfill note:', e.message); }
}

// Mark inquiries that came from the historical sheet IMPORT vs ones created live in-app. Imported
// inquiries are already-fulfilled history — their parts must NOT flood the purchasing dashboard's
// "to assign" queue/counts. Live inquiries (imported=0) flow through purchasing + notify the PM.
function runImportedFlagMigration() {
  const db = getDB();
  const had = db.prepare("PRAGMA table_info(inquiries)").all().some(c => c.name === 'imported');
  try { db.exec('ALTER TABLE inquiries ADD COLUMN imported INTEGER DEFAULT 0'); } catch (e) {}
  if (!had) {
    // First run: every inquiry already in the DB came from the past import, so mark them all imported=1.
    // They drop out of the purchasing assignment queue immediately. Anything created after this (live
    // CRM records) defaults to 0 and is sourced normally. Re-imports also stamp imported=1 (see import.js).
    try { db.prepare('UPDATE inquiries SET imported = 1').run(); }
    catch (e) { console.log('imported backfill note:', e.message); }
  }
}

// Customer-facing quotes generated from an inquiry (number sequence + lightweight history/log).
function runQuotesMigration() {
  const db = getDB();
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT,
      inquiry_id INTEGER,
      customer_name TEXT,
      customer_company TEXT,
      total REAL DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) { console.log('quotes migration note:', e.message); }
}

// Records each generated customer invoice — drives the auto-sequential INV number + history.
function runInvoicesMigration() {
  const db = getDB();
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT,
      order_id INTEGER,
      customer_name TEXT,
      total REAL DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) { console.log('invoices migration note:', e.message); }
}

// Records each generated supplier purchase order — drives the auto-sequential PO number + history.
function runPurchaseOrdersMigration() {
  const db = getDB();
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT,
      order_id INTEGER,
      supplier_id INTEGER,
      supplier_name TEXT,
      total REAL DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) { console.log('purchase_orders migration note:', e.message); }
}

module.exports = { initializeDB, getDB, runPurchasingMigrations, runPurchasingV2Migrations, runOperationsMigrations, runInquiryViewsMigration, runBuyerMigration, runQuoteEntriesMigration, runImportedFlagMigration, runQuotesMigration, runInvoicesMigration, runPurchaseOrdersMigration };
