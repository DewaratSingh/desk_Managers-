import React, { useState, useEffect, useCallback } from "react";
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
  Activity,
  CloudUpload,
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
        permission: "sell_rfq:create"
      },
      {
        id: "ops-sell-ro",
        label: "Release Order",
        icon: FileOutput,
        path: "/addReleaseOrder",
        hint: "Create Release Order",
        permission: "ro:create"
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
        permission: "buy_rq:create"
      },
      {
        id: "ops-buy-contract",
        label: "Contract Order",
        icon: FileSignature,
        path: "/addContractOrder",
        hint: "Create Contract",
        permission: "buy_contract_order:create"
      },
    ],
  },
  // {
  //   id: "ops-sell-process",
  //   label: "Sell Process",
  //   icon: Cpu,
  //   color: "violet",
  //   links: [
  //     {
  //       id: "ops-sp-rfq",
  //       label: "RFQ",
  //       icon: Send,
  //       path: "/under-construction",
  //       hint: "Create RFQ",
  //       permission: "process_rq:create"
  //     },
  //     {
  //       id: "ops-sp-ro",
  //       label: "Release Order",
  //       icon: FileOutput,
  //       path: "/under-construction",
  //       hint: "Create Release Order",
  //       permission: "process_order:create"
  //     },
  //   ],
  // },
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
        path: "/addProcessReceivedQuotation",
        hint: "Create Received Quotation",
        permission: "process_rq:create"
      },
      {
        id: "ops-bp-contract",
        label: "Contract Order",
        icon: FileSignature,
        path: "/addProcessContractOrder",
        hint: "Create Contract Order",
        permission: "process_order:create"
      },
    ],
  },
];

