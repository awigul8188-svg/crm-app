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

  // ── Online Orders ────────────────────────────────────────────────────────
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

  // ── New Leads ────────────────────────────────────────────────────────────
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

  // ── Repeat Inquiries ─────────────────────────────────────────────────────
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

// ── Operations Import ─────────────────────────────────────────────────────────
const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

function parseDollar(s) {
  if (typeof s === 'number') return s;
  if (!s && s !== 0) return 0;
  const n = parseFloat(String(s).replace(/[$,\s]/g,''));
  return isNaN(n) ? 0 : n;
}

// Any "TA##### - <text>" pattern is an adjustment/variant of the parent order
function isAdjustmentOrder(orderNum) {
  return /^TA\d+\s*[-–]\s*.+/i.test(String(orderNum).trim());
}

// "TA001475 - Remaining qty" → "TA001475"
// "TA001388 - Shipping adjustment" → "TA001388"
function parentOrderNum(orderNum) {
  return String(orderNum).replace(/\s*[-–]\s*.+$/i, '').trim();
}

function parseDate(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  // JS Date object — from cellDates:true on xlsx files
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Excel serial number (number, not yet converted to Date)
  if (typeof raw === 'number' && raw > 40000 && raw < 60000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const s = String(raw).trim();
  if (!s) return null;

  // M/D/YYYY  e.g. 1/24/2024
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) return `${us[3]}-${String(parseInt(us[1])).padStart(2,'0')}-${String(parseInt(us[2])).padStart(2,'0')}`;

  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return null;
}

// AR status from col G (Payment Status)
// returns: 'received' | 'pending' | 'partial' | 'na'
function classifyAR(raw) {
  if (!raw) return 'na';
  const s = String(raw).toLowerCase().trim();
  if (!s || s === 'na' || s === 'stock' || s === 'foc' || s === 'sample' || s === 'rma') return 'na';
  const hasReceived = /received|charged|deposited|credit note|released/i.test(s);
  const hasPending  = /^net[\s-]?\d|waiting|pending|not yet|in process|never paid/i.test(s);
  if (hasReceived && hasPending) return 'partial'; // e.g. "50% received - rest on Net 1"
  if (hasReceived) return 'received';
  if (/paypal|^pp$|^pp |cheque|check|^wire$|refund/i.test(s)) return 'received';
  if (hasPending) return 'pending';
  return 'na';
}

// AP status from col N (Paid to vendor) — raw text, not dollar amount
// returns: 'paid' | 'pending' | 'partial' | 'na'
function classifyAP(raw) {
  if (!raw) return 'na';
  const s = String(raw).toLowerCase().trim();
  if (!s || s === 'na' || s === 'stock') return 'na';
  // Immediate payment methods by themselves = paid
  if (/^(dc|pp|wire|cc|paypal|cash|zelle|bank|ebay|alibaba|gift card|dc&cc|paypal&|pp &|wire to|wire sent|full wire|100% wire)/.test(s)) return 'paid';
  // Any "paid" or "wire paid/sent" in the text = paid
  const hasPaid = /\bpaid\b|wire paid|wire sent|fully paid/i.test(s);
  // Still has remaining portion
  const hasRemain = /remain|30%\s*net|30% on net|\d+%\s*net\s*\d/i.test(s);
  if (hasPaid && hasRemain) return 'partial';
  if (hasPaid) return 'paid';
  // Just payment terms without confirmation = pending
  if (/^net[\s-]?\d|^\d+%\s*prepaid/i.test(s)) return 'pending';
  return 'na';
}

