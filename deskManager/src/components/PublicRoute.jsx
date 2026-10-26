import React from 'react';
import { Navigate } from 'react-router-dom';
import { isTokenValid, getFirstAllowedPath } from './ProtectedRoute';

export default function PublicRoute({ children }) {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  const userStr = sessionStorage.getItem('user');

  if (token && userStr && isTokenValid(token)) {
    try {
      const user = JSON.parse(userStr);
      const fallback = getFirstAllowedPath(user) || '/dashboard';
      return <Navigate to={fallback} replace />;
    } catch {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
