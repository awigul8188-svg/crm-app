const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { getDB } = require('../database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireManager);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Excel serial date → ISO string
function excelDateToISO(serial) {
  if (!serial || isNaN(Number(serial))) return new Date().toISOString();
  const date = new Date((Number(serial) - 25569) * 86400 * 1000);
  return date.toISOString();
}

// Clean a cell value to string
function str(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

// Split part numbers by comma/semicolon, pair with qty
function parseRequirements(partCell, qtyCell) {
  const partStr = str(partCell);
  if (!partStr) return [];
  const parts = partStr.split(/[,;]/).map(p => p.trim()).filter(Boolean);
  const qtyStr = str(qtyCell);
  const qtys = qtyStr.split(/[,;]/).map(q => q.trim()).filter(Boolean);
  return parts.map((part, i) => ({
    part_number: part,
    quantity: qtys[i] || qtyStr || '1'
  }));
}

// Match user by first name (case-insensitive)
function findUserId(db, name) {
  if (!name) return null;
  const n = str(name).split(/\s+/)[0].toLowerCase();
  const user = db.prepare("SELECT id FROM users WHERE LOWER(name) LIKE ? OR LOWER(username) = ?").get(`${n}%`, n);
  return user?.id || null;
}

// Find existing customer by email, or create new
function findOrCreateCustomer(db, { name, email, phone, company, lead_source, assigned_to, createdAt }) {
  const cleanEmail = email ? str(email).toLowerCase() : null;

  if (cleanEmail) {
    const existing = db.prepare("SELECT id FROM customers WHERE LOWER(email) = ?").get(cleanEmail);
    if (existing) return existing.id;
  }

  const result = db.prepare(
    "INSERT INTO customers (name, email, phone, company, lead_source, assigned_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    str(name) || 'Unknown',
    cleanEmail || null,
    phone ? str(phone) : null,
    company ? str(company) : null,
    lead_source ? str(lead_source) : null,
    assigned_to || null,
    createdAt || new Date().toISOString()
  );
  return result.lastInsertRowid;
}

// Map raw status/comments to cleaned disposition
function mapDisposition(raw) {
  const s = str(raw).toLowerCase();
  if (s.includes('process')) return 'Processed';
  if (s.includes('cancel')) return 'Cancelled';
  if (s.includes('quoted')) return 'Quoted';
  if (s.includes('closed won')) return 'Closed Won';
  if (s.includes('closed lost')) return 'Closed Lost';
  if (s.includes('bidding')) return 'Bidding';
  if (s.includes('pricing')) return 'Pricing Issue';
  if (s.includes('not available')) return 'Part Not Available';
  if (s.includes('fake')) return 'Fake Lead';
  if (s.includes('hold')) return 'Hold';
  if (s.includes('cold')) return 'Cold';
  if (s.includes('supplier')) return 'Supplier';
  if (s.includes('initial')) return 'Initial Contact';
  return str(raw) || 'Initial Contact';
}

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const db = getDB();
  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });

  let created = 0;
  const errors = [];

  const insertInquiry = db.prepare(`
    INSERT INTO inquiries 
    (customer_id, type, disposition, assigned_to, notes, ppc_or_outbound, order_amount, order_ref, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertReq = db.prepare("INSERT INTO requirements (inquiry_id, part_number, quantity) VALUES (?, ?, ?)");

  // ── Online Orders ────────────────────────────────────────────────
  if (wb.SheetNames.includes('Online Orders')) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Online Orders'], { defval: '' });
    const importRows = db.transaction(() => {
      for (const row of rows) {
        try {
          if (!str(row['Name']) && !str(row['Email'])) continue;
          const createdAt = excelDateToISO(row['Date']);
          const assignedToId = findUserId(db, row['Assigned To']);

          // Map status: use Status column, fallback to Comments
          const rawStatus = str(row['Status']) || str(row['Comments']);
          const disposition = mapDisposition(rawStatus);

          const customerId = findOrCreateCustomer(db, {
            name: row['Name'], email: row['Email'],
            lead_source: str(row['Source']) || null,
            assigned_to: assignedToId, createdAt,
          });

          const result = insertInquiry.run(
            customerId, 'online_order', disposition, assignedToId,
            str(row['Comments']) || null,
            null, // ppc_or_outbound
            str(row['Order Amount']) || null,
            str(row['Order']) || null, // Verification status
            createdAt, createdAt
          );

          const reqs = parseRequirements(row['Part Number'], row['Total Quantity']);
          reqs.forEach(r => insertReq.run(result.lastInsertRowid, r.part_number, r.quantity));
          created++;
        } catch (e) {
          errors.push(`Online Orders: ${str(row['Name'])} — ${e.message}`);
        }
      }
    });
    importRows();
  }

  // ── New Leads ────────────────────────────────────────────────────
  if (wb.SheetNames.includes('New Leads')) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['New Leads'], { defval: '' });
    const importRows = db.transaction(() => {
      for (const row of rows) {
        try {
          if (!str(row['Name']) && !str(row['Email'])) continue;
          const createdAt = excelDateToISO(row['Date']);
          const assignedToId = findUserId(db, row['Assigned to'] || row['Assigned To']);
          const disposition = str(row['Disposition']) || 'Initial Contact';

          const customerId = findOrCreateCustomer(db, {
            name: row['Name'], email: row['Email'],
            phone: row['Ph#'], company: row['Company'],
            lead_source: str(row['Lead Source']) || null,
            assigned_to: assignedToId, createdAt,
          });

          const result = insertInquiry.run(
            customerId, 'lead', disposition, assignedToId,
            str(row['Comments']) || null,
            null, null, null, createdAt, createdAt
          );

          const reqs = parseRequirements(row['Part Number'], row['Qty']);
          reqs.forEach(r => insertReq.run(result.lastInsertRowid, r.part_number, r.quantity));
          created++;
        } catch (e) {
          errors.push(`New Leads: ${str(row['Name'])} — ${e.message}`);
        }
      }
    });
    importRows();
  }

  // ── Repeat Inquiries ─────────────────────────────────────────────
  if (wb.SheetNames.includes('Repeat Inquiries')) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['Repeat Inquiries'], { defval: '' });
    const importRows = db.transaction(() => {
      for (const row of rows) {
        try {
          if (!str(row['Name']) && !str(row['Email'])) continue;
          const createdAt = excelDateToISO(row['Date']);
          const assignedToId = findUserId(db, row['Assigned To']);
          const disposition = str(row['Disposition']) || 'Initial Contact';

          const customerId = findOrCreateCustomer(db, {
            name: row['Name'], email: row['Email'],
            phone: row['Number'], company: row['Company'],
            assigned_to: assignedToId, createdAt,
          });

          const result = insertInquiry.run(
            customerId, 'repeat', disposition, assignedToId,
            str(row['Comments']) || null,
            str(row['PPC Or Outbound Repeat']) || null,
            null, null, createdAt, createdAt
          );

          const reqs = parseRequirements(row['Part#'], row['Qty']);
          reqs.forEach(r => insertReq.run(result.lastInsertRowid, r.part_number, r.quantity));
          created++;
        } catch (e) {
          errors.push(`Repeat: ${str(row['Name'])} — ${e.message}`);
        }
      }
    });
    importRows();
  }

  res.json({ success: true, created, errors: errors.slice(0, 50) });
});

module.exports = router;