function mapPaymentOps(raw) {
  if (!raw || String(raw).trim() === 'NA' || String(raw).trim() === '') return '';
  const r = String(raw).toLowerCase().trim();
  if (r === 'charged' || r === 'charged cc' || r === 'charged wire' || r === 'cc charged' || r.startsWith('cc charged')) return 'CC Charged';
  if (r.startsWith('charged')) return 'CC Charged';
  if (r === 'wire received' || r === 'wire recived' || r === 'received' || r === 'wire charged' || r === 'wire') return 'Wire Received';
  if (r.includes('wire received')) return 'Wire Received';
  if (r === 'net-30' || r === 'net 30' || r.startsWith('net-30') || r.startsWith('net 30') || r === 'net30-cc charged') return 'Net 30';
  if (r === 'net-15' || r === 'net 15' || r.startsWith('net-15') || r.startsWith('net 15')) return 'Net 15';
  if (r === 'net-10' || r === 'net 10' || r.startsWith('net-10') || r.startsWith('net 10') || r.startsWith('net10')) return 'Net 10';
  if (r === 'net-7' || r === 'net 7' || r.startsWith('net-7') || r.startsWith('net 7')) return 'Net 7';
  if (r.includes('paypal') || r.includes('pp received') || r === 'pp charged') return 'PayPal Received';
  if (r.includes('check') || r.includes('cheque')) return 'Check Received';
  return String(raw).trim();
}

function mapStatusOps(raw) {
  if (!raw) return 'Order placed';
  const map = {
    'Delivered':'Delivered','Shipped to customer':'Shipped to customer',
    'Order placed':'Order placed','In Process':'In Process',
    'Shipped to US':'Shipped to US','Received in US':'Received in US',
    'Refunded':'Delivered','refunded':'Delivered',
  };
  return map[String(raw).trim()] || String(raw).trim() || 'Order placed';
}

