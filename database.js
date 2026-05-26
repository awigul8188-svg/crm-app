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

function runNFTMigrations() {
  const db = getDB();
  const tables = [
    `CREATE TABLE IF NOT EXISTS nft_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      real_name TEXT NOT NULL,
      job_title TEXT DEFAULT 'Account Executive',
      department TEXT DEFAULT 'Sales',
      photo_url TEXT,
      phone TEXT,
      hire_date DATE,
      nft_role TEXT DEFAULT 'employee',
      bio TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS nft_salary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      base_salary REAL DEFAULT 0,
      month TEXT NOT NULL,
      bonus REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, month)
    )`,
    `CREATE TABLE IF NOT EXISTS nft_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      quarter TEXT NOT NULL,
      sales_target REAL DEFAULT 0,
      gp_target REAL DEFAULT 0,
      sales_achieved REAL DEFAULT 0,
      gp_achieved REAL DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, quarter)
    )`,
    `CREATE TABLE IF NOT EXISTS nft_biodata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      doc_type TEXT NOT NULL,
      doc_name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      uploaded_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS nft_kiosk_menu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Food',
      price REAL NOT NULL,
      description TEXT,
      available INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS nft_kiosk_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      items TEXT NOT NULL,
      total_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS nft_shop_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      inventory INTEGER DEFAULT 0,
      category TEXT DEFAULT 'Merchandise',
      available INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS nft_shop_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      items TEXT NOT NULL,
      total_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      deduction_status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS nft_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT DEFAULT 'dm',
      name TEXT,
      participants TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS nft_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES nft_conversations(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT,
      file_url TEXT,
      file_name TEXT,
      file_size INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS nft_news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      author_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS nft_cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      image_url TEXT,
      required_sales_target REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS nft_car_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      car_id INTEGER NOT NULL REFERENCES nft_cars(id),
      achieved_at DATE,
      notes TEXT
    )`
  ];
  tables.forEach(sql => { try { db.exec(sql); } catch(e) { console.log('NFT migration:', e.message); } });

  // Seed default NFT profiles if none exist
  const count = db.prepare('SELECT COUNT(*) as c FROM nft_profiles').get().c;
  if (count === 0) {
    const users = db.prepare("SELECT id, name FROM users WHERE role IN ('ae','manager')").all();
    const nameMap = { ryan:'Usman Azeem', ethan:'Hammad Asif', eddie:'Awais Gul Khan', justin:'Ahmed Naseem', hector:'Ahmed Shafay', aman:'Aman' };
    const ins = db.prepare('INSERT OR IGNORE INTO nft_profiles (user_id, real_name, nft_role) VALUES (?,?,?)');
    users.forEach(u => {
      const realName = nameMap[u.name?.toLowerCase()] || u.name;
      const role = u.name?.toLowerCase() === 'eddie' || u.name?.toLowerCase() === 'ethan' ? 'manager' : 'employee';
      ins.run(u.id, realName, role);
    });
  }
}
module.exports.runNFTMigrations = runNFTMigrations;

function runNFTV2Migrations() {
  const db = getDB();
  const bcrypt = require('bcryptjs');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS nft_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        real_name TEXT NOT NULL,
        role TEXT DEFAULT 'employee',
        job_title TEXT,
        department TEXT DEFAULT 'Sales',
        photo_url TEXT,
        phone TEXT,
        hire_date DATE,
        bio TEXT,
        token_version INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Update NFT tables to allow null or nft_user references
    // Seed managers if not present
    const count = db.prepare("SELECT COUNT(*) as c FROM nft_users WHERE role='manager'").get().c;
    if (count === 0) {
      const hash = bcrypt.hashSync('Admin@123', 10);
      db.prepare("INSERT OR IGNORE INTO nft_users (username, password, real_name, role, job_title) VALUES (?,?,?,?,?)").run('awais', hash, 'Awais Gul Khan', 'manager', 'Managing Director');
      db.prepare("INSERT OR IGNORE INTO nft_users (username, password, real_name, role, job_title) VALUES (?,?,?,?,?)").run('hammad', hash, 'Hammad Asif', 'manager', 'Manager');
      // Seed employees
      const employees = [
        ['usman', 'Usman Azeem', 'Account Executive'],
        ['ahmed_naseem', 'Ahmed Naseem', 'Account Executive'],
        ['ahmed_shafay', 'Ahmed Shafay', 'Account Executive'],
        ['aman', 'Aman', 'Account Executive'],
      ];
      const empHash = bcrypt.hashSync('Team@123', 10);
      employees.forEach(([u, n, t]) => db.prepare("INSERT OR IGNORE INTO nft_users (username, password, real_name, role, job_title) VALUES (?,?,?,?,?)").run(u, empHash, n, 'employee', t));
    }
  } catch(e) { console.log('NFT V2 migration note:', e.message); }
}
module.exports.runNFTV2Migrations = runNFTV2Migrations;
