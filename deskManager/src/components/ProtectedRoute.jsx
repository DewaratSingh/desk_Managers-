import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  const token = localStorage.getItem('token');
  const loginTime = localStorage.getItem('loginTime');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (loginTime) {
    const elapsed = Date.now() - parseInt(loginTime, 10);
    if (elapsed > 8 * 60 * 60 * 1000) { // 8 hours in milliseconds
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('loginTime');
      return <Navigate to="/login" replace />;
    }
  }

  return <Outlet />;
}
