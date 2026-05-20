const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'crm.db');
let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initializeDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ae',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
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
      disposition TEXT DEFAULT 'Initial Contact',
      assigned_to INTEGER REFERENCES users(id),
      notes TEXT,
      ppc_or_outbound TEXT,
      order_amount TEXT,
      order_ref TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
      part_number TEXT NOT NULL,
      quantity TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      follow_up_date TEXT,
      completed INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      user_id INTEGER REFERENCES users(id),
      user_name TEXT,
      action TEXT NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations for existing databases
  const migrations = [
    "ALTER TABLE inquiries ADD COLUMN disposition TEXT DEFAULT 'Initial Contact'",
    "ALTER TABLE inquiries ADD COLUMN ppc_or_outbound TEXT",
    "ALTER TABLE inquiries ADD COLUMN order_amount TEXT",
    "ALTER TABLE inquiries ADD COLUMN order_ref TEXT",
    "ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN avatar_url TEXT",
    "ALTER TABLE users ADD COLUMN ringtone_url TEXT",
    "ALTER TABLE users ADD COLUMN ringtone_active INTEGER DEFAULT 0",
    "CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, inquiry_id INTEGER, inquiry_type TEXT, customer_name TEXT, actor_name TEXT, action TEXT, comment TEXT, read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
  ];
  for (const m of migrations) {
    try { db.exec(m) } catch {}
  }

  // Seed all team members if no users exist
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (count.c === 0) {
    const managerHash = bcrypt.hashSync('Admin@123', 10);
    const aeHash = bcrypt.hashSync('Team@123', 10);
    db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, 'manager')").run('eddie', managerHash, 'Eddie');
    db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, 'manager')").run('ethan', managerHash, 'Ethan');
    db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, 'ae')").run('ryan', aeHash, 'Ryan');
    db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, 'ae')").run('justin', aeHash, 'Justin');
    db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, 'ae')").run('aman', aeHash, 'Aman');
    db.prepare("INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, 'ae')").run('hector', aeHash, 'Hector');
    console.log('✅ All team members seeded → Managers: Admin@123 | AEs: Team@123');
  }

  console.log('✅ Database ready');
}

module.exports = { getDB, initializeDB };

// Additional migrations run at startup (safe to re-run - uses IF NOT EXISTS or try/catch)
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
    `);
  } catch(e) { console.log('Purchasing migration note:', e.message); }
}

module.exports.runPurchasingMigrations = runPurchasingMigrations;

function runPurchasingV2Migrations() {
  const db = getDB();
  try {
    db.exec(`
      ALTER TABLE purchase_assignments ADD COLUMN urgency TEXT DEFAULT 'normal';
    `);
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE purchase_assignments ADD COLUMN pm_notes TEXT;`);
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE purchase_assignments ADD COLUMN purchaser_notes TEXT;`);
  } catch(e) {}
  try {
    db.exec(`ALTER TABLE purchase_assignments ADD COLUMN not_in_stock INTEGER DEFAULT 0;`);
  } catch(e) {}
  try {
    db.exec(`
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
  } catch(e) { console.log('V2 migration note:', e.message); }
}
module.exports.runPurchasingV2Migrations = runPurchasingV2Migrations;
