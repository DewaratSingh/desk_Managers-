import React, { useState, useEffect } from "react";
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
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  Briefcase,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Cog,
  Cpu,
  ArrowRight,
  FilePlus,
  FileOutput,
  Send,
  ReceiptText,
  PackagePlus,
  ClipboardCheck,
  Workflow,
  Repeat2,
  ArrowDownToLine,
} from "lucide-react";
import logoImg from "../assets/image.jpeg";
import { hasPermission } from "../utils/permissions";

// ───   section data ────────────────────────────────────────────────

const OPERATIONS = [
  {
    id: "ops-sell",
    label: "Sell",
    icon: TrendingUp,
    color: "emerald",
    links: [
      {
        id: "ops-sell-rfq",
        label: "RFQ",
        icon: Send,
        path: "/addRfq",
        hint: "Create RFQ",
      },
      {
        id: "ops-sell-ro",
        label: "Release Order",
        icon: FileOutput,
        path: "/addReleaseOrder",
        hint: "Create Release Order",
      },
    ],
  },
  {
    id: "ops-buy",
    label: "Buy",
    icon: ShoppingCart,
    color: "blue",
    links: [
      {
        id: "ops-buy-rq",
        label: "Received Quotation",
        icon: ArrowDownToLine,
        path: "/addReceivedQuotation",
        hint: "Create Received Quotation",
      },
      {
        id: "ops-buy-contract",
        label: "Contract Order",
        icon: FileSignature,
        path: "/addContractOrder",
        hint: "Create Contract",
      },
    ],
  },
  {
    id: "ops-sell-process",
    label: "Sell Process",
    icon: Cpu,
    color: "violet",
    links: [
      {
        id: "ops-sp-rfq",
        label: "RFQ",
        icon: Send,
        path: "/addProcessRq",
        hint: "Create RFQ",
      },
      {
        id: "ops-sp-ro",
        label: "Release Order",
        icon: FileOutput,
        path: "/addReleaseOrder",
        hint: "Create Release Order",
      },
    ],
  },
  {
    id: "ops-buy-process",
    label: "Buy Process",
    icon: Workflow,
    color: "amber",
    links: [
      {
        id: "ops-bp-rq",
        label: "Received Quotation",
        icon: ArrowDownToLine,
        path: "/addReceivedQuotation",
        hint: "Create Received Quotation",
      },
      {
        id: "ops-bp-contract",
        label: "Contract Order",
        icon: FileSignature,
        path: "/arc/form",
        hint: "Create Contract",
      },
    ],
  },
];

// Maps color name → Tailwind classes for accent
const accentClasses = {
  emerald: {
    badge:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    active: "bg-emerald-500/20 text-emerald-200",
    dot:    "bg-emerald-400",
    hover:  "hover:bg-emerald-500/10 hover:text-emerald-200",
    link:   "bg-emerald-400/10 text-emerald-300",
  },
  blue: {
    badge:  "bg-blue-500/20 text-blue-300 border-blue-500/30",
    active: "bg-blue-500/20 text-blue-200",
    dot:    "bg-blue-400",
    hover:  "hover:bg-blue-500/10 hover:text-blue-200",
    link:   "bg-blue-400/10 text-blue-300",
  },
  violet: {
    badge:  "bg-violet-500/20 text-violet-300 border-violet-500/30",
    active: "bg-violet-500/20 text-violet-200",
    dot:    "bg-violet-400",
    hover:  "hover:bg-violet-500/10 hover:text-violet-200",
    link:   "bg-violet-400/10 text-violet-300",
  },
  amber: {
    badge:  "bg-amber-500/20 text-amber-300 border-amber-500/30",
    active: "bg-amber-500/20 text-amber-200",
    dot:    "bg-amber-400",
    hover:  "hover:bg-amber-500/10 hover:text-amber-200",
    link:   "bg-amber-400/10 text-amber-300",
  },
};

// ─── Sidebar Component ───────────────────────────────────────────────────────

