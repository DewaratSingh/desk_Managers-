export const PERMISSION_MATRIX_ROWS = [
  { key: 'sell_rfq', label: 'Sell RFQ', legacyModule: 'manage_rfqs' },
  { key: 'sell_quotation', label: 'Sell Quotation', legacyModule: 'manage_quotations' },
  { key: 'sell_po', label: 'Sell PO', legacyModule: 'manage_orders' },
  { key: 'ro', label: 'RO', legacyModule: 'manage_orders' },
  { key: 'buy_rq', label: 'Buy RQ', legacyModule: 'manage_quotations' },
  { key: 'buy_contract_order', label: 'Buy Contract Order', legacyModule: 'manage_orders' },
  { key: 'process_rq', label: 'Process RQ', legacyModule: 'manage_manufacture' },
  { key: 'process_order', label: 'Process Order', legacyModule: 'manage_manufacture' },
];

export const PERMISSION_MATRIX_COLS = [
  { key: 'create', label: 'Create' },
  { key: 'read', label: 'Read' },
  { key: 'update', label: 'Update' },
];

const LEGACY_MODULE_PREFIXES = {
  manage_rfqs: ['sell_rfq:'],
  manage_quotations: ['sell_quotation:', 'buy_rq:'],
  manage_orders: ['sell_po:', 'ro:', 'buy_contract_order:'],
  manage_manufacture: ['process_rq:', 'process_order:']
};

/**
 * Check if a user has a specific permission.
 * Owner and Admin roles automatically have ALL permissions.
 * Supports both granular matrix keys ('sell_rfq:create') and module keys ('manage_rfqs').
 * 
 * @param {Object} user - The user object from session or state
 * @param {string} permissionKey - The permission identifier (e.g., 'sell_rfq:create', 'view_history', 'view_pricing')
 * @returns {boolean} True if authorized, false otherwise
 */
export function hasPermission(user, permissionKey) {
  if (!user) return false;
  
  const role = (user.role || '').toLowerCase();
  // Owner and Admin automatically have ALL permissions across the entire system
  if (role === 'admin' || role === 'owner') {
    return true;
  }

  if (!permissionKey) return true;

  // Check operator permissions array
  if (Array.isArray(user.permissions)) {
    // 1. Direct match
    if (user.permissions.includes(permissionKey)) {
      return true;
    }

    // 2. If checking legacy module key (e.g. 'manage_rfqs'), check if any granular permission is granted
    if (LEGACY_MODULE_PREFIXES[permissionKey]) {
      const prefixes = LEGACY_MODULE_PREFIXES[permissionKey];
      const hasAnyGranular = user.permissions.some(p => 
        prefixes.some(prefix => typeof p === 'string' && p.startsWith(prefix))
      );
      if (hasAnyGranular) return true;
    }

    // 3. If checking granular key (e.g. 'sell_rfq:create'), check if corresponding legacy module is granted
    for (const [legacyMod, prefixes] of Object.entries(LEGACY_MODULE_PREFIXES)) {
      if (user.permissions.includes(legacyMod)) {
        if (prefixes.some(prefix => permissionKey.startsWith(prefix))) {
          return true;
        }
      }
    }
  }

  return false;
}