// Maps color name → subtle accent dot and text classes
const accentClasses = {
  emerald: { dot: "bg-emerald-400", text: "text-emerald-400" },
  blue:    { dot: "bg-blue-400",    text: "text-blue-400" },
  violet:  { dot: "bg-violet-400",  text: "text-violet-400" },
  amber:   { dot: "bg-amber-400",   text: "text-amber-400" },
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

  // Backup overdue alert state for sidebar indicator
  const [backupOverdue, setBackupOverdue] = useState(false);
  const [backupInfo, setBackupInfo] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const evaluateBackupOverdue = (keys) => {
    if (!keys) return false;
    const { last_backup_date, alert_interval_seconds, alert_interval_days } = keys;
    const rawThreshold =
      alert_interval_seconds !== undefined && alert_interval_seconds !== null
        ? alert_interval_seconds
        : (alert_interval_days ? alert_interval_days * 86400 : 259200);

    const thresholdSec = (rawThreshold > 0 && rawThreshold < 86400) ? 259200 : rawThreshold;

    if (thresholdSec === 0) return false;
    if (!last_backup_date) return true;

    const elapsedSec = (Date.now() - new Date(last_backup_date).getTime()) / 1000;
    return elapsedSec >= thresholdSec;
  };

  const checkBackupStatus = useCallback(() => {
    fetch('/api/backup/keys')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.keys) {
          setBackupInfo(data.keys);
          setBackupOverdue(evaluateBackupOverdue(data.keys));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Fetches when app started
    checkBackupStatus();
    // Fetches every 3 hours instead of every 10 seconds
    const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
    const interval = setInterval(checkBackupStatus, THREE_HOURS_MS);
    const onStatusChange = () => checkBackupStatus();
    window.addEventListener('backup_status_changed', onStatusChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('backup_status_changed', onStatusChange);
    };
  }, [checkBackupStatus]);

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
    CloudUpload,
    Activity,
    Settings,
  };

  const defaultMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", permission: ["view_dashboard", "trades:view_all", "trades:search"] },
    { id: "purchase-order", label: "Order", icon: ClipboardList, path: "/order", permission: "orders:view_page" },
    { id: "add-customer", label: "Party", icon: Building2, path: "/party", permission: "parties:read" },
    { id: "add-buyer", label: "Contact", icon: UserPlus, path: "/buyer", permission: "contacts:read" },
    { id: "add-item", label: "Item", icon: Package, path: "/item", permission: "items:read" },
    { id: "inventory", label: "Inventory", icon: Warehouse, path: "/inventory", permission: "inventory:read" },
    { id: "manufacture", label: "Manufacture", icon: Factory, path: "/manufactures", permission: "manufacture:read" },
    { id: "arc", label: "ARC", icon: FileSignature, path: "/arc", permission: "arc:read" },
    { id: "gst-category", label: "GST Categories", icon: Percent, path: "/gst-category", permission: "gst:read" },
    { id: "users", label: "Users", icon: Users, path: "/users", permission: "users:read" },
    { id: "backup", label: "Backup", icon: CloudUpload, path: "/backup", permission: "backup:read" },
    { id: "monitor", label: "Monitor", icon: Activity, path: "/monitor", permission: "monitor:view" },
    { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
  ];

  const baseMenuItems = backendMenuItems
    ? backendMenuItems.map((item) => ({
        ...item,
        icon: typeof item.icon === 'string' ? (iconMap[item.icon] || LayoutDashboard) : item.icon,
      }))
    : defaultMenuItems;

  // Ensure Settings is always available if not provided by backend
  const combinedMenuItems = baseMenuItems.some((i) => i.id === "settings")
    ? baseMenuItems
    : [...baseMenuItems, { id: "settings", label: "Settings", icon: Settings, path: "/settings" }];

  // Deduplicate by ID to guarantee unique keys across all menu items
  const menuItems = Array.from(new Map(combinedMenuItems.map((item) => [item.id, item])).values());

  const visibleMenuItems = menuItems.filter(
    (item) => !item.permission || hasPermission(user, item.permission)
  );

  // Is any ops sub-link currently active?
  const isOpsActive = OPERATIONS.some((grp) =>
    grp.links.some((lnk) => location.pathname === lnk.path)
  );

  // ─── NavItem (standard) ─────────────────────────────────────────────────
  const renderNavItem = (item) => {
    const isActive =
      item.id === "dashboard"
        ? location.pathname === "/" ||
          location.pathname === "/dashboard" ||
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

    if (isShrunk) {
      return (
        <button
          key={item.id}
          onClick={() => { navigate(item.path); setIsOpen(false); }}
          className={`group relative w-10 h-10 mx-auto my-1 flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer ${
            isActive
              ? "shadow-sm text-white"
              : "hover:bg-white/10"
          }`}
          style={
            isActive
              ? { backgroundColor: "var(--theme-secondary)", color: "#ffffff" }
              : { color: "var(--text-sidebar)" }
          }
          title={item.label}
        >
          <div className="relative flex items-center justify-center">
            <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className="transition-transform duration-150 group-hover:scale-110" />
            {item.id === "backup" && backupOverdue && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </div>
        </button>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => { navigate(item.path); setIsOpen(false); }}
        className={`group w-full flex items-center gap-3 px-3 py-2 mb-1 rounded-xl text-sm transition-all duration-150 text-left cursor-pointer ${
          isActive
            ? "font-semibold shadow-sm text-white"
            : "font-medium hover:bg-white/10"
        }`}
        style={
          isActive
            ? { backgroundColor: "var(--theme-secondary)", color: "#ffffff" }
            : { color: "var(--text-sidebar)" }
        }
      >
        <div className="relative flex items-center justify-center shrink-0">
          <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className="transition-transform duration-150 group-hover:scale-110" />
          {item.id === "backup" && backupOverdue && (
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </div>
        <div className="flex items-center justify-between flex-1 min-w-0">
          <span className="truncate tracking-tight">{item.label}</span>
          {item.id === "backup" && backupOverdue && (
            <span className="ml-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-500/25 text-red-300 border border-red-500/40 animate-pulse shrink-0">
              Overdue
            </span>
          )}
        </div>
      </button>
    );
  };

  // ─── Operations Section ──────────────────────────────────────────────────
  const renderOperationsSection = () => {
    // Filter visible operation links by user permission
    const visibleOps = OPERATIONS.map(grp => ({
      ...grp,
      links: grp.links.filter(lnk => !lnk.permission || hasPermission(user, lnk.permission))
    })).filter(grp => grp.links.length > 0);

    if (visibleOps.length === 0) return null;
    // In shrunk mode, show a clean icon button
    if (isShrunk) {
      return (
        <div className="my-1">
          <button
            onClick={() => { setIsShrunk(false); setOpsOpen(true); }}
            title="Operations"
            className={`group relative w-10 h-10 mx-auto flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer ${
              isOpsActive
                ? "shadow-sm text-white"
                : "hover:bg-white/10"
            }`}
            style={
              isOpsActive
                ? { backgroundColor: "var(--theme-secondary)", color: "#ffffff" }
                : { color: "var(--text-sidebar)" }
            }
          >
            <Briefcase size={18} strokeWidth={isOpsActive ? 2.2 : 1.8} className="transition-transform duration-150 group-hover:scale-110" />
          </button>
        </div>
      );
    }

    return (
      <div className="mb-1">
        {/* Operations header toggle */}
        <button
          onClick={() => setOpsOpen((v) => !v)}
          className={`group w-full flex items-center gap-3 px-3 py-2 mb-1 rounded-xl text-sm transition-all duration-150 cursor-pointer ${
            opsOpen || isOpsActive
              ? "font-semibold"
              : "font-medium hover:bg-white/10"
          }`}
          style={{
            color: "var(--text-sidebar)",
            backgroundColor: isOpsActive && !opsOpen ? "color-mix(in srgb, var(--theme-secondary) 22%, transparent)" : undefined
          }}
        >
          <div className="flex items-center justify-center shrink-0">
            <Briefcase size={18} strokeWidth={opsOpen || isOpsActive ? 2.2 : 1.8} className="transition-transform duration-150 group-hover:scale-110" />
          </div>
          <span className="flex-1 truncate text-left tracking-tight">Operations</span>
          <span className="shrink-0 transition-transform duration-200 opacity-70 group-hover:opacity-100">
            {opsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </button>

        {/* Expanded panel with clean guide tree */}
        {opsOpen && (
          <div className="ml-3 pl-2.5 border-l border-white/10 space-y-1 my-1">
            {visibleOps.map((grp) => {
              const GroupIcon = grp.icon;
              const acc = accentClasses[grp.color] || accentClasses.emerald;
              const isGrpOpen = !!expandedOps[grp.id];
              const isGrpActive = grp.links.some((l) => location.pathname === l.path);

              return (
                <div key={grp.id} className="space-y-0.5">
                  {/* Group header */}
                  <button
                    onClick={() => toggleOpsGroup(grp.id)}
                    className={`group w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isGrpActive ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                    style={{ color: "var(--text-sidebar)" }}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${acc.dot}`} />
                    <GroupIcon size={14} strokeWidth={2} className="shrink-0 opacity-80 group-hover:opacity-100" />
                    <span className="flex-1 text-left truncate tracking-wide text-[11px]">
                      {grp.label}
                    </span>
                    <span className="shrink-0 opacity-60 group-hover:opacity-100">
                      {isGrpOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </span>
                  </button>

                  {/* Sub-links */}
                  {isGrpOpen && (
                    <div className="ml-3 pl-2.5 border-l border-white/10 space-y-0.5 py-0.5">
                      {grp.links.map((lnk) => {
                        const LinkIcon = lnk.icon;
                        const isLinkActive = location.pathname === lnk.path;

                        return (
                          <button
                            key={lnk.id}
                            onClick={() => { navigate(lnk.path); setIsOpen(false); }}
                            title={lnk.hint}
                            className={`group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 cursor-pointer text-left ${
                              isLinkActive
                                ? "font-semibold shadow-sm text-white"
                                : "font-medium hover:bg-white/10"
                            }`}
                            style={
                              isLinkActive
                                ? { backgroundColor: "var(--theme-secondary)", color: "#ffffff" }
                                : { color: "var(--text-sidebar)" }
                            }
                          >
                            <LinkIcon size={14} strokeWidth={isLinkActive ? 2.2 : 1.8} className="shrink-0 transition-transform duration-150 group-hover:scale-105" />
                            <span className="truncate">{lnk.label}</span>
                          </button>
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

  const renderNavContent = () => {
    // Split visibleMenuItems: dashboard first, then insert Operations, then rest
    const dashboardItem = visibleMenuItems.find((i) => i.id === "dashboard");
    const restItems = visibleMenuItems.filter((i) => i.id !== "dashboard");

    return (
      <div className="flex flex-col h-full overflow-hidden transition-colors duration-300" style={{ backgroundColor: "var(--theme-primary)", color: "var(--text-sidebar)" }}>
        {/* Brand */}
        <div className={`py-3.5 border-b border-white/10 flex items-center shrink-0 ${isShrunk ? 'px-2 justify-center gap-1.5' : 'px-4 justify-between'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoImg}
              alt="Logo"
              className={`${isShrunk ? 'w-8 h-8' : 'w-9 h-9'} object-contain shrink-0 rounded-lg transition-all duration-300`}
            />
            {!isShrunk && (
              <div className="min-w-0 truncate">
                <p className="font-bold text-sm leading-tight tracking-tight truncate" style={{ color: "var(--text-sidebar)" }}>
                  {user?.company_name}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none mt-1" style={{ color: "var(--theme-secondary)" }}>
                  DeskManager
                </p>
              </div>
            )}
          </div>

          <button
            onClick={toggleShrunk}
            className="hidden lg:flex items-center justify-center p-1.5 hover:bg-white/10 rounded-lg transition-all cursor-pointer shrink-0"
            style={{ color: "var(--text-sidebar)" }}
            title={isShrunk ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isShrunk ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav links */}
        <nav className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${isShrunk ? 'px-1.5' : 'px-3'} py-2.5 sidebar-scrollbar`}>
          {visibleMenuItems.length === 0 ? (
            <div className="p-3 text-center text-xs font-semibold text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl my-2">
              {!isShrunk ? 'Nothing allowed to user' : 'No Access'}
            </div>
          ) : (
            <>
              {/* Dashboard */}
              {dashboardItem && renderNavItem(dashboardItem)}

              {/* Operations section */}
              {renderOperationsSection()}

              {/* Divider */}
              {!isShrunk && (
                <div className="my-2 mx-1 border-t border-white/10" />
              )}

              {/* Rest of menu */}
              {restItems.map((item) => renderNavItem(item))}
            </>
          )}
        </nav>

        {/* User / Sign Out */}
        {user && (
          <div className={`shrink-0 ${isShrunk ? 'px-2 py-3' : 'px-3 py-3'} border-t border-white/10 bg-black/15 flex flex-col gap-2`}>
            <div className={`flex items-center ${isShrunk ? 'justify-center' : 'gap-2.5 px-1'} mb-0.5`}>
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--text-sidebar) 15%, transparent)",
                  color: "var(--text-sidebar)",
                  border: "1px solid color-mix(in srgb, var(--text-sidebar) 20%, transparent)"
                }}
                title={`${user.username} (${user.role})`}
              >
                {(user.username || "A")[0].toUpperCase()}
              </div>
              {!isShrunk && (
                <div className="overflow-hidden min-w-0">
                  <p className="font-semibold text-xs leading-tight truncate" style={{ color: "var(--text-sidebar)" }}>
                    {user.username || "Operator"}
                  </p>
                  <p className="text-[10px] font-medium leading-tight truncate capitalize opacity-70 mt-0.5" style={{ color: "var(--text-sidebar)" }}>
                    {user.role || "Operator"}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={onLogout}
              title={isShrunk ? "Sign Out" : undefined}
              className={`group w-full flex items-center ${isShrunk ? 'justify-center p-2' : 'justify-center gap-2 px-3 py-2'} bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 font-semibold text-xs rounded-xl transition-all duration-150 border border-red-500/25 cursor-pointer`}
            >
              <LogOut size={14} strokeWidth={2} className="transition-transform duration-150 group-hover:translate-x-0.5" />
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
      <div
        className="lg:hidden flex items-center justify-between p-4 border-b border-white/10 sticky top-0 z-50 transition-colors duration-300"
        style={{ backgroundColor: "var(--theme-primary)", color: "var(--text-sidebar)" }}
      >
        <div className="flex items-center gap-2.5">
          <img src={logoImg} alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
          <div>
            <p className="font-bold text-sm tracking-tight" style={{ color: "var(--text-sidebar)" }}>
              {user?.company_name}
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest leading-none mt-0.5" style={{ color: "var(--theme-secondary)" }}>
              DeskManager
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-white/10 rounded-lg transition-all cursor-pointer"
          style={{ color: "var(--text-sidebar)" }}
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div onClick={() => setIsOpen(false)} className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs" />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col ${isShrunk ? 'w-16' : 'w-64'} h-screen border-r border-white/10 shrink-0 sticky top-0 transition-all duration-300`}
        style={{ backgroundColor: "var(--theme-primary)" }}
      >
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-white/10 transform transition-transform duration-200 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ backgroundColor: "var(--theme-primary)" }}
      >
        {renderNavContent()}
      </aside>
    </>
  );
}
