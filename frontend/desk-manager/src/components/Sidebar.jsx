import React, { useState } from 'react';
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Package,
  Menu,
  X,
  LogOut,
  ClipboardList,
  FileText,
  FileCheck,
  Receipt,
  Truck,
  Tag,
  FileOutput,
  Percent
} from 'lucide-react';
import logoImg from '../assets/image.jpeg';

export default function Sidebar({ activeTab, setActiveTab, user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard',          label: 'Dashboard',          icon: LayoutDashboard },
    { id: 'add-customer',       label: 'Customer',           icon: UserPlus },
    { id: 'add-buyer',          label: 'Buyer',              icon: Users },
    { id: 'add-item',           label: 'Item',               icon: Package },
    { id: 'rfq',                label: 'RFQ Feeding',        icon: ClipboardList },
    { id: 'received-quotation', label: 'Received Quotation', icon: FileCheck },
    { id: 'quotation',          label: 'Quotation',          icon: FileText },
    { id: 'purchase-order',     label: 'Purchase Order',     icon: Receipt },
    { id: 'release-order',      label: 'Release Order',      icon: FileOutput },
    { id: 'delivery',           label: 'Delivery',           icon: Truck },
    { id: 'arc',                label: 'ARC',                icon: Tag },
    { id: 'gst-category',       label: 'GST Categories',     icon: Percent },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
        <img src={logoImg} alt="Logo" className="w-10 h-10 object-contain shrink-0 rounded-lg" />
        <div>
          <p className="font-black text-sm text-slate-900 leading-tight tracking-tight">Shreeji Industries</p>
          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none mt-0.5">DeskManager</p>
        </div>
      </div>

      {/* Menu Links — scrolls independently */}
      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded-lg font-semibold text-sm transition-all duration-150 text-left cursor-pointer
                ${isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
            >
              <Icon size={18} className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User / Sign Out — always visible at bottom */}
      {user && (
        <div className="shrink-0 px-3 py-3 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5 px-2 mb-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-xs shrink-0">
              {(user.username || 'A')[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-xs text-slate-800 truncate leading-tight">{user.username || 'Operator'}</p>
              <p className="text-[10px] font-semibold text-slate-400 truncate capitalize">{user.role || 'Operator'}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-bold text-xs rounded-lg transition-all border border-red-100 hover:border-red-200 cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <img src={logoImg} alt="Logo" className="w-9 h-9 object-contain rounded-lg" />
          <div>
            <p className="font-extrabold text-sm text-slate-900 tracking-tight">Shreeji Industries</p>
            <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest leading-none">DeskManager</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden" />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen bg-slate-50 border-r border-slate-200 shrink-0">
        <NavContent />
      </aside>

      {/* Mobile Drawer */}
      <aside className={`
        lg:hidden fixed inset-y-0 left-0 z-50 w-64
        flex flex-col bg-slate-50 border-r border-slate-200
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <NavContent />
      </aside>
    </>
  );
}
