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

  // Customers
  getCustomers:   (search) => req('GET', `/operations/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createCustomer: (data)   => req('POST', '/operations/customers', data),
  updateCustomer: (id, data) => req('PUT', `/operations/customers/${id}`, data),
  deleteCustomer: (id)     => req('DELETE', `/operations/customers/${id}`),

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
  getStats: () => req('GET', '/operations/stats'),

  // Dashboard
  getDashboard: () => req('GET', '/operations/dashboard'),
};

export const importApi = {
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
  getInquiryParts: (inquiryId) => req('GET', `/purchasing/inquiry/${inquiryId}`),
  assignBulk: (data) => req('POST', '/purchasing/assign-bulk', data),
  assign: (data) => req('POST', '/purchasing/assign', data),
  unassign: (requirementId) => req('DELETE', `/purchasing/assign/${requirementId}`),
  resetPurchaserPasswords: () => req('POST', '/purchasing/reset-purchaser-passwords'),
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
};
