import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasPermission } from '../utils/permissions';
import { toast } from 'react-toastify';
import { jwtDecode } from 'jwt-decode';

export function isTokenValid(token) {
  if (!token || typeof token !== 'string') return false;
  try {
    if (token.split('.').length === 3) {
      const decoded = jwtDecode(token);
      if (decoded && decoded.exp && decoded.exp * 1000 < Date.now()) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function getFirstAllowedPath(user) {
  if (!user) return null;
  const role = (user.role || '').toLowerCase();
  if (role === 'admin' || role === 'owner' || role === 'boss') return '/dashboard';

  // Specific role priorities
  if (hasPermission(user, 'view_dashboard') || hasPermission(user, 'trades:view_all') || hasPermission(user, 'trades:search')) return '/dashboard';
  if (hasPermission(user, 'orders:view_page') || hasPermission(user, 'manage_orders')) return '/order';
  if (hasPermission(user, 'inventory:read') || hasPermission(user, 'manage_inventory')) return '/inventory';
  if (hasPermission(user, 'manufacture:read') || hasPermission(user, 'manage_manufacture')) return '/manufactures';
  if (hasPermission(user, 'arc:read') || hasPermission(user, 'arc:create') || hasPermission(user, 'manage_arc')) return '/arc';

  // Data feeder / forms priority
  if (hasPermission(user, 'sell_rfq:create')) return '/addRfq';
  if (hasPermission(user, 'sell_quotation:create')) return '/addQuotation';
  if (hasPermission(user, 'sell_po:create')) return '/addPurchaseOrder';
  if (hasPermission(user, 'ro:create')) return '/addReleaseOrder';
  if (hasPermission(user, 'buy_rq:create')) return '/addReceivedQuotation';
  if (hasPermission(user, 'buy_contract_order:create')) return '/addContractOrder';
  if (hasPermission(user, 'process_rq:create')) return '/addProcessReceivedQuotation';
  if (hasPermission(user, 'process_order:create')) return '/addProcessContractOrder';

  // HR & System Administration
  if (hasPermission(user, 'users:read') || hasPermission(user, 'manage_users')) return '/users';
  if (hasPermission(user, 'backup:read') || hasPermission(user, 'manage_backup')) return '/backup';
  if (hasPermission(user, 'monitor:view') || hasPermission(user, 'manage_monitor')) return '/monitor';

  // Masters
  if (hasPermission(user, 'manage_parties')) return '/party';
  if (hasPermission(user, 'manage_contacts')) return '/buyer';
  if (hasPermission(user, 'manage_items')) return '/item';
  if (hasPermission(user, 'manage_arc')) return '/arc';
  if (hasPermission(user, 'manage_gst')) return '/gst-category';

  // Any trade creation permission landing on dashboard Operation Desk
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  if (perms.some(p => typeof p === 'string' && (p.endsWith(':create') || p.includes('create')))) {
    return '/dashboard';
  }

  return null;
}

export default function ProtectedRoute() {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const userStr = sessionStorage.getItem('user');
  const location = useLocation();

  if (!token || !userStr || !isTokenValid(token)) {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }

  let user;
  try {
    user = JSON.parse(userStr);
  } catch {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }

  const path = location.pathname;

  const fallbackPath = getFirstAllowedPath(user);
  if (!fallbackPath) {
    toast.error('Access Denied: Nothing allowed to user. Please contact system administrator.');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }

  let requiredPermission = null;

  if (path === '/' || path === '/dashboard' || path.startsWith('/dashboard')) {
    // Allowed if user has dashboard, trade search, or any trade create form (Operation Desk)
    const hasAnyForm = Array.isArray(user.permissions) && user.permissions.some(p => typeof p === 'string' && p.endsWith(':create'));
    if (!hasPermission(user, 'view_dashboard') && !hasPermission(user, 'trades:view_all') && !hasPermission(user, 'trades:search') && !hasAnyForm) {
      requiredPermission = 'view_dashboard';
    }
  } else if (path.startsWith('/inventory/trace-history')) {
    requiredPermission = 'inventory:trace_history';
  } else if (path.startsWith('/inventory/form')) {
    requiredPermission = 'inventory:create';
  } else if (path.startsWith('/inventory')) {
    requiredPermission = 'inventory:read';
  } else if (path.startsWith('/addRfq')) {
    requiredPermission = 'sell_rfq:create';
  } else if (path.startsWith('/updateRfq')) {
    requiredPermission = 'sell_rfq:update';
  } else if (path.startsWith('/addQuotation')) {
    requiredPermission = 'sell_quotation:create';
  } else if (path.startsWith('/updateQuotation')) {
    requiredPermission = 'sell_quotation:update';
  } else if (path.startsWith('/addPurchaseOrder')) {
    requiredPermission = 'sell_po:create';
  } else if (path.startsWith('/updatePurchaseOrder')) {
    requiredPermission = 'sell_po:update';
  } else if (path.startsWith('/addReleaseOrder')) {
    requiredPermission = 'ro:create';
  } else if (path.startsWith('/updateReleaseOrder')) {
    requiredPermission = 'ro:update';
  } else if (path.startsWith('/addReceivedQuotation')) {
    requiredPermission = 'buy_rq:create';
  } else if (path.startsWith('/updateReceivedQuotation')) {
    requiredPermission = 'buy_rq:update';
  } else if (path.startsWith('/addContractOrder')) {
    requiredPermission = 'buy_contract_order:create';
  } else if (path.startsWith('/updateContractOrder')) {
    requiredPermission = 'buy_contract_order:update';
  } else if (path.startsWith('/addProcessRq') || path.startsWith('/addProcessReceivedQuotation')) {
    requiredPermission = 'process_rq:create';
  } else if (path.startsWith('/updateProcessRq') || path.startsWith('/updateProcessReceivedQuotation')) {
    requiredPermission = 'process_rq:update';
  } else if (path.startsWith('/addProcessPurchaseOrder') || path.startsWith('/addProcessContractOrder')) {
    requiredPermission = 'process_order:create';
  } else if (path.startsWith('/updateProcessPurchaseOrder') || path.startsWith('/updateProcessContractOrder')) {
    requiredPermission = 'process_order:update';
  } else if (path === '/order' || path.startsWith('/order')) {
    requiredPermission = 'orders:view_page';
  } else if (
    path.startsWith('/addReceivedPurchaseOrder') ||
    path.startsWith('/updateReceivedPurchaseOrder') ||
    path.startsWith('/release-order') ||
    path.startsWith('/addDeliveryNote') ||
    path.startsWith('/updateDeliveryNote') ||
    path.startsWith('/addInvoice') ||
    path.startsWith('/updateInvoice')
  ) {
    requiredPermission = 'orders:read';
  } else if (path.startsWith('/arc/form')) {
    requiredPermission = ['arc:create', 'arc:update', 'manage_arc'];
  } else if (path.startsWith('/arc')) {
    requiredPermission = ['arc:read', 'arc:create', 'manage_arc'];
  } else if (path.startsWith('/item')) {
    requiredPermission = 'items:read';
  } else if (
    path.startsWith('/manufacture') ||
    path.startsWith('/manufactures') ||
    path.startsWith('/process-rq')
  ) {
    requiredPermission = 'manufacture:read';
  } else if (path.startsWith('/party')) {
    requiredPermission = 'parties:read';
  } else if (path.startsWith('/buyer')) {
    requiredPermission = 'contacts:read';
  } else if (path.startsWith('/gst-category')) {
    requiredPermission = 'gst:read';
  } else if (path.startsWith('/users')) {
    requiredPermission = 'users:read';
  } else if (path.startsWith('/backup')) {
    requiredPermission = 'backup:read';
  } else if (path.startsWith('/monitor')) {
    requiredPermission = 'monitor:view';
  }

  if (requiredPermission && !hasPermission(user, requiredPermission)) {
    toast.error('Access Denied: You do not have permission to view this page.');
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}
