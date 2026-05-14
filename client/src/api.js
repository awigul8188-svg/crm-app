const BASE = '/api';

function getToken() { return localStorage.getItem('crm_token'); }

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (username, password) => req('POST', '/auth/login', { username, password }),
  me: () => req('GET', '/auth/me'),

  // Users
  getUsers: () => req('GET', '/users'),
  createUser: (data) => req('POST', '/users', data),
  updateUser: (id, data) => req('PUT', `/users/${id}`, data),
  deleteUser: (id) => req('DELETE', `/users/${id}`),

  // Customers
  getCustomers: (search) => req('GET', `/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createCustomer: (data) => req('POST', '/customers', data),
  getCustomer: (id) => req('GET', `/customers/${id}`),
  updateCustomer: (id, data) => req('PUT', `/customers/${id}`, data),
  deleteCustomer: (id) => req('DELETE', `/customers/${id}`),

  // Inquiries - filters support arrays (will join as comma-separated)
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

  // Comments & followups
  addComment: (inquiryId, comment) => req('POST', `/inquiries/${inquiryId}/comments`, { comment }),
  addFollowup: (inquiryId, data) => req('POST', `/inquiries/${inquiryId}/followups`, data),
  updateFollowup: (id, data) => req('PUT', `/inquiries/followups/${id}`, data),
  deleteFollowup: (id) => req('DELETE', `/inquiries/followups/${id}`),

  // Analytics - supports array filters
  getAnalytics: (filters = {}) => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (Array.isArray(v) && v.length) p.set(k, v.join(','));
      else if (v) p.set(k, v);
    });
    return req('GET', `/analytics?${p}`);
  },
};
