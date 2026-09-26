import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  UserPlus,
  Users,
  Package,
  Warehouse,
  Factory,
  FileText,
  FileSignature,
  Percent,
  Menu,
  X,
  LogOut,
  Building2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import logoImg from "../assets/image.jpeg";

export default function Sidebar({ user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isShrunk, setIsShrunk] = useState(() => {
    return localStorage.getItem("sidebar-shrunk") === "true";
  });
  const navigate = useNavigate();
  const location = useLocation();

  const toggleShrunk = () => {
    setIsShrunk((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-shrunk", String(next));
      return next;
    });
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { id: "purchase-order", label: "Order", icon: ClipboardList, path: "/order" },
    { id: "add-customer", label: "Party", icon: Building2, path: "/party" },
    { id: "add-buyer", label: "Contact", icon: UserPlus, path: "/buyer" },
    { id: "add-item", label: "Item", icon: Package, path: "/item" },
    { id: "inventory", label: "Inventory", icon: Warehouse, path: "/inventory" },
    { id: "manufacture", label: "Manufacture", icon: Factory, path: "/manufactures" },
    { id: "arc", label: "ARC", icon: FileSignature, path: "/arc" },
    { id: "gst-category", label: "GST Categories", icon: Percent, path: "/gst-category" },
    { id: "users", label: "Users", icon: Users, path: "/users" },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full overflow-hidden text-slate-100" style={{ backgroundColor: "var(--theme-primary)" }}>
      {/* Brand */}
      <div className={`py-4 border-b border-slate-800/80 flex items-center shrink-0 ${isShrunk ? 'px-2.5 justify-center gap-1.5' : 'px-4 justify-between'}`}>
        <div className="flex items-center gap-3">
          <img
            src={logoImg}
            alt="Logo"
            className={`${isShrunk ? 'w-8 h-8' : 'w-10 h-10'} object-contain shrink-0 rounded-lg transition-all duration-300`}
          />
          {!isShrunk && (
            <div>
              <p className="font-black text-sm text-white leading-tight tracking-tight">
                {user?.company_name}
              </p>
              <p
                className="text-[9px] font-black uppercase tracking-widest leading-none mt-0.5"
                style={{ color: "var(--theme-secondary)" }}
              >
                DeskManager
              </p>
            </div>
          )}
        </div>
        
        {/* Shrink / Expand Button (Desktop Only) */}
        <button
          onClick={toggleShrunk}
          className="hidden lg:flex items-center justify-center p-1 hover:bg-slate-800/80 rounded text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          title={isShrunk ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isShrunk ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Menu Links — scrolls independently */}
      <nav className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${isShrunk ? 'px-2' : 'px-3'} py-2`}>
        {menuItems.map((item) => {
          const isActive =
            item.id === "dashboard"
              ? location.pathname === "/dashboard" ||
                location.pathname.startsWith("/trade/") ||
                location.pathname === "/addRfq" ||
                location.pathname.startsWith("/updateRfq/") ||
                location.pathname === "/addQuotation" ||
                location.pathname.startsWith("/updateQuotation/") ||
                location.pathname === "/addReceivedQuotation" ||
                location.pathname.startsWith("/updateReceivedQuotation/")
              : item.id === "purchase-order"
                ? location.pathname.startsWith("/order") ||
                  location.pathname.startsWith("/addPurchaseOrder") ||
                  location.pathname.startsWith("/updatePurchaseOrder/") ||
                  location.pathname.startsWith("/addReceivedPurchaseOrder") ||
                  location.pathname.startsWith("/updateReceivedPurchaseOrder/") ||
                  location.pathname.startsWith("/addReleaseOrder") ||
                  location.pathname.startsWith("/updateReleaseOrder/") ||
                  location.pathname.startsWith("/addDeliveryNote") ||
                  location.pathname.startsWith("/updateDeliveryNote/") ||
                  location.pathname.startsWith("/addInvoice") ||
                  location.pathname.startsWith("/updateInvoice/") ||
                  location.pathname.startsWith("/release-order/")
                : location.pathname.startsWith(item.path);

          return (
            <button
              key={item.id}
              onClick={() => {
                navigate(item.path);
                setIsOpen(false);
              }}
              className={`group w-full flex items-center ${isShrunk ? 'justify-center gap-0 px-1 py-2' : 'gap-3 px-3 py-1.5'} mb-1 rounded-lg font-semibold text-sm transition-all duration-150 text-left cursor-pointer ${isActive ? "text-white shadow-md" : "text-slate-300 hover:text-white hover:bg-slate-800/60"}`}
              style={
                isActive ? { backgroundColor: "var(--theme-secondary)" } : undefined
              }
              title={isShrunk ? item.label : undefined}
            >
              {(() => {
                const Icon = item.icon;
                return (
                  <div className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center shrink-0 ${
                    isActive 
                      ? "bg-white/20 text-white shadow-sm" 
                      : "bg-slate-800/80 text-slate-400 group-hover:bg-slate-700/60 group-hover:text-white"
                  }`}>
                    <Icon
                      size={16}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      className="transition-transform duration-200 group-hover:scale-110"
                    />
                  </div>
                );
              })()}
              {!isShrunk && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User / Sign Out — always visible at bottom */}
      {user && (
        <div className={`shrink-0 ${isShrunk ? 'px-2 py-3' : 'px-3 py-3'} border-t border-slate-800/80 bg-slate-950/50 flex flex-col gap-2`}>
          <div className={`flex items-center ${isShrunk ? 'justify-center' : 'gap-2.5 px-2'} mb-1`}>
            <div 
              className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-black text-xs shrink-0"
              title={`${user.username} (${user.role})`}
            >
              {(user.username || "A")[0].toUpperCase()}
            </div>
            {!isShrunk && (
              <div className="overflow-hidden">
                <p className="font-bold text-xs text-white truncate leading-tight">
                  {user.username || "Operator"}
                </p>
                <p className="text-[10px] font-semibold text-slate-400 truncate capitalize">
                  {user.role || "Operator"}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            title={isShrunk ? "Sign Out" : undefined}
            className={`group w-full flex items-center ${isShrunk ? 'justify-center' : 'justify-center gap-2'} px-3 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 font-bold text-xs rounded-lg transition-all duration-150 border border-red-900/40 cursor-pointer`}
          >
            <div className="p-1 rounded-md bg-red-900/50 group-hover:bg-red-800/60 flex items-center justify-center shrink-0 transition-colors">
              <LogOut size={13} strokeWidth={2} className="text-red-300 transition-transform duration-200 group-hover:translate-x-0.5" />
            </div>
            {!isShrunk && <span>Sign Out</span>}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Top Header (Always Expanded Visual branding) */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800 text-white sticky top-0 z-50" style={{ backgroundColor: "var(--theme-primary)" }}>
        <div className="flex items-center gap-2.5">
          <img
            src={logoImg}
            alt="Logo"
            className="w-9 h-9 object-contain rounded-lg"
          />
          <div>
            <p className="font-extrabold text-sm text-white tracking-tight">
              {user?.company_name}
            </p>
            <p
              className="text-[8px] font-black uppercase tracking-widest leading-none"
              style={{ color: "var(--theme-secondary)" }}
            >
              DeskManager
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col ${isShrunk ? 'w-20' : 'w-64'} h-screen border-r border-slate-800 shrink-0 sticky top-0 transition-all duration-300`} style={{ backgroundColor: "var(--theme-primary)" }}>
        <NavContent />
      </aside>

      {/* Mobile Drawer */}
      <aside
        className={`
        lg:hidden fixed inset-y-0 left-0 z-50 w-64
        flex flex-col border-r border-slate-800
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
        style={{ backgroundColor: "var(--theme-primary)" }}
      >
        <NavContent />
      </aside>
    </>
  );
}
