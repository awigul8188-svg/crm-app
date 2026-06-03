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

module.exports = { initializeDB, getDB, runPurchasingMigrations, runPurchasingV2Migrations };
