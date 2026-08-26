import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  FileText,
  FileCheck,
  Truck,
  FileSpreadsheet,
  Boxes,
  Shield,
  Users,
  Zap,
  ArrowRight,
  Menu,
  X,
  TrendingUp,
  Check
} from 'lucide-react';
import logoImg from '../assets/image.jpeg';

export default function HomeView() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState('dashboard');

  useEffect(() => {
    // If user is already logged in, redirect them to dashboard
    const user = sessionStorage.getItem('user');
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSignIn = () => navigate('/login');
  const handleSignUp = () => navigate('/signup');

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const features = [
    {
      icon: Layers,
      title: "RFQ Management",
      desc: "Distribute technical requests to suppliers. Keep track of commercial bids, item specifications, and vendor deadlines."
    },
    {
      icon: FileText,
      title: "Quotation Management",
      desc: "Log and compare received vendor quotes. Check taxes, landing costs, packaging, and commercial terms instantly."
    },
    {
      icon: FileCheck,
      title: "Purchase Orders",
      desc: "Draft and dispatch legal POs directly tied to accepted quotations. Maintain complete revision histories."
    },
    {
      icon: Truck,
      title: "Delivery Notes",
      desc: "Log part dispatches, transport vehicle registrations, dispatch dates, and real-time delivery statuses."
    },
    {
      icon: FileSpreadsheet,
      title: "Invoice Management",
      desc: "Match vendor invoices to delivery dispatches. Track payments, verify GST breakdown, and automate audit prep."
    },
    {
      icon: Boxes,
      title: "Inventory Tracking",
      desc: "Maintain a unified inventory registry linked to drawing numbers, current levels, units, and reorder values."
    },
    {
      icon: Shield,
      title: "GRN Management",
      desc: "Generate Goods Receipt Notes on item arrival. Perform inspections and auto-update stock levels in one flow."
    },
    {
      icon: Users,
      title: "Customer & Buyer Management",
      desc: "Keep a centralized directory of customer profiles, contact directories, delivery coordinates, and trade terms."
    }
  ];

  const workflowSteps = [
    { id: "rfq", label: "RFQ", desc: "Define technical requirements & invite bids" },
    { id: "quote", label: "Quotation", desc: "Compare supplier prices & compute taxes" },
    { id: "po", label: "PO", desc: "Generate & authorize official orders" },
    { id: "delivery", label: "Delivery", desc: "Log dispatches & track vehicle numbers" },
    { id: "invoice", label: "Invoice", desc: "Verify incoming bills & log payments" },
    { id: "grn", label: "GRN", desc: "Validate materials & update inventory levels" }
  ];

  const benefits = [
    { title: "Reduced Paperwork", desc: "Replace physical files with structured, digital database records instantly searchables." },
    { title: "Faster Document Generation", desc: "Auto-fill items, client profiles, and tax classes to draft documents in clicks." },
    { title: "Centralized Data Management", desc: "Access trades, materials, purchase orders, and supplier catalogs from one workspace." },
    { title: "Inventory Visibility", desc: "Prevent stockouts and track material issues with live stock counters and warnings." },
    { title: "Easy Customer & Buyer Tracking", desc: "Review complete commercial relationships, outstanding pipelines, and delivery histories." },
    { title: "Increased Operational Efficiency", desc: "Eliminate double data entries and speed up verification loops with linked workflows." }
  ];

  // ERP Mockup Data Views
  const renderDashboardMockup = () => (
    <div className="space-y-4 text-slate-800 animate-fade-in">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active RFQs</span>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">12</p>
          <span className="text-[9px] text-green-600 font-bold flex items-center gap-0.5 mt-0.5">
            <TrendingUp size={10} /> +3 this week
          </span>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending Orders</span>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">8</p>
          <span className="text-[9px] text-slate-500 font-medium mt-0.5 block">Waiting dispatch</span>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Value</span>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">₹18.4L</p>
          <span className="text-[9px] text-[#D9352D] font-bold mt-0.5 block">Active trade pipeline</span>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Stock Health</span>
          <p className="text-xl font-extrabold text-slate-900 mt-0.5">98.2%</p>
          <span className="text-[9px] text-green-600 font-bold mt-0.5 block">Optimal levels</span>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Active Pipeline Trades</span>
          <span className="text-[9px] text-slate-400 font-bold uppercase">Real-Time</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold">
                <th className="px-4 py-2">Trade ID</th>
                <th className="px-4 py-2">Party</th>
                <th className="px-4 py-2 text-right">Delivered %</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              <tr>
                <td className="px-4 py-2.5 font-mono text-[#D9352D]">TR-2026-089</td>
                <td className="px-4 py-2.5">Shree Cement Ltd</td>
                <td className="px-4 py-2.5 text-right"><span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[9px] font-bold border border-green-200">100.0%</span></td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-green-50 text-green-700 border-green-200">Completed</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-[#D9352D]">TR-2026-090</td>
                <td className="px-4 py-2.5">Adani Power Ltd</td>
                <td className="px-4 py-2.5 text-right"><span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 text-[9px] font-bold border border-slate-200">0.0%</span></td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-indigo-50 text-indigo-700 border-indigo-200">Ordered</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-[#D9352D]">TR-2026-091</td>
                <td className="px-4 py-2.5">Larsen & Toubro</td>
                <td className="px-4 py-2.5 text-right"><span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 text-[9px] font-bold border border-slate-200">0.0%</span></td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-sky-50 text-sky-700 border-sky-200">Quotation</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-[#D9352D]">TR-2026-092</td>
                <td className="px-4 py-2.5">Tata Steel Ltd</td>
                <td className="px-4 py-2.5 text-right"><span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold border border-amber-200">25.0%</span></td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border bg-amber-50 text-amber-700 border-amber-200">Part Delivery</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderInventoryMockup = () => (
    <div className="space-y-4 text-slate-800 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-700">Unified Ledger Inventory</div>
        <div className="text-[10px] text-slate-400 font-semibold">Showing 4 of 1,248 Items</div>
      </div>

      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
                <th className="px-4 py-2.5">Item Code</th>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5">Drawing Ref</th>
                <th className="px-4 py-2.5 text-right">Current Stock</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              <tr>
                <td className="px-4 py-2.5 font-mono text-slate-900">PL-ST-004</td>
                <td className="px-4 py-2.5">MS Plate 12mm x 1500 x 3000</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">DRW-ME-042-R2</td>
                <td className="px-4 py-2.5 text-right font-mono">84 pcs</td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.25 rounded text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">In Stock</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-slate-900">TR-CU-012</td>
                <td className="px-4 py-2.5">Copper Tube 1/2" OD x 1.2mm thk</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">DRW-CH-910-R1</td>
                <td className="px-4 py-2.5 text-right font-mono">15 mtrs</td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.25 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Low Stock</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-slate-900">FT-SS-088</td>
                <td className="px-4 py-2.5">SS Flange 4" ANSI Class 150</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">DRW-PP-088-R0</td>
                <td className="px-4 py-2.5 text-right font-mono text-rose-600">0 pcs</td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.25 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Reorder</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-slate-900">SL-AL-023</td>
                <td className="px-4 py-2.5">Aluminum Channel 50x50x5</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">DRW-SL-023-R3</td>
                <td className="px-4 py-2.5 text-right font-mono">210 pcs</td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.25 rounded text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">In Stock</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderRfqMockup = () => (
    <div className="space-y-4 text-slate-800 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-700">Active Request For Quotations (RFQ)</div>
        <div className="text-[10px] text-slate-400 font-semibold">Active Bid Windows</div>
      </div>

      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
                <th className="px-4 py-2.5">RFQ ID</th>
                <th className="px-4 py-2.5">Supplier Name</th>
                <th className="px-4 py-2.5">Closing Date</th>
                <th className="px-4 py-2.5 text-right">Items Count</th>
                <th className="px-4 py-2.5">Bids Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              <tr>
                <td className="px-4 py-2.5 font-mono text-[#D9352D]">RFQ-2026-104</td>
                <td className="px-4 py-2.5">Apex Steel Corp</td>
                <td className="px-4 py-2.5">22 Jul 2026</td>
                <td className="px-4 py-2.5 text-right">5 spares</td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.25 rounded text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">3 Bids Received</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-[#D9352D]">RFQ-2026-105</td>
                <td className="px-4 py-2.5">Vardhman Fasteners</td>
                <td className="px-4 py-2.5">25 Jul 2026</td>
                <td className="px-4 py-2.5">12 items</td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.25 rounded text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200">1 Bid Received</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-[#D9352D]">RFQ-2026-106</td>
                <td className="px-4 py-2.5">Unitech Valves India</td>
                <td className="px-4 py-2.5">29 Jul 2026</td>
                <td className="px-4 py-2.5">3 items</td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.25 rounded text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-200">Draft</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-[#D9352D]">RFQ-2026-107</td>
                <td className="px-4 py-2.5">Gujarat Tubes & Pipes</td>
                <td className="px-4 py-2.5">20 Jul 2026</td>
                <td className="px-4 py-2.5">8 items</td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.25 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Pending Bids</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderInvoiceMockup = () => (
    <div className="space-y-4 text-slate-800 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-slate-700">Invoice Registry & GST Calculation</div>
        <div className="text-[10px] text-slate-400 font-semibold">Commercial Ledger</div>
      </div>

      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold">
                <th className="px-4 py-2.5">Invoice No</th>
                <th className="px-4 py-2.5">PO Reference</th>
                <th className="px-4 py-2.5 text-right">Basic Value</th>
                <th className="px-4 py-2.5 text-right">GST (18%)</th>
                <th className="px-4 py-2.5 text-right">Grand Total</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              <tr>
                <td className="px-4 py-2.5 font-mono text-slate-900">INV-26-0812</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">PO-2026-9810</td>
                <td className="px-4 py-2.5 text-right font-mono">₹3,50,000.00</td>
                <td className="px-4 py-2.5 text-right font-mono">₹63,000.00</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-900">₹4,13,000.00</td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.25 rounded text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">Paid</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-slate-900">INV-26-0813</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">PO-2026-9824</td>
                <td className="px-4 py-2.5 text-right font-mono">₹7,20,000.00</td>
                <td className="px-4 py-2.5 text-right font-mono">₹1,29,600.00</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-900">₹8,49,600.00</td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.25 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Unpaid</span></td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-slate-900">INV-26-0814</td>
                <td className="px-4 py-2.5 font-mono text-slate-500">PO-2026-9844</td>
                <td className="px-4 py-2.5 text-right font-mono">₹1,85,000.00</td>
                <td className="px-4 py-2.5 text-right font-mono">₹33,300.00</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-900">₹2,18,300.00</td>
                <td className="px-4 py-2.5"><span className="px-1.5 py-0.25 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Overdue</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const getActiveMockupContent = () => {
    switch (activePreviewTab) {
      case 'dashboard': return renderDashboardMockup();
      case 'inventory': return renderInventoryMockup();
      case 'rfq': return renderRfqMockup();
      case 'invoice': return renderInvoiceMockup();
      default: return renderDashboardMockup();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans select-none scroll-smooth">
      {/* Background Radial Glow Blobs */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#D9352D]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#D9352D]/3 rounded-full blur-3xl pointer-events-none" />

      {/* Header Sticky Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollToSection('hero')}>
            <img src={logoImg} alt="Desk Manager Logo" className="w-10 h-10 object-contain rounded-xl shadow-sm border border-slate-100" />
            <div>
              <p className="font-extrabold text-sm text-slate-900 leading-tight tracking-tight">Shreeji Industries</p>
              <p className="text-[9px] font-black uppercase tracking-widest leading-none mt-0.5 text-[#D9352D]">DeskManager</p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-slate-600">
            <button onClick={() => scrollToSection('features')} className="hover:text-slate-900 transition-colors cursor-pointer">Features</button>
            <button onClick={() => scrollToSection('workflow')} className="hover:text-slate-900 transition-colors cursor-pointer">Workflow</button>
            <button onClick={() => scrollToSection('benefits')} className="hover:text-slate-900 transition-colors cursor-pointer">Benefits</button>
            <button onClick={() => scrollToSection('pricing')} className="hover:text-slate-900 transition-colors cursor-pointer">Pricing</button>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={handleSignIn}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-50 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={handleSignUp}
              className="px-4 py-2 text-white font-bold text-xs rounded-xl shadow-md hover:opacity-90 active:scale-95 transition-all cursor-pointer bg-[#D9352D]"
            >
              Get Started
            </button>
          </div>

          {/* Mobile Menu Icon */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Nav Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-lg flex flex-col gap-3.5 text-xs font-bold uppercase tracking-wider text-slate-700 animate-fade-in">
            <button onClick={() => scrollToSection('features')} className="text-left py-1 hover:text-slate-950 transition-colors">Features</button>
            <button onClick={() => scrollToSection('workflow')} className="text-left py-1 hover:text-slate-950 transition-colors">Workflow</button>
            <button onClick={() => scrollToSection('benefits')} className="text-left py-1 hover:text-slate-950 transition-colors">Benefits</button>
            <button onClick={() => scrollToSection('pricing')} className="text-left py-1 hover:text-slate-950 transition-colors">Pricing</button>
            <div className="border-t border-slate-100 pt-3 flex gap-3">
              <button
                onClick={handleSignIn}
                className="flex-1 py-2 text-center border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
              >
                Sign In
              </button>
              <button
                onClick={handleSignUp}
                className="flex-1 py-2 text-center text-white bg-[#D9352D] hover:opacity-90 rounded-xl transition-all shadow-sm"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section id="hero" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 md:py-24 flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200/60 rounded-full text-[10px] font-bold uppercase tracking-wider text-[#D9352D]">
            <Zap size={11} />
            <span>Industrial Operations System</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight">
            Factory Operations, <br className="hidden sm:inline" />
            <span className="text-[#D9352D]">Simplified</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
            Manage RFQs, Quotations, Purchase Orders, Deliveries, Invoices, Inventory, and GRNs from one centralized platform. Designed specifically for manufacturers, distributors, and factory floors.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
            <button
              onClick={handleSignUp}
              className="w-full sm:w-auto px-8 py-3.5 text-white font-bold text-sm rounded-xl bg-[#D9352D] hover:opacity-90 shadow-lg shadow-red-500/10 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight size={15} />
            </button>
            <button
              onClick={handleSignIn}
              className="w-full sm:w-auto px-8 py-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Hero Right Dashboard Mockup Frame */}
        <div className="flex-1 w-full max-w-xl relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#D9352D]/10 to-indigo-500/10 rounded-3xl blur-2xl pointer-events-none" />
          <div className="relative bg-white border border-slate-200/80 rounded-3xl p-5 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-red-400 rounded-full" />
                <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full" />
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full" />
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">ERP Console Overview</span>
            </div>
            
            {/* Live mockup content */}
            <div className="mt-4">
              {renderDashboardMockup()}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-20 bg-slate-100 border-t border-b border-slate-200/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Built for Industrial Scale & Precision</h2>
            <p className="text-sm text-slate-600 font-medium leading-relaxed">
              DeskManager streamlines each link in your procurement chain, eliminating double entries, tracking materials, and accelerating vendor approvals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div
                  key={idx}
                  className="group bg-white rounded-2xl p-5 border border-slate-200/50 shadow-sm hover:shadow-md hover:border-[#D9352D]/40 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 group-hover:bg-red-50 group-hover:border-red-100 transition-colors">
                    <Icon className="text-slate-500 group-hover:text-[#D9352D] transition-colors" size={18} style={{ color: 'var(--theme-color)' }} />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900 mb-2">{feat.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workflow Section (Timeline) */}
      <section id="workflow" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-200/60 rounded-full text-[10px] font-bold uppercase tracking-wider text-[#D9352D]">
              <span>Procurement Cycle</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">The Linked Document Workflow</h2>
            <p className="text-sm text-slate-600 font-medium">
              Watch your materials pass seamlessly from engineering requisitions to invoice ledger settlement.
            </p>
          </div>

          {/* Visual Workflow Cards / Timeline */}
          <div className="relative">
            {/* Desktop horizontal connecting track line */}
            <div className="hidden lg:block absolute top-[44px] left-[5%] right-[5%] h-0.5 bg-slate-200 -z-0" />

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 relative z-10">
              {workflowSteps.map((step, idx) => (
                <div key={idx} className="flex flex-col items-center text-center group">
                  {/* Step Bubble Counter */}
                  <div className="w-12 h-12 rounded-full border border-slate-200 shadow-sm bg-white flex items-center justify-center text-slate-800 text-xs font-black mb-4 group-hover:border-[#D9352D] group-hover:bg-red-50/50 group-hover:text-[#D9352D] transition-all duration-200">
                    0{idx + 1}
                  </div>
                  
                  {/* Step Card Content */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 w-full group-hover:bg-white group-hover:shadow-md group-hover:border-[#D9352D]/40 transition-all duration-200">
                    <h3 className="text-xs font-extrabold text-slate-900 mb-1">{step.label}</h3>
                    <p className="text-[10px] text-slate-500 leading-normal font-semibold">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 bg-slate-100 border-t border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 space-y-6">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                Designed to Streamline Your Factory Floor Requisitions
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Traditional factory desk logs rely on disparate files, paper binders, and delayed communications. DeskManager solves this with localized tracking, automated calculations, and unified document linkage.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {benefits.map((benefit, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="p-1.5 h-fit rounded-lg bg-green-50 border border-green-200 text-green-700 shrink-0">
                      <Check size={14} className="stroke-[3px]" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-800">{benefit.title}</h4>
                      <p className="text-[10px] text-slate-500 font-semibold mt-1 leading-relaxed">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Testimonial Quote Banner */}
            <div className="flex-1 w-full bg-slate-900 rounded-3xl p-8 text-slate-200 border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[#D9352D]/10 rounded-full blur-2xl pointer-events-none" />
              <div className="inline-flex p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 mb-6">
                <Shield size={16} />
              </div>
              <h3 className="text-lg font-bold text-white mb-4">Secured On-Premise Audit Trials</h3>
              <blockquote className="border-l-2 border-[#D9352D] pl-4 py-1 italic text-slate-300 text-xs font-semibold leading-relaxed">
                "By hosting DeskManager internally, our factory logs maintain 100% data sovereignty without external internet delays. Generating delivery dispatches now takes seconds instead of hours."
              </blockquote>
              <div className="flex items-center gap-3 mt-8">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-white uppercase">
                  DM
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white">Director of Procurement</p>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Shreeji Industries &bull; 2026</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section (Tabbed mockup views) */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Interactive Platform Demo</h2>
            <p className="text-sm text-slate-600 font-medium">
              Explore the clean, structured modules inside the Desk Manager software. Click through modules to view live data frames.
            </p>
          </div>

          {/* Tab Selector Buttons */}
          <div className="flex flex-wrap justify-center gap-2 mb-8 border-b border-slate-100 pb-5">
            {[
              { id: 'dashboard', label: 'Dashboard Module' },
              { id: 'inventory', label: 'Inventory Module' },
              { id: 'rfq',       label: 'RFQ Module' },
              { id: 'invoice',   label: 'Invoice Module' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActivePreviewTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activePreviewTab === tab.id
                    ? 'text-white shadow-sm'
                    : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/60'
                }`}
                style={activePreviewTab === tab.id ? { backgroundColor: 'var(--theme-color)' } : undefined}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* High Fidelity Mockup Window Container */}
          <div className="max-w-4xl mx-auto border border-slate-200/80 rounded-2xl bg-white shadow-xl shadow-slate-100 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-300 block" />
                <span className="w-3 h-3 rounded-full bg-slate-300 block" />
                <span className="w-3 h-3 rounded-full bg-slate-300 block" />
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Desk Manager App // {activePreviewTab.toUpperCase()}
              </span>
            </div>
            
            <div className="p-6 bg-white">
              {getActiveMockupContent()}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-slate-100 border-t border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Transparent Pricing For Growing Factories</h2>
            <p className="text-sm text-slate-600 font-medium">
              Start digitalizing your operations with a zero-risk trial. Upgrade or adjust anytime.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-lg relative overflow-hidden group hover:border-[#D9352D]/60 transition-colors duration-300">
              <div className="absolute top-0 right-0 bg-[#D9352D] text-white text-[9px] font-black uppercase tracking-wider py-1 px-4 rounded-bl-xl shadow-sm">
                No Credit Card Required
              </div>

              <div className="space-y-4 text-center pb-6 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900">15-Day Free Trial</h3>
                <div className="flex justify-center items-baseline text-slate-900">
                  <span className="text-4xl font-black">₹0</span>
                  <span className="text-xs font-semibold text-slate-500 ml-1">/ 15 days</span>
                </div>
                <p className="text-xs font-semibold text-slate-600">
                  Experience full operations coordination inside your local office network.
                </p>
              </div>

              <ul className="space-y-3.5 my-6 text-xs text-slate-600 font-semibold">
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-green-600 stroke-[3px]" />
                  <span>Full access to all DeskManager modules</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-green-600 stroke-[3px]" />
                  <span>RFQ and quotation comparison workflows</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-green-600 stroke-[3px]" />
                  <span>Purchase order & dispatch release processing</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-green-600 stroke-[3px]" />
                  <span>Invoice matching & GRN updating logs</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-green-600 stroke-[3px]" />
                  <span>Unified warehouse inventory registry</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check size={14} className="text-green-600 stroke-[3px]" />
                  <span>Dedicated email & setup documentation support</span>
                </li>
              </ul>

              <button
                onClick={handleSignUp}
                className="w-full py-3.5 rounded-xl font-bold text-xs text-white text-center shadow-md hover:opacity-90 active:scale-98 transition-all bg-[#D9352D] cursor-pointer"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Call To Action Banner */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="bg-slate-900 rounded-3xl p-8 md:p-12 border border-slate-800 shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-[#D9352D]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Ready to Streamline Your Factory Operations?
            </h2>
            <p className="text-slate-400 text-xs md:text-sm max-w-lg mx-auto leading-relaxed font-semibold">
              Start your free trial today and manage your entire procurement and inventory workflow from one platform.
            </p>
            <div className="pt-2">
              <button
                onClick={handleSignUp}
                className="px-8 py-3.5 text-white font-bold text-sm rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 mx-auto cursor-pointer shadow-lg bg-[#D9352D]"
              >
                <span>Get Started Now</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 text-slate-500 text-xs font-semibold">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-left">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <img src={logoImg} alt="Desk Manager Logo" className="w-7 h-7 object-contain rounded" />
                <span className="text-slate-700 font-extrabold">Shreeji Industries</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                Digitalizing procurement and tracking for manufacturers and industrial desks.
              </p>
            </div>
            <div>
              <h4 className="text-slate-900 font-bold uppercase tracking-wider mb-3 text-[10px]">Product</h4>
              <ul className="space-y-2 font-medium">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-slate-700 cursor-pointer">Features</button></li>
                <li><button onClick={() => scrollToSection('workflow')} className="hover:text-slate-700 cursor-pointer">Workflow</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-slate-700 cursor-pointer">Pricing</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-slate-900 font-bold uppercase tracking-wider mb-3 text-[10px]">Company</h4>
              <ul className="space-y-2 font-medium">
                <li><button onClick={() => scrollToSection('benefits')} className="hover:text-slate-700 cursor-pointer">About Us</button></li>
                <li><a href="mailto:support@shreeji.com" className="hover:text-slate-700">Contact Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-slate-900 font-bold uppercase tracking-wider mb-3 text-[10px]">Legal</h4>
              <ul className="space-y-2 font-medium">
                <li><a href="#" className="hover:text-slate-700">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-slate-700">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>&copy; {new Date().getFullYear()} Shreeji Industries. All rights reserved. Operator Console v1.1.0</p>
            <div className="flex gap-4 text-slate-400">
              <span>LAN Server Status: Active</span>
              <span>&bull;</span>
              <span>Local Access Protected</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
