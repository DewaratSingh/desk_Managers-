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
];

function computeAllowedNavigation(user) {
  const role = (user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'owner') {
    return ALL_MENU_ITEMS;
  }
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  return ALL_MENU_ITEMS.filter(item => !item.permission || perms.includes(item.permission));
}

function sanitizePrices(data, user) {
  const role = (user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'owner') return data;
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  if (perms.includes('view_pricing')) return data;

  const mask = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const cloned = { ...obj };
    ['unit_price', 'total_amount', 'grand_total', 'basic_value', 'price', 'rate', 'calculated_price'].forEach(f => {
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
    const role = (req.user.role || '').toLowerCase();
    if (role === 'admin' || role === 'owner') return next();

    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    if (perms.includes(permKey)) return next();

    return res.status(403).json({ error: `Access Denied: Permission '${permKey}' required.` });
  };
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.requirePermission = requirePermission;
module.exports.computeAllowedNavigation = computeAllowedNavigation;
module.exports.sanitizePrices = sanitizePrices;
