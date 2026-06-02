function runTargetsMigration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ae_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ae_id INTEGER NOT NULL,
      set_by INTEGER NOT NULL,
      year INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      revenue_target REAL DEFAULT 0,
      gp_target REAL DEFAULT 0,
      leads_target INTEGER DEFAULT 0,
      repeat_target INTEGER DEFAULT 0,
      orders_target INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ae_id, year, quarter)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS inquiry_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      note TEXT NOT NULL,
      follow_up_date DATE,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Add gp_target column if it doesn't exist (safe migration)
  try { db.exec(`ALTER TABLE ae_targets ADD COLUMN gp_target REAL DEFAULT 0`); } catch(e) {}
  // Add selling_price to requirements for GP tracking
  try { db.exec(`ALTER TABLE requirements ADD COLUMN selling_price REAL DEFAULT NULL`); } catch(e) {}
  try { db.exec(`ALTER TABLE requirements ADD COLUMN selling_price_entered_by INTEGER DEFAULT NULL`); } catch(e) {}
}
module.exports = { runTargetsMigration };