function syncRmaAmount(db, orderId) {
  if (!orderId) return;
  const res = db.prepare(`
    SELECT COALESCE(SUM(COALESCE(r.return_quantity,1)*COALESCE(i.selling,0)),0) AS total
    FROM op_rma r LEFT JOIN op_order_items i ON r.order_item_id=i.id WHERE r.order_id=?
  `).get(orderId);
  db.prepare(`UPDATE op_orders SET rma_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(res.total, orderId);
}

router.delete('/operations/clear', (req, res) => {
  try {
    const db = getDB();
    db.transaction(() => {
      db.exec(`DELETE FROM op_rma`);
      db.exec(`DELETE FROM op_order_items`);
      db.exec(`DELETE FROM op_orders WHERE pending IS NULL OR pending = 0`);
      db.exec(`DELETE FROM op_customers`);
      db.exec(`DELETE FROM op_suppliers`);
    })();
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

function importWorkbook(wb, db) {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

    const stats = { orders: 0, items: 0, customers: 0, suppliers: 0, rmas: 0, skipped: 0, errors: [] };
    const custCache = {}, supCache = {};

    const existingOrders = new Set(
      db.prepare(`SELECT order_number FROM op_orders`).all().map(o => String(o.order_number).trim())
    );

    let currentOrder = null;
    let currentOrderId = null;
    let rmaBuffer = [];
    let currentOrderDate = null;
    let currentCustomerId = null;
    let rmaIndex = 0;
    let currentReportingPeriod = null; // set when a "Q{n}-{yr} Total" marker is seen

    const importOrder = db.transaction(() => {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // col() stringifies for text fields; dateVal() passes raw value to parseDate
        const col = (n) => String(row[n-1] ?? '').trim();
        const rawDateVal = row[0]; // may be Date object, number, or string
        const rawDateStr = col(1); // stringified for skip checks
        const rawOrder = col(3);

        // Detect quarter-total markers to track reporting period
        // e.g. "Q1 Total" → next section is Q2; "Q1-26 Total" → next section is Q2-26
        const qtMatch = rawDateStr.match(/^Q(\d)(?:-(\d{2}))?\s+Total$/i);
        if (qtMatch) {
          const qNum = parseInt(qtMatch[1]);
          const yr   = qtMatch[2] ? parseInt(qtMatch[2]) : null;
          if (qNum < 4) {
            currentReportingPeriod = `Q${qNum + 1}${yr !== null ? '-' + String(yr) : ''}`;
          } else {
            currentReportingPeriod = `Q1${yr !== null ? '-' + String(yr + 1) : ''}`;
          }
          continue;
        }

        // Skip month header rows and fully empty rows
        if (/^(January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(rawDateStr)) continue;
        if (!rawDateStr && !rawOrder && !col(10) && !col(4)) continue;

        // A row starts a new order when col 1 has a parseable date
        const parsedRowDate = parseDate(rawDateVal);
        const isNewOrder = parsedRowDate !== null;
        const status = col(8);
        const isRefunded = status.toLowerCase() === 'refunded';

        if (isNewOrder && rawOrder !== '') {
          // Flush RMAs for previous order
          if (currentOrderId && rmaBuffer.length) {
            for (const rmaRow of rmaBuffer) {
              try {
                const linkedItem = db.prepare(`SELECT id FROM op_order_items WHERE order_id=? AND part_number=? LIMIT 1`)
                  .get(currentOrderId, rmaRow.partNumber);
                db.prepare(`
                  INSERT INTO op_rma (rma_number,order_id,order_item_id,customer_id,return_quantity,
                    return_reason,rma_status,rma_issue_date,refund_issued)
                  VALUES (?,?,?,?,?,?,?,?,?)
                `).run(
                  `RMA-${currentOrder}-${++rmaIndex}`,
                  currentOrderId, linkedItem ? linkedItem.id : null, currentCustomerId,
                  rmaRow.qty, rmaRow.remarks || null, 'Completed',
                  currentOrderDate, rmaRow.refundAmount
                );
                stats.rmas++;
              } catch(e) { stats.errors.push(`RMA error row ${i}: ${e.message}`); }
            }
            syncRmaAmount(db, currentOrderId);
            rmaBuffer = [];
          }

          const orderNum = rawOrder;
          const isAdj = isAdjustmentOrder(orderNum);
          const orderDate = parsedRowDate;

          if (isAdj) {
            // Route items to parent order — do NOT create a new order
            const parent = parentOrderNum(orderNum);
            const parentRow = db.prepare(`SELECT id, customer_id FROM op_orders WHERE order_number=? LIMIT 1`).get(parent);
            if (parentRow) {
              currentOrderId = parentRow.id;
              currentOrder = parent;
              currentCustomerId = parentRow.customer_id;
              currentOrderDate = orderDate;
              rmaIndex = 0;
            } else {
              stats.errors.push(`Adjustment row ${i}: parent order "${parent}" not found, skipping items`);
              currentOrderId = null; currentOrder = null;
            }
            // Skip order creation — fall through to item processing below
          } else {
            if (existingOrders.has(orderNum)) { stats.skipped++; currentOrderId = null; currentOrder = null; continue; }
            existingOrders.add(orderNum);

            let custId = null;
            const custName = col(4);
            if (custName) {
              const key = custName.toLowerCase();
              if (custCache[key]) {
                custId = custCache[key];
              } else {
                const existing = db.prepare(`SELECT id FROM op_customers WHERE LOWER(name)=LOWER(?)`).get(custName);
                if (existing) { custId = existing.id; }
                else {
                  const r = db.prepare(`INSERT INTO op_customers (name) VALUES (?)`).run(custName);
                  custId = r.lastInsertRowid; stats.customers++;
                }
                custCache[key] = custId;
              }
            }

            const orderStatus = mapStatusOps(isRefunded ? 'Delivered' : status);

            try {
              const rawPayment = col(7);
              const result = db.prepare(`
                INSERT INTO op_orders (order_number,order_date,customer_id,lead_source,rep,buyer,
                  payment_status,order_status,tax_charged,shipping_charged,tracking_to_customer,notes,email,
                  reporting_period,ar_status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              `).run(
                orderNum, orderDate, custId, col(2)||null, col(5)||null, col(6)||null,
                mapPaymentOps(rawPayment)||null, orderStatus,
                parseDollar(col(23))||0, parseDollar(col(22))||0,
                col(28)||null, col(30)||null, null,
                currentReportingPeriod,
                classifyAR(rawPayment)
              );
              currentOrderId = result.lastInsertRowid;
              currentOrder = orderNum;
              currentOrderDate = orderDate;
              currentCustomerId = custId;
              rmaIndex = 0;
              stats.orders++;
            } catch(e) {
              stats.errors.push(`Order ${orderNum} row ${i}: ${e.message}`);
              currentOrderId = null; currentOrder = null;
              continue;
            }
          }
        }

        if (!currentOrderId) continue;

        const partNum = col(10);
        if (!partNum && !col(15)) continue;

        let supId = null;
        const supName = col(15);
        if (supName) {
          const key = supName.toLowerCase();
          if (supCache[key]) { supId = supCache[key]; }
          else {
            const existing = db.prepare(`SELECT id FROM op_suppliers WHERE LOWER(company)=LOWER(?)`).get(supName);
            if (existing) { supId = existing.id; }
            else {
              const r = db.prepare(`INSERT INTO op_suppliers (company) VALUES (?)`).run(supName);
              supId = r.lastInsertRowid; stats.suppliers++;
            }
            supCache[key] = supId;
          }
        }

        if (isRefunded) {
          const selling = parseDollar(col(21));
          const cost = parseDollar(col(16));
          const refundAmt = selling !== 0 ? Math.abs(selling) : Math.abs(cost);
          rmaBuffer.push({ partNumber: partNum, qty: parseInt(col(11))||1, remarks: col(30), refundAmount: refundAmt });
          continue;
        }

        // Skip items where Total Selling (col25) is blank/zero but a unit price exists —
        // these are On Hold / Cancelled / unfinalized rows that haven't been invoiced yet.
        const totalSelling = parseDollar(col(25));
        const unitSelling  = parseDollar(col(21));
        if (totalSelling === 0 && unitSelling > 0) continue;

        try {
          const rawVendorPayment = col(14);
          db.prepare(`
            INSERT INTO op_order_items (order_id,part_number,description,product,supplier_id,quantity,
              product_condition,selling,buying,cc_paid,tax_paid,shipping_paid,duty_paid,paid_to_supplier,
              tracking_to_warehouse,ta_po_number,serials,ap_status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            currentOrderId, partNum||null, null, col(9)||null, supId,
            parseInt(col(11))||1, col(12)||null,
            parseDollar(col(21)), parseDollar(col(16)),
            parseDollar(col(20)), parseDollar(col(19)), parseDollar(col(18)),
            0, parseDollar(rawVendorPayment),
            col(27)||null, col(13)||null, col(29)||null,
            classifyAP(rawVendorPayment)
          );
          stats.items++;
        } catch(e) { stats.errors.push(`Item row ${i}: ${e.message}`); }
      }

      // Flush final order's RMAs
      if (currentOrderId && rmaBuffer.length) {
        for (const rmaRow of rmaBuffer) {
          try {
            const linkedItem = db.prepare(`SELECT id FROM op_order_items WHERE order_id=? AND part_number=? LIMIT 1`)
              .get(currentOrderId, rmaRow.partNumber);
            db.prepare(`
              INSERT INTO op_rma (rma_number,order_id,order_item_id,customer_id,return_quantity,
                return_reason,rma_status,rma_issue_date,refund_issued)
              VALUES (?,?,?,?,?,?,?,?,?)
            `).run(
              `RMA-${currentOrder}-${++rmaIndex}`,
              currentOrderId, linkedItem ? linkedItem.id : null, currentCustomerId,
              rmaRow.qty, rmaRow.remarks||null, 'Completed',
              currentOrderDate, rmaRow.refundAmount
            );
            stats.rmas++;
          } catch(e) { stats.errors.push(`RMA error final: ${e.message}`); }
        }
        syncRmaAmount(db, currentOrderId);
      }
    });

    importOrder();
    return stats;
}

router.post('/operations', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const db = getDB();
    const isCsv = (req.file.originalname || '').toLowerCase().endsWith('.csv');
    let wb;
    if (isCsv) {
      const csvStr = req.file.buffer.toString('utf8').replace(/^﻿/, '');
      wb = XLSX.read(csvStr, { type: 'string' });
    } else {
      wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    }
    const stats = importWorkbook(wb, db);
    res.json({ ok: true, stats });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/operations/from-sheets', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  // Extract sheet ID from any Google Sheets URL format
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return res.status(400).json({ error: 'Invalid Google Sheets URL' });
  const sheetId = match[1];

  const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;

  try {
    const response = await fetch(exportUrl);
    if (!response.ok) {
      throw new Error(`Google returned HTTP ${response.status}. Make sure the sheet is shared as "Anyone with the link can view".`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const db = getDB();
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const stats = importWorkbook(wb, db);
    res.json({ ok: true, stats });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;