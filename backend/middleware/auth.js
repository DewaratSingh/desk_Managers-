const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'deskmanager_secret_key_2026';

const ALL_MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", path: "/dashboard", permission: "view_dashboard" },
  { id: "purchase-order", label: "Order", icon: "ClipboardList", path: "/order", permission: "manage_orders" },
  { id: "add-customer", label: "Party", icon: "Building2", path: "/party", permission: "manage_parties" },
  { id: "add-buyer", label: "Contact", icon: "UserPlus", path: "/buyer", permission: "manage_contacts" },
  { id: "add-item", label: "Item", icon: "Package", path: "/item", permission: "manage_items" },
  { id: "inventory", label: "Inventory", icon: "Warehouse", path: "/inventory", permission: "manage_inventory" },
  { id: "manufacture", label: "Manufacture", icon: "Factory", path: "/manufactures", permission: "manage_manufacture" },
  { id: "arc", label: "ARC", icon: "FileSignature", path: "/arc", permission: "manage_arc" },
  { id: "gst-category", label: "GST Categories", icon: "Percent", path: "/gst-category", permission: "manage_gst" },
  { id: "users", label: "Users", icon: "Users", path: "/users", permission: "manage_users" },
  { id: "backup", label: "Backup", icon: "CloudUpload", path: "/backup", permission: "manage_backup" },
  { id: "monitor", label: "Monitor", icon: "Activity", path: "/monitor", permission: "manage_monitor" },
  { id: "settings", label: "Settings", icon: "Settings", path: "/settings" },
];

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

function hasUserPermission(user, permissionKey) {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  if (role === 'admin' || role === 'owner' || role === 'boss') return true;

  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.includes('*')) return true;
  if (!permissionKey) return true;

  const checkSingle = (key) => {
    if (!key) return true;
    if (perms.includes(key)) return true;

    // Check wildcard match: e.g. user has 'inventory:*'
    const parts = key.split(':');
    if (parts.length === 2 && perms.includes(`${parts[0]}:*`)) return true;

    // Legacy module granted -> satisfies granular
    for (const [legacyMod, prefixes] of Object.entries(LEGACY_MODULE_PREFIXES)) {
      if (perms.includes(legacyMod)) {
        if (prefixes.some(p => key.startsWith(p))) return true;
      }
    }

    // Granular key granted -> satisfies legacy module
    if (LEGACY_MODULE_PREFIXES[key]) {
      const prefixes = LEGACY_MODULE_PREFIXES[key];
      const hasAnyGranular = perms.some(p =>
        typeof p === 'string' && prefixes.some(prefix => p.startsWith(prefix))
      );
      if (hasAnyGranular) return true;
    }

    // Aliases
    if (key === 'items:quote_history' && perms.includes('view_history')) return true;
    if (key === 'pricing:view' && perms.includes('view_pricing')) return true;
    if (key === 'view_pricing' && perms.includes('pricing:view')) return true;
    if (key === 'manage_users' && (perms.includes('users:read') || perms.includes('users:create'))) return true;
    if (key === 'manage_backup' && (perms.includes('backup:read') || perms.includes('backup:manage'))) return true;
    if (key === 'manage_monitor' && (perms.includes('monitor:view') || perms.includes('monitor:read'))) return true;

    return false;
  };

  if (Array.isArray(permissionKey)) {
    return permissionKey.some(k => checkSingle(k));
  }
  return checkSingle(permissionKey);
}

function computeAllowedNavigation(user) {
  const role = (user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'owner' || role === 'boss') {
    return ALL_MENU_ITEMS;
  }
  return ALL_MENU_ITEMS.filter(item => !item.permission || hasUserPermission(user, item.permission));
}

function sanitizePrices(data, user) {
  const role = (user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'owner' || role === 'boss') return data;
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  if (perms.includes('*') || perms.includes('view_pricing') || perms.includes('pricing:view')) return data;

  const mask = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const cloned = { ...obj };
    ['unit_price', 'total_amount', 'grand_total', 'basic_value', 'price', 'rate', 'calculated_price', 'cost_price', 'margin'].forEach(f => {
      if (f in cloned) cloned[f] = null;
    });
    if (Array.isArray(cloned.items)) {
      cloned.items = cloned.items.map(mask);
    }
    return cloned;
  };

  return Array.isArray(data) ? data.map(mask) : mask(data);
}

const authMiddleware = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // Parse Cookie header if token not found in Authorization header
  if (!token && req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
      const [name, ...value] = cookie.trim().split('=');
      acc[name] = value.join('=');
      return acc;
    }, {});
    token = cookies['token'];
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if the user company exists in the database
    if (decoded.company_id) {
      const companyCheck = await pool.query('SELECT id FROM companies WHERE id = $1', [decoded.company_id]);
      if (companyCheck.rows.length === 0) {
        return res.status(401).json({ error: 'Company tenant no longer exists. Please re-authenticate.' });
      }
    }
    
    req.user = {
      username: decoded.user_id,
      user_id: decoded.user_id,
      company_id: decoded.company_id
    };

    if (decoded.user_id) {
      const userCheck = await pool.query('SELECT role, permissions FROM users WHERE username = $1', [decoded.user_id]);
      if (userCheck.rows.length > 0) {
        req.user.role = userCheck.rows[0].role;
        req.user.permissions = userCheck.rows[0].permissions || [];
      }
    }

    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const requirePermission = (permKey) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    if (hasUserPermission(req.user, permKey)) return next();

    const requiredMsg = Array.isArray(permKey) ? permKey.join(' OR ') : permKey;
    return res.status(403).json({ error: `Access Denied: Permission '${requiredMsg}' required.` });
  };
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.requirePermission = requirePermission;
module.exports.hasUserPermission = hasUserPermission;
module.exports.computeAllowedNavigation = computeAllowedNavigation;
module.exports.sanitizePrices = sanitizePrices;
