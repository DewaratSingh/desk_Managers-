import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { hasPermission } from '../utils/permissions';
import { toast } from 'react-toastify';

export function getFirstAllowedPath(user) {
  if (hasPermission(user, 'view_dashboard')) return '/dashboard';
  if (hasPermission(user, 'manage_orders')) return '/order';
  if (hasPermission(user, 'manage_rfqs')) return '/dashboard';
  if (hasPermission(user, 'manage_quotations')) return '/dashboard';
  if (hasPermission(user, 'manage_parties')) return '/party';
  if (hasPermission(user, 'manage_contacts')) return '/buyer';
  if (hasPermission(user, 'manage_items')) return '/item';
  if (hasPermission(user, 'manage_inventory')) return '/inventory';
  if (hasPermission(user, 'manage_manufacture')) return '/manufactures';
  if (hasPermission(user, 'manage_arc')) return '/arc';
  if (hasPermission(user, 'manage_gst')) return '/gst-category';
  if (hasPermission(user, 'manage_users')) return '/users';
  return null;
}

export default function ProtectedRoute() {
  const userStr = sessionStorage.getItem('user');
  const location = useLocation();

  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(userStr);
  const path = location.pathname;

  const fallbackPath = getFirstAllowedPath(user);
  if (!fallbackPath) {
    toast.error('Access Denied: Nothing allowed to user. Please contact system administrator.');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }

  let requiredPermission = null;

  if (path === '/dashboard' || path.startsWith('/dashboard')) {
    requiredPermission = 'view_dashboard';
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
  } else if (
    path.startsWith('/order') ||
    path.startsWith('/addReceivedPurchaseOrder') ||
    path.startsWith('/updateReceivedPurchaseOrder') ||
    path.startsWith('/release-order') ||
    path.startsWith('/addDeliveryNote') ||
    path.startsWith('/updateDeliveryNote') ||
    path.startsWith('/addInvoice') ||
    path.startsWith('/updateInvoice')
  ) {
    requiredPermission = 'manage_orders';
  } else if (path.startsWith('/arc')) {
    requiredPermission = 'manage_arc';
  } else if (path.startsWith('/inventory')) {
    requiredPermission = 'manage_inventory';
  } else if (path.startsWith('/item')) {
    requiredPermission = 'manage_items';
  } else if (
    path.startsWith('/manufacture') ||
    path.startsWith('/manufactures') ||
    path.startsWith('/process-rq')
  ) {
    requiredPermission = 'manage_manufacture';
  } else if (path.startsWith('/party')) {
    requiredPermission = 'manage_parties';
  } else if (path.startsWith('/buyer')) {
    requiredPermission = 'manage_contacts';
  } else if (path.startsWith('/gst-category')) {
    requiredPermission = 'manage_gst';
  } else if (path.startsWith('/users')) {
    requiredPermission = 'manage_users';
  }

  if (requiredPermission && !hasPermission(user, requiredPermission)) {
    toast.error('Access Denied: You do not have permission to view this page.');
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}
