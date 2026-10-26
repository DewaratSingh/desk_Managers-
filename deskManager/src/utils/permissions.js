// Operation-Based Access Control (RBAC) Matrix Configuration & Registry

export const PERMISSION_MATRIX_COLS = [
  { key: 'create', label: 'Create / Fill' },
  { key: 'read', label: 'Read / View' },
  { key: 'update', label: 'Update / Edit' },
  { key: 'delete', label: 'Delete / Void' },
];

export const PERMISSION_MATRIX_ROWS = [
  // ── Trade & Workflow Forms ──
  { key: 'sell_rfq', label: 'Sell RFQ', category: 'trade', legacyModule: 'manage_rfqs' },
  { key: 'sell_quotation', label: 'Sell Quotation', category: 'trade', legacyModule: 'manage_quotations' },
  { key: 'sell_po', label: 'Sell Purchase Order (PO)', category: 'trade', legacyModule: 'manage_orders' },
  { key: 'ro', label: 'Release Order (RO)', category: 'trade', legacyModule: 'manage_orders' },
  { key: 'buy_rq', label: 'Buy Received Quotation (RQ)', category: 'trade', legacyModule: 'manage_quotations' },
  { key: 'buy_contract_order', label: 'Buy Contract Order', category: 'trade', legacyModule: 'manage_orders' },
  { key: 'process_rq', label: 'Process RQ', category: 'trade', legacyModule: 'manage_manufacture' },
  { key: 'process_order', label: 'Process Order', category: 'trade', legacyModule: 'manage_manufacture' },
  { key: 'delivery_note', label: 'Delivery Note', category: 'trade', legacyModule: 'manage_orders' },
  { key: 'invoice', label: 'Invoice', category: 'trade', legacyModule: 'manage_orders' },

  // ── Inventory Operations ──
  { key: 'inventory', label: 'Inventory Stock', category: 'inventory', legacyModule: 'manage_inventory' },

  // ── Manufacture & Production ──
  { key: 'manufacture', label: 'Manufacture Jobs & Production', category: 'manufacture', legacyModule: 'manage_manufacture' },

  // ── Master Catalog & Directories ──
  { key: 'items', label: 'Catalog Items & SKUs', category: 'masters', legacyModule: 'manage_items' },
  { key: 'parties', label: 'Parties (Customers)', category: 'masters', legacyModule: 'manage_parties' },
  { key: 'contacts', label: 'Contacts (Buyers)', category: 'masters', legacyModule: 'manage_contacts' },
  { key: 'arc', label: 'ARC Contracts', category: 'masters', legacyModule: 'manage_arc' },
  { key: 'gst', label: 'GST Categories', category: 'masters', legacyModule: 'manage_gst' },

  // ── System & Administration ──
  { key: 'users', label: 'User Accounts & Roles (HR)', category: 'system', legacyModule: 'manage_users' },
  { key: 'backup', label: 'Database Backup & Sync', category: 'system', legacyModule: 'manage_backup' },
  { key: 'monitor', label: 'Server & PM2 Monitor', category: 'system', legacyModule: 'manage_monitor' },
];

// Special granular capabilities outside standard CRUD
export const SPECIAL_CAPABILITIES = [
  {
    key: 'inventory:trace_history',
    label: 'Inventory Trace History',
    category: 'inventory',
    description: 'Inspect full lifecycle trace history and item lineage trees'
  },
  {
    key: 'items:quote_history',
    label: 'Item Code Quote History',
    category: 'masters',
    description: 'View past quote prices and customer price histories in forms'
  },
  {
    key: 'trades:search',
    label: 'Search All Trades',
    category: 'trade',
    description: 'Global search and browsing across company trades on the dashboard'
  },
  {
    key: 'pricing:view',
    label: 'View Pricing & Financials',
    category: 'financial',
    description: 'View unmasked unit prices, basic values, margins, and financial figures'
  },
  {
    key: 'view_dashboard',
    label: 'View Main Dashboard',
    category: 'trade',
    description: 'Access to system overview and summary metrics'
  }
];

// 7 Standard Role Presets for 1-Click Assignment
export const ROLE_PRESETS = {
  boss: {
    key: 'boss',
    label: 'Boss / Administrator',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Unrestricted full access across all operations, pricing, and system settings',
    role: 'admin',
    permissions: ['*']
  },
  stock_manager: {
    key: 'stock_manager',
    label: 'Stock Manager',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Manage inventory stock and add items via inventory form only (Trace history denied)',
    role: 'operator',
    permissions: [
      'inventory:read',
      'inventory:create',
      'inventory:update',
      'items:read'
    ]
  },
  data_feeder: {
    key: 'data_feeder',
    label: 'Data Feeder',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
    description: 'Fill data forms across all trade types without item history or trade search',
    role: 'operator',
    permissions: [
      'sell_rfq:create',
      'sell_quotation:create',
      'sell_po:create',
      'ro:create',
      'buy_rq:create',
      'buy_contract_order:create',
      'process_rq:create',
      'process_order:create',
      'delivery_note:create',
      'invoice:create',
      'items:read',
      'parties:read',
      'contacts:read',
      'gst:read'
    ]
  },
  manufacture_manager: {
    key: 'manufacture_manager',
    label: 'Manufacture Manager',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Read manufacture jobs and fill all manufacturing and processing forms',
    role: 'operator',
    permissions: [
      'manufacture:read',
      'manufacture:create',
      'manufacture:update',
      'process_rq:create',
      'process_rq:read',
      'process_rq:update',
      'process_order:create',
      'process_order:read',
      'process_order:update',
      'items:read',
      'inventory:read'
    ]
  },
  order_manager: {
    key: 'order_manager',
    label: 'Order Manager',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'Manage order page, order documents, financial pricing, and history tracking',
    role: 'operator',
    permissions: [
      'orders:read',
      'orders:create',
      'orders:update',
      'orders:delete',
      'manage_orders',
      'sell_po:create',
      'sell_po:read',
      'sell_po:update',
      'ro:create',
      'ro:read',
      'ro:update',
      'buy_contract_order:create',
      'buy_contract_order:read',
      'buy_contract_order:update',
      'delivery_note:create',
      'delivery_note:read',
      'delivery_note:update',
      'invoice:create',
      'invoice:read',
      'invoice:update',
      'trades:read',
      'trades:search',
      'pricing:view',
      'view_history',
      'items:quote_history',
      'items:read',
      'parties:read',
      'contacts:read'
    ]
  },
  hr_manager: {
    key: 'hr_manager',
    label: 'HR / People Operations',
    badgeClass: 'bg-pink-100 text-pink-800 border-pink-300',
    description: 'Manage user accounts, add/enroll operators, and configure role assignments',
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
  }
};

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
 * Check if a user has a specific permission.
 * Supports:
 * - Superuser roles ('admin', 'owner', 'boss') or '*' permission -> always true.
 * - Exact match ('inventory:trace_history').
 * - Wildcard matches ('inventory:*' satisfies 'inventory:read').
 * - Legacy module compatibility ('manage_inventory' satisfies 'inventory:read', 'inventory:create', etc.).
 * 
 * @param {Object} user - The user object from session or state
 * @param {string|string[]} permissionKey - One or more permission keys (OR logic if array)
 * @returns {boolean} True if authorized, false otherwise
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