export default function Sidebar({ user, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isShrunk, setIsShrunk] = useState(() => {
    return localStorage.getItem("sidebar-shrunk") === "true";
  });
  const [backendMenuItems, setBackendMenuItems] = useState(null);
  // Which Operations sub-groups are expanded (by id)
  const [expandedOps, setExpandedOps] = useState({});
  // Whether the whole Operations accordion is open
  const [opsOpen, setOpsOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.user) {
          sessionStorage.setItem('user', JSON.stringify(data.user));
          if (Array.isArray(data.allowedNavigation)) {
            setBackendMenuItems(data.allowedNavigation);
          }
        }
      })
      .catch(console.error);
  }, []);

  const toggleShrunk = () => {
    setIsShrunk((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-shrunk", String(next));
      return next;
    });
  };

  const toggleOpsGroup = (id) => {
    setExpandedOps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const iconMap = {
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
    Building2,
    Settings,
  };

  const defaultMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", permission: "view_dashboard" },
    { id: "purchase-order", label: "Order", icon: ClipboardList, path: "/order", permission: "manage_orders" },
    { id: "add-customer", label: "Party", icon: Building2, path: "/party", permission: "manage_parties" },
    { id: "add-buyer", label: "Contact", icon: UserPlus, path: "/buyer", permission: "manage_contacts" },
    { id: "add-item", label: "Item", icon: Package, path: "/item", permission: "manage_items" },
    { id: "inventory", label: "Inventory", icon: Warehouse, path: "/inventory", permission: "manage_inventory" },
    { id: "manufacture", label: "Manufacture", icon: Factory, path: "/manufactures", permission: "manage_manufacture" },
    { id: "arc", label: "ARC", icon: FileSignature, path: "/arc", permission: "manage_arc" },
    { id: "gst-category", label: "GST Categories", icon: Percent, path: "/gst-category", permission: "manage_gst" },
    { id: "users", label: "Users", icon: Users, path: "/users", permission: "manage_users" },
    { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
  ];

  const menuItems = backendMenuItems
    ? [
        ...backendMenuItems.map((item) => ({
          ...item,
          icon: typeof item.icon === 'string' ? (iconMap[item.icon] || LayoutDashboard) : item.icon,
        })),
        { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
      ]
    : defaultMenuItems;

  const visibleMenuItems = menuItems.filter(
    (item) => !item.permission || hasPermission(user, item.permission)
  );

  // Is any ops sub-link currently active?
  const isOpsActive = OPERATIONS.some((grp) =>
    grp.links.some((lnk) => location.pathname === lnk.path)
  );

  // ─── NavItem (standard) ─────────────────────────────────────────────────
  const NavItem = ({ item }) => {
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

    const Icon = item.icon;
    return (
      <button
        key={item.id}
        onClick={() => { navigate(item.path); setIsOpen(false); }}
        className={`group w-full flex items-center ${isShrunk ? 'justify-center gap-0 px-1 py-2' : 'gap-3 px-3 py-1.5'} mb-1 rounded-lg font-semibold text-sm transition-all duration-150 text-left cursor-pointer ${
          isActive
            ? "text-[var(--text-sidebar)] shadow-md"
            : "text-[var(--text-sidebar)] opacity-70 hover:opacity-100 hover:bg-slate-800/60"
        }`}
        style={isActive ? { backgroundColor: "var(--theme-secondary)" } : undefined}
        title={isShrunk ? item.label : undefined}
      >
        <div className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center shrink-0 ${
          isActive
            ? "bg-white/20 text-[var(--text-sidebar)] shadow-sm"
            : "bg-slate-800/80 text-[var(--text-sidebar)] opacity-70 group-hover:opacity-100 group-hover:bg-slate-700/60"
        }`}>
          <Icon size={16} strokeWidth={isActive ? 2.25 : 1.75} className="transition-transform duration-200 group-hover:scale-110" />
        </div>
        {!isShrunk && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  // ─── Operations Section ──────────────────────────────────────────────────
  const OperationsSection = () => {
    // In shrunk mode, show only a single icon button that navigates to /arc
    if (isShrunk) {
      return (
        <div className="mb-1">
          <button
            onClick={() => { setIsShrunk(false); setOpsOpen(true); }}
            title="Opetions"
            className={`group w-full flex items-center justify-center px-1 py-2 rounded-lg font-semibold text-sm transition-all duration-150 cursor-pointer ${
              isOpsActive
                ? "text-[var(--text-sidebar)] shadow-md"
                : "text-[var(--text-sidebar)] opacity-70 hover:opacity-100 hover:bg-slate-800/60"
            }`}
            style={isOpsActive ? { backgroundColor: "var(--theme-secondary)" } : undefined}
          >
            <div className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center shrink-0 ${
              isOpsActive
                ? "bg-white/20 shadow-sm"
                : "bg-slate-800/80 opacity-70 group-hover:opacity-100 group-hover:bg-slate-700/60"
            }`}>
              <Briefcase size={16} strokeWidth={isOpsActive ? 2.25 : 1.75} className="transition-transform duration-200 group-hover:scale-110" />
            </div>
          </button>
        </div>
      );
    }

    return (
      <div className="mb-2">
        {/* Operations header toggle */}
        <button
          onClick={() => setOpsOpen((v) => !v)}
          className={`group w-full flex items-center gap-3 px-3 py-0 mb-1 rounded-lg font-semibold text-sm transition-all duration-150 cursor-pointer ${
            opsOpen || isOpsActive
              ? "text-[var(--text-sidebar)] opacity-100"
              : "text-[var(--text-sidebar)] opacity-70 hover:opacity-100 hover:bg-slate-800/60"
          }`}
          style={isOpsActive && !opsOpen ? { backgroundColor: "rgba(217,53,45,0.18)" } : undefined}
        >
          {/* Icon */}
          <div className={`p-1.5 rounded-md transition-all duration-200 flex items-center justify-center shrink-0 ${
            opsOpen || isOpsActive
              ? "bg-[var(--theme-secondary)]/30 text-[var(--text-sidebar)]"
              : "bg-slate-800/80 text-[var(--text-sidebar)] opacity-70 group-hover:opacity-100 group-hover:bg-slate-700/60"
          }`}>
            <Briefcase size={16} strokeWidth={2} className="transition-transform duration-200 group-hover:scale-110" />
          </div>
          <span className="flex-1 truncate text-left">Operations</span>
         
          {opsOpen ? <ChevronUp size={13} className="shrink-0 opacity-60" /> : <ChevronDown size={13} className="shrink-0 opacity-60" />}
        </button>

        {/* Expanded panel */}
        {opsOpen && (
          <div className="ml-2 pl-2 border-l border-slate-700/60 space-y-1.5 pb-1">
            {OPERATIONS.map((grp) => {
              const GroupIcon = grp.icon;
              const acc = accentClasses[grp.color];
              const isGrpOpen = !!expandedOps[grp.id];
              const isGrpActive = grp.links.some((l) => location.pathname === l.path);

              return (
                <div key={grp.id}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleOpsGroup(grp.id)}
                    className={`group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                      isGrpActive
                        ? acc.active
                        : `text-[var(--text-sidebar)] opacity-60 hover:opacity-100 ${acc.hover}`
                    }`}
                  >
                    {/* Colored dot */}
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${acc.dot} ${isGrpActive ? 'opacity-100' : 'opacity-50 group-hover:opacity-80'}`} />
                    <div className={`p-1 rounded flex items-center justify-center shrink-0 ${acc.link}`}>
                      <GroupIcon size={12} strokeWidth={2} />
                    </div>
                    <span className="flex-1 text-left truncate tracking-wide uppercase text-[10px]">
                      {grp.label}
                    </span>
                    {isGrpOpen
                      ? <ChevronUp size={11} className="shrink-0 opacity-50" />
                      : <ChevronDown size={11} className="shrink-0 opacity-50" />
                    }
                  </button>

                  {/* Sub-links */}
                  {isGrpOpen && (
                    <div className="ml-3 mt-0.5 space-y-0.5 pl-2 border-l border-slate-700/40">
                      {grp.links.map((lnk, idx) => {
                        const LinkIcon = lnk.icon;
                        const isLinkActive = location.pathname === lnk.path;
                        const isLast = idx === grp.links.length - 1;

                        return (
                          <div key={lnk.id} className="relative">
                            {/* Step connector line (not on last) */}
                            {!isLast && (
                              <div className="absolute left-[-9px] top-[20px] bottom-[-4px] w-px bg-slate-700/40" />
                            )}

                            <button
                              onClick={() => { navigate(lnk.path); setIsOpen(false); }}
                              title={lnk.hint}
                              className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150 cursor-pointer ${
                                isLinkActive
                                  ? `${acc.active} opacity-100`
                                  : `text-[var(--text-sidebar)] opacity-50 hover:opacity-90 hover:bg-slate-800/50`
                              }`}
                            >
                              {/* Step number circle */}
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 transition-all ${
                                isLinkActive
                                  ? `${acc.dot} text-slate-900`
                                  : 'bg-slate-700/60 text-slate-400 group-hover:bg-slate-600/60'
                              }`}>
                                {idx + 1}
                              </span>
                              <LinkIcon size={11} strokeWidth={isLinkActive ? 2.5 : 2} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
                              <span className="truncate">{lnk.label}</span>
                              {idx < grp.links.length - 1 && (
                                <ArrowRight size={8} className="ml-auto shrink-0 opacity-30 group-hover:opacity-60 transition-opacity" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const NavContent = () => {
    // Split visibleMenuItems: dashboard first, then insert Operations, then rest
    const dashboardItem = visibleMenuItems.find((i) => i.id === "dashboard");
    const restItems = visibleMenuItems.filter((i) => i.id !== "dashboard");

    return (
      <div className="flex flex-col h-full overflow-hidden text-[var(--text-sidebar)] transition-colors duration-300" style={{ backgroundColor: "var(--theme-primary)" }}>
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
                <p className="font-black text-sm text-[var(--text-sidebar)] leading-tight tracking-tight">
                  {user?.company_name}
                </p>
                <p className="text-[9px] font-black uppercase tracking-widest leading-none mt-0.5" style={{ color: "var(--theme-secondary)" }}>
                  DeskManager
                </p>
              </div>
            )}
          </div>

          <button
            onClick={toggleShrunk}
            className="hidden lg:flex items-center justify-center p-1 hover:bg-slate-800/80 rounded text-[var(--text-sidebar)] opacity-50 hover:opacity-100 transition-all cursor-pointer shrink-0"
            title={isShrunk ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isShrunk ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav links */}
        <nav className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${isShrunk ? 'px-2' : 'px-3'} py-2`}>
          {visibleMenuItems.length === 0 ? (
            <div className="p-3 text-center text-xs font-semibold text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg my-2">
              {!isShrunk ? 'Nothing allowed to user' : 'No Access'}
            </div>
          ) : (
            <>
              {/* Dashboard */}
              {dashboardItem && <NavItem item={dashboardItem} />}

              {/* ── Operations section ── */}
              {/* {!isShrunk && (
                <div className="mt-1 mb-0.5 px-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 mb-1.5">Operations</p>
                </div>
              )} */}
              <OperationsSection />

              {/* Divider */}
              {!isShrunk && (
                <div className="my-2 mx-2 border-t border-slate-800/60" />
              )}

              {/* Rest of menu */}
              {restItems.map((item) => (
                <NavItem key={item.id} item={item} />
              ))}
            </>
          )}
        </nav>

        {/* User / Sign Out */}
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
                  <p className="font-bold text-xs text-[var(--text-sidebar)] truncate leading-tight">{user.username || "Operator"}</p>
                  <p className="text-[10px] font-semibold text-slate-400 truncate capitalize">{user.role || "Operator"}</p>
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
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800 text-[var(--text-sidebar)] sticky top-0 z-50 transition-colors duration-300" style={{ backgroundColor: "var(--theme-primary)" }}>
        <div className="flex items-center gap-2.5">
          <img src={logoImg} alt="Logo" className="w-9 h-9 object-contain rounded-lg" />
          <div>
            <p className="font-extrabold text-sm text-[var(--text-sidebar)] tracking-tight">{user?.company_name}</p>
            <p className="text-[8px] font-black uppercase tracking-widest leading-none" style={{ color: "var(--theme-secondary)" }}>DeskManager</p>
          </div>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-[var(--text-sidebar)] opacity-70 hover:opacity-100 hover:bg-slate-800 rounded-lg transition-all cursor-pointer">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-xs" />
      )}

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col ${isShrunk ? 'w-20' : 'w-64'} h-screen border-r border-slate-800 shrink-0 sticky top-0 transition-all duration-300`} style={{ backgroundColor: "var(--theme-primary)" }}>
        <NavContent />
      </aside>

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-slate-800 transform transition-transform duration-200 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ backgroundColor: "var(--theme-primary)" }}
      >
        <NavContent />
      </aside>
    </>
  );
}
