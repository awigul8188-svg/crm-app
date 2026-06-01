// Role-based access control helpers
// Import this wherever you need role checks

export const ROLES = {
  MANAGER: 'manager',
  PM: 'purchasing_manager',
  AE: 'ae',
  PURCHASER: 'purchaser',
}

export const can = {
  // Page access
  viewLeads:      (u) => ['manager','ae'].includes(u?.role),
  viewCustomers:  (u) => ['manager','ae'].includes(u?.role),
  viewAnalytics:  (u) => ['manager','ae'].includes(u?.role),
  viewPurchasing: (u) => ['manager','purchasing_manager','purchaser'].includes(u?.role),
  viewUsers:      (u) => ['manager','purchasing_manager'].includes(u?.role),
  viewImport:     (u) => ['manager'].includes(u?.role),
  viewNotifications:(u) => true, // all roles, but filtered by backend

  // Data visibility
  seeCompanyName: (u) => u?.role !== 'purchaser',
  seeAllAEs:      (u) => u?.role === 'manager',
  seeOwnDataOnly: (u) => u?.role === 'ae',

  // Actions
  deleteInquiry:  (u) => u?.role === 'manager',
  assignParts:    (u) => ['manager','purchasing_manager'].includes(u?.role),
  setTargets:     (u) => u?.role === 'manager',
  addUsers:       (u) => ['manager','purchasing_manager'].includes(u?.role),
  reassignInquiry:(u) => u?.role === 'manager',
}

// Which page to land on after login
export function defaultPage(user) {
  switch(user?.role) {
    case 'manager':            return 'dashboard';
    case 'purchasing_manager': return 'purchasing';
    case 'ae':                 return 'ae-dashboard';
    case 'purchaser':          return 'purchaser-dashboard';
    default:                   return 'dashboard';
  }
}

// Sidebar nav items per role
export function navItems(user) {
  const role = user?.role;
  const items = [];

  if (role === 'manager') {
    items.push(
      { key:'dashboard',         label:'Dashboard',        icon:'grid' },
      { key:'leads',             label:'Leads',            icon:'target' },
      { key:'repeat',            label:'Repeat',           label2:'Inquiries', icon:'refresh' },
      { key:'orders',            label:'Orders',           icon:'shopping' },
      { key:'customers',         label:'Customers',        icon:'users' },
      { key:'notifications',     label:'Notifications',    icon:'bell' },
    );
    items.push({ section: 'ADMIN' });
    items.push(
      { key:'import',            label:'Import Data',      icon:'upload' },
      { key:'users',             label:'Users',            icon:'user-cog' },
      { key:'purchasing',        label:'Purchasing',       icon:'package' },
    );
  }
  else if (role === 'purchasing_manager') {
    items.push(
      { key:'purchasing',        label:'Purchasing',       icon:'package' },
      { key:'leads',             label:'Leads',            icon:'target' },
      { key:'repeat',            label:'Repeat',           icon:'refresh' },
      { key:'orders',            label:'Orders',           icon:'shopping' },
      { key:'customers',         label:'Customers',        icon:'users' },
      { key:'notifications',     label:'Notifications',    icon:'bell' },
    );
    items.push({ section: 'ADMIN' });
    items.push(
      { key:'users',             label:'Users',            icon:'user-cog' },
    );
  }
  else if (role === 'ae') {
    items.push(
      { key:'ae-dashboard',      label:'Dashboard',        icon:'grid' },
      { key:'leads',             label:'Leads',            icon:'target' },
      { key:'repeat',            label:'Repeat',           icon:'refresh' },
      { key:'orders',            label:'Orders',           icon:'shopping' },
      { key:'customers',         label:'Customers',        icon:'users' },
      { key:'notifications',     label:'Notifications',    icon:'bell' },
    );
  }
  else if (role === 'purchaser') {
    items.push(
      { key:'purchaser-dashboard', label:'Dashboard',      icon:'grid' },
      { key:'purchasing',          label:'My Parts',       icon:'package' },
      { key:'notifications',       label:'Notifications',  icon:'bell' },
    );
  }

  return items;
}
