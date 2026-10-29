// Operation-Based Access Control (RBAC) Matrix Configuration & Registry

export const PERMISSION_MATRIX_COLS = [
  { key: 'create', label: 'Create', short: '+', hint: 'Fill and create new transactions/records' },
  { key: 'read', label: 'Read', short: '👁', hint: 'View directories and detail profiles' },
  { key: 'update', label: 'Edit', short: '✎', hint: 'Modify existing records' },
  { key: 'delete', label: 'Void', short: '🗑', hint: 'Delete or void records (Protected)' },
];

export const MINIMIZED_MATRIX_CATEGORIES = {
  trade: {
    id: 'trade',
    label: 'Trade & Commercial Forms',
    description: 'Sell RFQs, Quotations, Received Quotes, PO, Delivery Notes & Invoices',
    icon: 'TrendingUp',
    color: 'emerald'
  },
  contracts: {
    id: 'contracts',
    label: 'Contracts & Specialized Orders',
    description: 'Release Orders, Buy Contracts, Process Orders & ARC Rate Agreements',
    icon: 'FileSignature',
    color: 'indigo'
  },
  inventory_mfg: {
    id: 'inventory_mfg',
    label: 'Inventory & Manufacturing',
    description: 'Warehouse stock balances and factory manufacture job orders',
    icon: 'Warehouse',
    color: 'amber'
  },
  masters: {
    id: 'masters',
    label: 'Master Catalogs & Directories',
    description: 'Catalog items, party customers/vendors, buyer contacts & GST rates',
    icon: 'Package',
    color: 'blue'
  },
  system: {
    id: 'system',
    label: 'System, HR & Administration',
    description: 'User access accounts, database backup snapshots & server monitor',
    icon: 'ShieldAlert',
    color: 'pink'
  }
};

export const PERMISSION_MATRIX_ROWS = [
  // ── Trade & Commercial Forms (category: 'trade') ──
  { key: 'sell_rfq', label: 'Sell RFQ', category: 'trade', path: '/addRfq', legacyModule: 'manage_rfqs' },
  { key: 'sell_quotation', label: 'Sell Quotation', category: 'trade', path: '/addQuotation', legacyModule: 'manage_quotations' },
  { key: 'buy_rq', label: 'Buy Received Quotation (RQ)', category: 'trade', path: '/addReceivedQuotation', legacyModule: 'manage_quotations' },
  { key: 'sell_po', label: 'Sell Purchase Order (PO)', category: 'trade', path: '/addPurchaseOrder', legacyModule: 'manage_orders' },
  { key: 'delivery_note', label: 'Delivery Note', category: 'trade', path: '/addDeliveryNote', legacyModule: 'manage_orders' },
  { key: 'invoice', label: 'Invoice', category: 'trade', path: '/addInvoice', legacyModule: 'manage_orders' },

  // ── Contracts & Specialized Orders (category: 'contracts') ──
  { key: 'ro', label: 'Release Order (RO)', category: 'contracts', path: '/addReleaseOrder', legacyModule: 'manage_orders' },
  { key: 'buy_contract_order', label: 'Buy Contract Order', category: 'contracts', path: '/addContractOrder', legacyModule: 'manage_orders' },
  { key: 'process_rq', label: 'Buy Process Received Quotation', category: 'contracts', path: '/addProcessReceivedQuotation', legacyModule: 'manage_manufacture' },
  { key: 'process_order', label: 'Buy Process Contract Order', category: 'contracts', path: '/addProcessContractOrder', legacyModule: 'manage_manufacture' },
  { key: 'arc', label: 'ARC Contracts', category: 'contracts', path: '/arc', legacyModule: 'manage_arc', restrictDelete: true },

  // ── Inventory & Manufacturing (category: 'inventory_mfg') ──
  { key: 'inventory', label: 'Inventory Stock', category: 'inventory_mfg', path: '/inventory', legacyModule: 'manage_inventory' },
  { key: 'manufacture', label: 'Manufacture Jobs & Production', category: 'inventory_mfg', path: '/manufactures', legacyModule: 'manage_manufacture' },

  // ── Master Catalogs & Directories (category: 'masters') ──
  { key: 'items', label: 'Catalog Items & SKUs', category: 'masters', path: '/item', legacyModule: 'manage_items' },
  { key: 'parties', label: 'Parties (Customers & Vendors)', category: 'masters', path: '/party', legacyModule: 'manage_parties' },
  { key: 'contacts', label: 'Contacts (Buyers & Reps)', category: 'masters', path: '/buyer', legacyModule: 'manage_contacts' },
  { key: 'gst', label: 'GST Categories', category: 'masters', path: '/gst-category', legacyModule: 'manage_gst' },

  // ── System, HR & Administration (category: 'system') ──
  { key: 'users', label: 'User Accounts (HR)', category: 'system', path: '/users', legacyModule: 'manage_users' },
  { key: 'backup', label: 'Database Backup & Sync', category: 'system', path: '/backup', legacyModule: 'manage_backup' },
  { key: 'monitor', label: 'Server & PM2 Monitor', category: 'system', path: '/monitor', legacyModule: 'manage_monitor' },
];

