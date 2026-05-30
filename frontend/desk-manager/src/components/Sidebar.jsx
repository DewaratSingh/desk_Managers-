import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  Package, 
  Menu, 
  X, 
  FolderLock,
  LogOut,
  ClipboardList,
  FileText
} from 'lucide-react';
import logoImg from '../assets/image.jpeg';
export default function Sidebar({ activeTab, setActiveTab, user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add-customer', label: 'Customer', icon: UserPlus },
    { id: 'add-buyer', label: 'Buyer', icon: Users },
    { id: 'add-item', label: 'Item', icon: Package },
    { id: 'rfq', label: 'RFQ Feeding', icon: ClipboardList },
    { id: 'quotation', label: 'Quotation', icon: FileText },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <div className="lg:hidden flex items-center justify-between p-5 bg-slate-50 border-b border-slate-200 text-slate-900 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="Shreeji Industries Logo" className="w-12 h-12 object-contain shrink-0" />
          <div className="leading-none">
            <span className="font-extrabold text-sm text-slate-900 tracking-tight block">
              Shreeji Industries
            </span>
            <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest leading-none block mt-1">
              DeskManager
            </span>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2.5 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 lg:static lg:block shrink-0
        transform ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        transition-transform duration-200 ease-in-out
        bg-slate-50 border-r border-slate-200
        flex flex-col h-screen overflow-hidden
      `}>
        {/* Brand Area */}
        <div className="p-6 border-b border-slate-200 flex items-center gap-4">
          <img src={logoImg} alt="Shreeji Industries Logo" className="w-16 h-16 object-contain shrink-0" />
          <div className="overflow-hidden">
            <h1 className="font-black text-base text-slate-900 m-0 leading-tight tracking-tight">
              Shreeji Industries
            </h1>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mt-1.5">
              DeskManager
            </p>
          </div>
        </div>

        {/* Menu Links */}
        <nav className="flex-1 px-5 py-8 space-y-2.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center gap-4 px-5 py-4 rounded-xl font-bold text-base transition-colors text-left cursor-pointer
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }
                `}
              >
                <Icon size={22} className={isActive ? 'text-white' : 'text-slate-500'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User / Sign Out Area */}
        {user && (
          <div className="p-5 border-t border-slate-200 bg-slate-100 flex flex-col gap-3">
            <div className="flex items-center gap-3 px-2">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 border border-blue-200/50 flex items-center justify-center text-blue-600 font-extrabold shrink-0">
                <span className="text-sm uppercase font-black">
                  {(user.username || 'A')[0]}
                </span>
              </div>
              <div className="overflow-hidden">
                <p className="font-extrabold text-sm text-slate-800 truncate leading-tight">
                  {user.username || 'Operator'}
                </p>
                <p className="text-xs font-bold text-slate-500 truncate leading-tight capitalize mt-0.5">
                  {user.role || 'Operator'}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-bold text-sm rounded-xl transition-all border border-red-100/50 hover:border-red-200 cursor-pointer shadow-sm shadow-red-100/30"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
