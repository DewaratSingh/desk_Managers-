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
  } else if (
    path.startsWith('/order') ||
    path.startsWith('/addPurchaseOrder') ||
    path.startsWith('/updatePurchaseOrder') ||
    path.startsWith('/addReceivedPurchaseOrder') ||
    path.startsWith('/updateReceivedPurchaseOrder') ||
    path.startsWith('/release-order') ||
    path.startsWith('/addReleaseOrder') ||
    path.startsWith('/updateReleaseOrder') ||
    path.startsWith('/addDeliveryNote') ||
    path.startsWith('/updateDeliveryNote') ||
    path.startsWith('/addInvoice') ||
    path.startsWith('/updateInvoice')
  ) {
    requiredPermission = 'manage_orders';
  } else if (path.startsWith('/arc')) {
    requiredPermission = 'manage_arc';
  } else if (path.startsWith('/addRfq') || path.startsWith('/updateRfq')) {
    requiredPermission = 'manage_rfqs';
  } else if (
    path.startsWith('/addQuotation') ||
    path.startsWith('/updateQuotation') ||
    path.startsWith('/addReceivedQuotation') ||
    path.startsWith('/updateReceivedQuotation')
  ) {
    requiredPermission = 'manage_quotations';
  } else if (path.startsWith('/inventory')) {
    requiredPermission = 'manage_inventory';
  } else if (path.startsWith('/item')) {
    requiredPermission = 'manage_items';
  } else if (
    path.startsWith('/manufacture') ||
    path.startsWith('/manufactures') ||
    path.startsWith('/addProcessRq') ||
    path.startsWith('/process-rq') ||
    path.startsWith('/updateProcessRq') ||
    path.startsWith('/addProcessPurchaseOrder')
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