// Special privacy and granular capabilities outside standard roles
export const SPECIAL_CAPABILITIES = [
  {
    key: 'pricing:view',
    label: 'View Pricing & Financials',
    category: 'financial',
    description: 'View unmasked unit prices, basic values, margins, and financial figures'
  },
  {
    key: 'items:quote_history',
    label: 'Item Code Quote History',
    category: 'masters',
    description: 'View past quote prices and customer price histories in forms'
  },
  {
    key: 'inventory:trace_history',
    label: 'Inventory Trace History',
    category: 'inventory',
    description: 'Inspect full lifecycle trace history and item lineage trees'
  }
];

// 10 Operational Role Presets for 1-Click Assignment & Composition
export const ROLE_PRESETS = {
  boss: {
    key: 'boss',
    label: 'Boss / Administrator',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Unrestricted full access across all operations, pricing, and system settings',
    role: 'admin',
    permissions: ['*']
  },
  inventory_manager: {
    key: 'inventory_manager',
    label: 'Inventory Manager',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Manage inventory stock and item catalog (Trace history denied)',
    role: 'operator',
    permissions: [
      'inventory:read',
      'inventory:create',
      'inventory:update',
      'items:read',
      'items:create',
      'items:update'
    ]
  },
  data_feeder: {
    key: 'data_feeder',
    label: 'Data Feeder',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    description: 'Fill all operational forms (Sell RFQ, Quotation, PO, RO, Buy RQ, Contract Order, Process RQ/Order, Delivery Note, Invoice) & manage master directories',
    role: 'operator',
    permissions: [
      'view_dashboard',
      // Sell Operations
      'sell_rfq:create',
      'sell_rfq:read',
      'sell_rfq:update',
      'sell_quotation:create',
      'sell_quotation:read',
      'sell_quotation:update',
      'sell_po:create',
      'sell_po:read',
      'sell_po:update',
      'ro:create',
      'ro:read',
      'ro:update',
      'delivery_note:create',
      'delivery_note:read',
      'delivery_note:update',
      'invoice:create',
      'invoice:read',
      'invoice:update',

      // Buy Operations
      'buy_rq:create',
      'buy_rq:read',
      'buy_rq:update',
      'buy_contract_order:create',
      'buy_contract_order:read',
      'buy_contract_order:update',

      // Buy Process Operations
      'process_rq:create',
      'process_rq:read',
      'process_rq:update',
      'process_order:create',
      'process_order:read',
      'process_order:update',

      // Master Catalogs & Lookups
      'items:read',
      'items:create',
      'items:update',
      'parties:read',
      'parties:create',
      'parties:update',
      'contacts:read',
      'contacts:create',
      'contacts:update',
      'gst:read'
    ]
  },
  manufacture_manager: {
    key: 'manufacture_manager',
    label: 'Manufacture Manager',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Manage manufacture jobs & production, item catalog, and inventory stock only',
    role: 'operator',
    permissions: [
      'manufacture:read',
      'manufacture:create',
      'manufacture:update',
      'items:read',
      'inventory:read',
      'inventory:create',
      'inventory:update'
    ]
  },
  order_manager: {
    key: 'order_manager',
    label: 'Order Manager',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'Dedicated access to Order Page (/order) and commercial order management',
    role: 'operator',
    permissions: [
      'orders:view_page',
      'manage_orders',
      'sell_po:read',
      'ro:read',
      'delivery_note:read',
      'invoice:read',
      'buy_contract_order:read',
      'process_order:read',
      'items:read',
      'parties:read',
      'contacts:read'
    ]
  },
  contract_manager: {
    key: 'contract_manager',
    label: 'Contract Manager',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    description: 'Manage ARC rate contracts (/arc, /arc/form), add/edit contracts & items, and access item/party/contact lookups (Delete is Boss only)',
    role: 'operator',
    permissions: [
      'arc:read',
      'arc:create',
      'arc:update',
      'arc:page_access',
      'items:read',
      'items:create',
      'items:update',
      'parties:read',
      'parties:create',
      'parties:update',
      'contacts:read',
      'contacts:create',
      'contacts:update'
    ]
  },
  only_contract_forms: {
    key: 'only_contract_forms',
    label: 'Only Contract Form',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    description: 'Form filling for Release Order (RO), Buy Contract Order, and Buy Process Contract Order',
    role: 'operator',
    permissions: [
      'ro:create',
      'ro:read',
      'ro:update',
      'buy_contract_order:create',
      'buy_contract_order:read',
      'buy_contract_order:update',
      'process_order:create',
      'process_order:read',
      'process_order:update',
      'items:read',
      'parties:read',
      'contacts:read'
    ]
  },
  hr_manager: {
    key: 'hr_manager',
    label: 'HR & People Operations',
    badgeClass: 'bg-pink-100 text-pink-800 border-pink-300',
    description: 'Manage user accounts, add/enroll operators, and configure role assignments only',
    role: 'operator',
    permissions: [
      'manage_users',
      'users:read',
      'users:create',
      'users:update'
    ]
  },
  system_admin: {
    key: 'system_admin',
    label: 'Server & Backup Manager',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    description: 'Database backup snapshots, cloud sync, PM2 server monitoring, and service restart',
    role: 'operator',
    permissions: [
      'manage_backup',
      'manage_monitor',
      'backup:read',
      'backup:create',
      'backup:manage',
      'monitor:view',
      'monitor:read',
      'monitor:manage'
    ]
  },
  view_trade: {
    key: 'view_trade',
    label: 'View Trade',
    badgeClass: 'bg-slate-200 text-slate-800 border-slate-400',
    description: 'Dashboard access to view company-wide trades directory and search across all trades',
    role: 'operator',
    permissions: [
      'view_dashboard',
      'trades:view_all',
      'trades:search'
    ]
  }
};

