// Add this function to database.js and call it in initializeDB()

function runTargetsMigration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ae_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ae_id INTEGER NOT NULL,
      set_by INTEGER NOT NULL,
      year INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      revenue_target REAL DEFAULT 0,
      leads_target INTEGER DEFAULT 0,
      repeat_target INTEGER DEFAULT 0,
      orders_target INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(ae_id, year, quarter),
      FOREIGN KEY(ae_id) REFERENCES users(id),
      FOREIGN KEY(set_by) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS inquiry_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inquiry_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      note TEXT NOT NULL,
      follow_up_date DATE,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(inquiry_id) REFERENCES inquiries(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
}

module.exports = { runTargetsMigration };
