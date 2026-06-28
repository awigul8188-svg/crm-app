const BASE = '/api';
function getToken() { return localStorage.getItem('crm_token'); }

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (res.status === 401 && path !== '/auth/login') {
    localStorage.removeItem('crm_token');
    window.location.reload();
    return;
  }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (username, password) => req('POST', '/auth/login', { username, password }),
  me: () => req('GET', '/auth/me'),

  getUsers: () => req('GET', '/users'),
  createUser: (data) => req('POST', '/users', data),
  updateUser: (id, data) => req('PUT', `/users/${id}`, data),
  deleteUser: (id) => req('DELETE', `/users/${id}`),
  resetAePasswords: () => req('POST', '/users/reset-ae-passwords'),
  resetPurchaserPasswords: () => req('POST', '/users/reset-purchaser-passwords'),
  getBuyerCandidates: () => req('GET', '/users/buyer-candidates'),
  createPurchasersFromBuyers: (buyers) => req('POST', '/users/create-from-buyers', { buyers }),

  getCustomers: (search) => req('GET', `/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createCustomer: (data) => req('POST', '/customers', data),
  getCustomer: (id) => req('GET', `/customers/${id}`),
  updateCustomer: (id, data) => req('PUT', `/customers/${id}`, data),
  deleteCustomer: (id) => req('DELETE', `/customers/${id}`),

  getInquiries: (type, filters = {}) => {
    const p = new URLSearchParams();
    if (type) p.set('type', type);
    Object.entries(filters).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length) p.set(k, v.join(','));
      else if (v) p.set(k, v);
    });
    return req('GET', `/inquiries?${p}`);
  },
  getStats: () => req('GET', '/inquiries/stats'),
  createInquiry: (data) => req('POST', '/inquiries', data),
  getInquiry: (id) => req('GET', `/inquiries/${id}`),
  updateInquiry: (id, data) => req('PUT', `/inquiries/${id}`, data),
  deleteInquiry: (id) => req('DELETE', `/inquiries/${id}`),

  addComment: (inquiryId, comment) => req('POST', `/inquiries/${inquiryId}/comments`, { comment }),
  addFollowup: (inquiryId, data) => req('POST', `/inquiries/${inquiryId}/followups`, data),
  updateFollowup: (id, data) => req('PUT', `/inquiries/followups/${id}`, data),
  deleteFollowup: (id) => req('DELETE', `/inquiries/followups/${id}`),

  getAnalytics: (filters = {}) => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length) p.set(k, v.join(','));
      else if (v) p.set(k, v);
    });
    return req('GET', `/analytics?${p}`);
  },

  getNotifications: () => req('GET', '/notifications'),
  markNotificationRead: (id) => req('PATCH', `/notifications/${id}/read`),
  markAllRead: () => req('POST', '/notifications/read-all'),
  completeFollowup: (id) => req('PATCH', `/notifications/followup/${id}/complete`),
};

// Operations (order management) API
export const operationsApi = {
  // Orders
  getOrders: (params = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
    return req('GET', `/operations/orders?${p}`);
  },
  createOrder:    (data) => req('POST', '/operations/orders', data),
  getOrder:       (id)   => req('GET',  `/operations/orders/${id}`),
  updateOrder:    (id, data) => req('PUT', `/operations/orders/${id}`, data),
  deleteOrder:    (id)   => req('DELETE', `/operations/orders/${id}`),

  // Order items
  addItem:        (orderId, data) => req('POST', `/operations/orders/${orderId}/items`, data),
  updateItem:     (id, data) => req('PUT',  `/operations/order-items/${id}`, data),
  deleteItem:     (id)       => req('DELETE', `/operations/order-items/${id}`),

  // Receivables (AR) — open customer balances
  getReceivables: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v !== undefined && v !== ''))).toString()
    return req('GET', `/operations/receivables${q ? '?' + q : ''}`)
  },

  // Payables (AP) — open supplier balances
  getPayables: (params = {}) => {
    const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v !== undefined && v !== ''))).toString()
    return req('GET', `/operations/payables${q ? '?' + q : ''}`)
  },

  // Customer payments (AR receipts) — order.customer_paid is the sum of these
  getPayments:    (orderId) => req('GET', `/operations/orders/${orderId}/payments`),
  addPayment:     (orderId, data) => req('POST', `/operations/orders/${orderId}/payments`, data),
  updatePayment:  (id, data) => req('PUT', `/operations/payments/${id}`, data),
  deletePayment:  (id) => req('DELETE', `/operations/payments/${id}`),

  // Supplier payments (AP disbursements) — item.paid_to_supplier is the sum of these
  getItemPayments:    (itemId) => req('GET', `/operations/order-items/${itemId}/payments`),
  addItemPayment:     (itemId, data) => req('POST', `/operations/order-items/${itemId}/payments`, data),
  updateItemPayment:  (id, data) => req('PUT', `/operations/item-payments/${id}`, data),
  deleteItemPayment:  (id) => req('DELETE', `/operations/item-payments/${id}`),

  // Customers
  getCustomers:   (search) => req('GET', `/operations/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createCustomer: (data)   => req('POST', '/operations/customers', data),
  updateCustomer: (id, data) => req('PUT', `/operations/customers/${id}`, data),
  deleteCustomer: (id)     => req('DELETE', `/operations/customers/${id}`),

  // Buyer / fulfillment (vendor side)
  buyerOrders:    (scope)  => req('GET', `/operations/buyer/orders${scope ? `?scope=${scope}` : ''}`),
  buyerStats:     ()       => req('GET', '/operations/buyer/stats'),
  buyerOrder:     (id)     => req('GET', `/operations/buyer/order/${id}`),
  buyerSaveOrder: (id, data) => req('PATCH', `/operations/buyer/order/${id}`, data),
  buyerSetComplete: (id, complete) => req('POST', `/operations/buyer/order/${id}/complete`, { complete }),
  invoiceData:    (id)     => req('GET', `/operations/order/${id}/invoice`),

  // Suppliers
  getSuppliers:   (search) => req('GET', `/operations/suppliers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createSupplier: (data)   => req('POST', '/operations/suppliers', data),
  updateSupplier: (id, data) => req('PUT', `/operations/suppliers/${id}`, data),
  deleteSupplier: (id)     => req('DELETE', `/operations/suppliers/${id}`),

  // RMA
  getRMA:         (params = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
    return req('GET', `/operations/rma?${p}`);
  },
  createRMA:      (data)   => req('POST', '/operations/rma', data),
  getRMAById:     (id)     => req('GET',  `/operations/rma/${id}`),
  updateRMA:      (id, data) => req('PUT', `/operations/rma/${id}`, data),
  deleteRMA:      (id)     => req('DELETE', `/operations/rma/${id}`),

  // CRM integration
  createFromCRM: (data) => req('POST', '/operations/from-crm', data),
  getPendingOrders: () => req('GET', '/operations/pending'),

  // All items (global view)
  getAllItems: (params = {}) => {
    const p = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v !== undefined && v !== ''))).toString()
    return req('GET', `/operations/items${p ? '?' + p : ''}`)
  },

  // Stats
  getStats: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return req('GET', `/operations/stats${q ? '?' + q : ''}`)
  },

  // Dashboard
  getDashboard: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return req('GET', `/operations/dashboard${q ? '?' + q : ''}`)
  },

  // Reporting periods
  getReportingPeriods: () => req('GET', '/operations/reporting-periods'),

  // Quarter management
  closeQuarter: (period) => req('POST', '/operations/quarters/close', { period }),
  reopenQuarter: (period) => req('DELETE', `/operations/quarters/close/${encodeURIComponent(period)}`),

  // Open month (boundary) management
  getOpenPeriod: () => req('GET', '/operations/open-period'),
  closeMonth: () => req('POST', '/operations/months/close'),
  reopenMonth: (period) => req('POST', '/operations/months/reopen', period ? { period } : {}),

  // Move an order (or selected line items) to the next month
  moveOrderNext: (id) => req('POST', `/operations/orders/${id}/move-next`),
  // items: [{ id, quantity }] — quantity is how many UNITS of that line to move (partial split)
  splitOrderNext: (id, items) => req('POST', `/operations/orders/${id}/split-next`, { items }),
};

export const importApi = {
  importFromSheets: (url, startRow) => fetch('/api/import/operations/from-sheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
    body: JSON.stringify({ url, ...(startRow ? { startRow } : {}) }),
  }).then(r => r.json()),

  clearOperations: () => fetch('/api/import/operations/clear', {
    method: 'DELETE',
    headers: { ...(localStorage.getItem('crm_token') ? { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } : {}) },
  }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Clear failed'); return d; }),

  // Clear all CRM data (leads/repeat/orders + related); user accounts preserved.
  clearCrm: () => fetch('/api/import/clear', {
    method: 'DELETE',
    headers: { ...(localStorage.getItem('crm_token') ? { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } : {}) },
  }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Clear failed'); return d; }),

  importOperations: (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch('/api/import/operations', {
      method: 'POST',
      headers: { ...(localStorage.getItem('crm_token') ? { Authorization: `Bearer ${localStorage.getItem('crm_token')}` } : {}) },
      body: form,
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Import failed');
      return data;
    });
  }
};

// Purchasing-related convenience wrapper
export const purchasingApi = {
  getStats: () => req('GET', '/purchasing/stats'),
  getPurchasers: () => req('GET', '/purchasing/purchasers'),
  getInquiryParts: (inquiryId) => req('GET', `/purchasing/inquiry-parts/${inquiryId}`),
  assignBulk: (data) => req('POST', '/purchasing/assign-bulk', data),
  assign: (data) => req('POST', '/purchasing/assign', data),
  unassign: (requirementId) => req('DELETE', `/purchasing/assign/${requirementId}`),
  resetPurchaserPasswords: () => req('POST', '/users/reset-purchaser-passwords'),
  getParts: (params = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length) p.set(k, v.join(','));
      else if (v || v === 0) p.set(k, v);
    });
    return req('GET', `/purchasing/parts?${p}`);
  },
  getMyParts: (params = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length) p.set(k, v.join(','));
      else if (v || v === 0) p.set(k, v);
    });
    return req('GET', `/purchasing/my-parts?${p}`);
  },
  getQuotes: (params = {}) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length) p.set(k, v.join(','));
      else if (v || v === 0) p.set(k, v);
    });
    return req('GET', `/purchasing/quotes?${p}`);
  },
  submitQuote: (data) => req('POST', '/purchasing/quote', data),
  getSuppliers: (search) => req('GET', `/purchasing/suppliers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createSupplier: (data) => req('POST', '/purchasing/suppliers', data),
};

export const assistantApi = {
  status: () => req('GET', '/assistant/status'),
  ask: (messages) => req('POST', '/assistant/ask', { messages }),
};

export const quotesApi = {
  nextNumber: () => req('GET', '/quotes/next-number'),
  record: (data) => req('POST', '/quotes', data),
};

export const invoicesApi = {
  nextNumber: () => req('GET', '/invoices/next-number'),
  record: (data) => req('POST', '/invoices', data),
};
