import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MdDashboard,
  MdPersonAdd,
  MdPeople,
  MdInventory,
  MdReceipt,
  MdFileUpload,
  MdCreditCard,
  MdTag,
  MdPercent,
  MdMenu,
  MdClose,
  MdLogout,
  MdDescription,
} from "react-icons/md";
import logoImg from "../assets/image.jpeg";

export default function Sidebar({ activeTab, setActiveTab, user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: MdDashboard },
    { id: "purchase-order", label: "Order", icon: MdReceipt },
    { id: "add-customer", label: "Customer", icon: MdPersonAdd },
    { id: "add-buyer", label: "Buyer", icon: MdPeople },
    { id: "add-item", label: "Item", icon: MdInventory },
    { id: "payment", label: "Payment", icon: MdCreditCard },
    { id: "arc", label: "ARC", icon: MdTag },
    { id: "gst-category", label: "GST Categories", icon: MdPercent },
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
        <img
          src={logoImg}
          alt="Logo"
          className="w-10 h-10 object-contain shrink-0 rounded-lg"
        />
        <div>
          <p className="font-black text-sm text-slate-900 leading-tight tracking-tight">
            Shreeji Industries
          </p>
          <p
            className="text-[9px] font-black uppercase tracking-widest leading-none mt-0.5"
            style={{ color: "var(--theme-color)" }}
          >
            DeskManager
          </p>
        </div>
      </div>

      {/* Menu Links — scrolls independently */}
      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2">
        {menuItems.map((item) => {
          const isActive =
            item.id === "addRfq"
              ? location.pathname === "/addRfq" ||
                location.pathname.startsWith("/updateRfq/")
              : item.id === "quotation"
                ? location.pathname === "/addQuotation" ||
                  location.pathname.startsWith("/updateQuotation/") ||
                  (location.pathname === "/" &&
                    (activeTab === "quotation" ||
                      activeTab === "addQuotation" ||
                      activeTab === "updateQuotation"))
                : location.pathname === "/" && activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "addRfq") {
                  navigate("/addRfq");
                } else if (item.id === "quotation") {
                  setActiveTab("quotation");
                  navigate("/");
                } else {
                  setActiveTab(item.id);
                  navigate("/");
                }
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded-lg font-semibold text-sm transition-all duration-150 text-left cursor-pointer ${isActive ? "text-white" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"}`}
              style={
                isActive ? { backgroundColor: "var(--theme-color)" } : undefined
              }
            >
              {(() => {
                const Icon = item.icon;
                return (
                  <Icon
                    size={18}
                    className={`shrink-0 ${isActive ? "text-white" : "text-slate-400"}`}
                  />
                );
              })()}
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
              {(user.username || "A")[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-xs text-slate-800 truncate leading-tight">
                {user.username || "Operator"}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 truncate capitalize">
                {user.role || "Operator"}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-bold text-xs rounded-lg transition-all border border-red-100 hover:border-red-200 cursor-pointer"
          >
            <MdLogout size={14} className="text-red-600" />
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
          <img
            src={logoImg}
            alt="Logo"
            className="w-9 h-9 object-contain rounded-lg"
          />
          <div>
            <p className="font-extrabold text-sm text-slate-900 tracking-tight">
              Shreeji Industries
            </p>
            <p
              className="text-[8px] font-black uppercase tracking-widest leading-none"
              style={{ color: "var(--theme-color)" }}
            >
              DeskManager
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          {isOpen ? <MdClose size={24} /> : <MdMenu size={24} />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 h-screen bg-slate-50 border-r border-slate-200 shrink-0">
        <NavContent />
      </aside>

      {/* Mobile Drawer */}
      <aside
        className={`
        lg:hidden fixed inset-y-0 left-0 z-50 w-64
        flex flex-col bg-slate-50 border-r border-slate-200
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <NavContent />
      </aside>
    </>
  );
}
