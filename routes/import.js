const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { getDB } = require('../database');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireManager);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function excelDateToISO(serial) {
  if (!serial || isNaN(Number(serial))) return new Date().toISOString();
  const n = Number(serial);
  if (n < 1) return new Date().toISOString();
  const date = new Date((n - 25569) * 86400 * 1000);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function str(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function parseRequirements(partCell, qtyCell) {
  const partStr = str(partCell);
  if (!partStr || partStr === '0') return [];
  const parts = partStr.split(/[,;]/).map(p => p.trim()).filter(Boolean);
  const qtyStr = str(qtyCell);
  const qtys = qtyStr.split(/[,;]/).map(q => q.trim()).filter(Boolean);
  return parts.map((part, i) => ({
    part_number: part,
    quantity: qtys[i] || qtyStr || '1'
  }));
}

function findUserId(db, name) {
  if (!name) return null;
  const n = str(name).split(/\s+/)[0].toLowerCase();
  if (!n) return null;
  const user = db.prepare("SELECT id FROM users WHERE LOWER(name) LIKE ? OR LOWER(username) = ?").get(`${n}%`, n);
  return user?.id || null;
}

function findOrCreateCustomer(db, { name, email, phone, company, lead_source, assigned_to, createdAt }) {
  const cleanEmail = email ? str(email).toLowerCase().replace(/^mailto:/, '').trim() : null;
  if (cleanEmail) {
    const existing = db.prepare("SELECT id FROM customers WHERE LOWER(email) = ?").get(cleanEmail);
    if (existing) return existing.id;
  }
  const cleanName = str(name) || 'Unknown';
  const result = db.prepare(
    "INSERT INTO customers (name, email, phone, company, lead_source, assigned_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(cleanName, cleanEmail || null, phone ? str(phone) : null, company ? str(company) : null, lead_source ? str(lead_source) : null, assigned_to || null, createdAt || new Date().toISOString());
  return result.lastInsertRowid;
}

function mapDisposition(raw) {
  const s = str(raw).toLowerCase();
  if (!s) return 'Initial Contact';
  if (s.includes('process')) return 'Processed';
  if (s.includes('cancel')) return 'Cancelled';
  if (s.includes('closed won')) return 'Closed Won';
  if (s.includes('closed lost')) return 'Closed Lost';
  if (s.includes('quoted')) return 'Quoted';
  if (s.includes('bidding')) return 'Bidding';
  if (s.includes('pricing')) return 'Pricing Issue';
  if (s.includes('not available') || s.includes('part not')) return 'Part Not Available';
  if (s.includes('fake')) return 'Fake Lead';
  if (s.includes('hold')) return 'Hold';
  if (s.includes('cold')) return 'Cold';
  if (s.includes('supplier')) return 'Supplier';
  if (s.includes('desi')) return 'Desi';
  if (s.includes('refunded') || s.includes('restocking')) return 'Closed Lost';
  if (s.includes('initial')) return 'Initial Contact';
  return str(raw) || 'Initial Contact';
}

// Find sheet by partial/case-insensitive name
function findSheet(wb, keywords) {
  for (const name of wb.SheetNames) {
    const lower = name.toLowerCase();
    if (keywords.some(k => lower.includes(k.toLowerCase()))) return name;
  }
  return null;
}

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const db = getDB();
  let wb;
  try {
    wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (e) {
    return res.status(400).json({ error: 'Could not read Excel file: ' + e.message });
  }

  const sheetsFound = wb.SheetNames;
  let created = 0;
  const errors = [];

  const insertInquiry = db.prepare(`
    INSERT INTO inquiries (customer_id, type, disposition, assigned_to, notes, ppc_or_outbound, order_amount, order_ref, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertReq = db.prepare("INSERT INTO requirements (inquiry_id, part_number, quantity) VALUES (?, ?, ?)");

  // \u2500\u2500 Online Orders \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const ordersSheet = findSheet(wb, ['online order', 'orders']);
  if (ordersSheet) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[ordersSheet], { defval: '' });
    try {
      db.transaction(() => {
        for (const row of rows) {
          try {
            if (!str(row['Name']) && !str(row['Email'])) continue;
            const createdAt = excelDateToISO(row['Date']);
            const assignedToId = findUserId(db, row['Assigned To']);
            const rawStatus = str(row['Status']) || str(row['Comments']) || '';
            const disposition = mapDisposition(rawStatus);
            const customerId = findOrCreateCustomer(db, {
              name: row['Name'], email: row['Email'],
              lead_source: str(row['Source']) || null,
              assigned_to: assignedToId, createdAt,
            });
            const result = insertInquiry.run(customerId, 'online_order', disposition, assignedToId,
              str(row['Comments']) || null, null,
              row['Order Amount'] !== '' ? str(row['Order Amount']) : null,
              str(row['Order']) || null, createdAt, createdAt);
            const reqs = parseRequirements(row['Part Number'], row['Total Quantity']);
            reqs.forEach(r => insertReq.run(result.lastInsertRowid, r.part_number, r.quantity));
            created++;
          } catch (e) { errors.push(`Online Orders [${str(row['Name'])}]: ${e.message}`); }
        }
      })();
    } catch (e) { errors.push(`Online Orders sheet error: ${e.message}`); }
  }

  // \u2500\u2500 New Leads \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const leadsSheet = findSheet(wb, ['new lead', 'lead']);
  if (leadsSheet) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[leadsSheet], { defval: '' });
    try {
      db.transaction(() => {
        for (const row of rows) {
          try {
            if (!str(row['Name']) && !str(row['Email'])) continue;
            const createdAt = excelDateToISO(row['Date']);
            const assignedToId = findUserId(db, row['Assigned to'] || row['Assigned To']);
            const disposition = str(row['Disposition']) || 'Initial Contact';
            const customerId = findOrCreateCustomer(db, {
              name: row['Name'], email: row['Email'],
              phone: row['Ph#'] || row['Phone'], company: row['Company'],
              lead_source: str(row['Lead Source']) || null,
              assigned_to: assignedToId, createdAt,
            });
            const result = insertInquiry.run(customerId, 'lead', disposition, assignedToId,
              str(row['Comments']) || null, null, null, null, createdAt, createdAt);
            const reqs = parseRequirements(row['Part Number'], row['Qty']);
            reqs.forEach(r => insertReq.run(result.lastInsertRowid, r.part_number, r.quantity));
            created++;
          } catch (e) { errors.push(`Leads [${str(row['Name'])}]: ${e.message}`); }
        }
      })();
    } catch (e) { errors.push(`Leads sheet error: ${e.message}`); }
  }

  // \u2500\u2500 Repeat Inquiries \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const repeatSheet = findSheet(wb, ['repeat']);
  if (repeatSheet) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[repeatSheet], { defval: '' });
    try {
      db.transaction(() => {
        for (const row of rows) {
          try {
            if (!str(row['Name']) && !str(row['Email'])) continue;
            const createdAt = excelDateToISO(row['Date']);
            const assignedToId = findUserId(db, row['Assigned To']);
            const disposition = str(row['Disposition']) || 'Initial Contact';
            const customerId = findOrCreateCustomer(db, {
              name: row['Name'], email: row['Email'],
              phone: row['Number'] || row['Phone'], company: row['Company'],
              assigned_to: assignedToId, createdAt,
            });
            const result = insertInquiry.run(customerId, 'repeat', disposition, assignedToId,
              str(row['Comments']) || null,
              str(row['PPC Or Outbound Repeat']) || str(row['PPC or Outbound Repeat']) || null,
              null, null, createdAt, createdAt);
            const reqs = parseRequirements(row['Part#'] || row['Part Number'], row['Qty']);
            reqs.forEach(r => insertReq.run(result.lastInsertRowid, r.part_number, r.quantity));
            created++;
          } catch (e) { errors.push(`Repeat [${str(row['Name'])}]: ${e.message}`); }
        }
      })();
    } catch (e) { errors.push(`Repeat sheet error: ${e.message}`); }
  }

  res.json({
    success: true,
    created,
    sheetsFound,
    sheetsUsed: [ordersSheet, leadsSheet, repeatSheet].filter(Boolean),
    errors: errors.slice(0, 50),
  });
});

module.exports = router;