// Backwards-compatibility alias: stock_manager -> inventory_manager
ROLE_PRESETS.stock_manager = ROLE_PRESETS.inventory_manager;

const LEGACY_MODULE_PREFIXES = {
  manage_rfqs: ['sell_rfq:'],
  manage_quotations: ['sell_quotation:', 'buy_rq:'],
  manage_orders: ['sell_po:', 'ro:', 'buy_contract_order:', 'delivery_note:', 'invoice:', 'orders:'],
  manage_manufacture: ['process_rq:', 'process_order:', 'manufacture:'],
  manage_inventory: ['inventory:'],
  manage_items: ['items:'],
  manage_parties: ['parties:'],
  manage_contacts: ['contacts:'],
  manage_arc: ['arc:'],
  manage_gst: ['gst:'],
  manage_users: ['users:'],
  manage_backup: ['backup:'],
  manage_monitor: ['monitor:']
};

/**
 * Detect assigned operational roles from user permissions and role.
 */
export function detectAssignedRoles(perms, role) {
  const r = (role || '').toLowerCase();
  const list = Array.isArray(perms) ? perms : [];

  if (r === 'admin' || r === 'owner' || list.includes('*') || list.includes('role:boss')) {
    return ['boss'];
  }

  const assigned = [];
  const candidateKeys = [
    'inventory_manager',
    'data_feeder',
    'manufacture_manager',
    'order_manager',
    'contract_manager',
    'only_contract_forms',
    'hr_manager',
    'system_admin',
    'view_trade'
  ];

  candidateKeys.forEach((roleKey) => {
    // 1. Explicit role tag
    if (list.includes(`role:${roleKey}`) || (roleKey === 'inventory_manager' && list.includes('role:stock_manager'))) {
      assigned.push(roleKey);
      return;
    }

    // 2. Preset subset matching
    const preset = ROLE_PRESETS[roleKey];
    if (preset && preset.permissions.length > 0) {
      const allPresent = preset.permissions.every((p) => {
        if (p === 'orders:view_page') return list.includes('orders:view_page') || list.includes('manage_orders');
        if (p === 'arc:page_access') return list.includes('arc:page_access') || (list.includes('arc:read') && list.includes('arc:create'));
        return list.includes(p);
      });
      if (allPresent) {
        assigned.push(roleKey);
      }
    }
  });

  return Array.from(new Set(assigned));
}

