import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const navigate = useNavigate();
  const userStr = sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : { username: 'admin', role: 'admin' };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    sessionStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