/**
 * Check if a user has a specific permission.
 */
export function hasPermission(user, permissionKey) {
  if (!user) return false;

  const role = (user.role || '').toLowerCase();
  if (role === 'admin' || role === 'owner' || role === 'boss') {
    return true;
  }

  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes('*')) {
    return true;
  }

  if (!permissionKey) return true;

  const checkSingle = (key) => {
    if (!key) return true;

    // 1. Direct match
    if (perms.includes(key)) return true;

    // 2. Wildcard check: e.g. user has 'inventory:*' and we check 'inventory:read'
    const parts = key.split(':');
    if (parts.length === 2) {
      if (perms.includes(`${parts[0]}:*`)) return true;
    }

    // 3. Legacy module mappings (legacy module granted -> granular satisfied)
    for (const [legacyMod, prefixes] of Object.entries(LEGACY_MODULE_PREFIXES)) {
      if (perms.includes(legacyMod)) {
        if (prefixes.some(prefix => key.startsWith(prefix))) {
          return true;
        }
      }
    }

    // 4. Checking legacy module key when user has granular permissions
    if (LEGACY_MODULE_PREFIXES[key]) {
      const prefixes = LEGACY_MODULE_PREFIXES[key];
      const hasAnyGranular = perms.some(p =>
        typeof p === 'string' && prefixes.some(prefix => p.startsWith(prefix))
      );
      if (hasAnyGranular) return true;
    }

    // 5. Special aliases
    if (key === 'view_dashboard' && (perms.includes('view_dashboard') || perms.includes('trades:view_all') || perms.includes('trades:search') || perms.includes('role:view_trade') || perms.some(p => typeof p === 'string' && p.endsWith(':create')))) return true;
    if (key === 'arc:page_access' && (perms.includes('arc:page_access') || (perms.includes('arc:read') && perms.includes('arc:create')) || perms.includes('*'))) return true;
    if ((key === 'arc:read' || key === 'arc:create') && (perms.includes('arc:page_access') || perms.includes('*'))) return true;
    if (key === 'orders:view_page' && (perms.includes('manage_orders') || perms.includes('*'))) return true;
    if (key === 'trades:view_all' && perms.includes('*')) return true;
    if (key === 'trades:search' && perms.includes('*')) return true;
    if (key === 'items:quote_history' && perms.includes('view_history')) return true;
    if (key === 'pricing:view' && perms.includes('view_pricing')) return true;
    if (key === 'view_pricing' && perms.includes('pricing:view')) return true;
    if (key === 'manage_users' && (perms.includes('users:read') || perms.includes('users:create'))) return true;

    return false;
  };

  if (Array.isArray(permissionKey)) {
    return permissionKey.some(k => checkSingle(k));
  }

  return checkSingle(permissionKey);
}
