import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Layers,
  ArrowRight,
  Shield,
  Activity,
  Briefcase,
  Zap,
  TrendingUp,
  Boxes,
  ClipboardCheck,
  FileCheck
} from 'lucide-react';
import logoImg from '../assets/image.jpeg';

export default function HomeView() {
  const navigate = useNavigate();

  useEffect(() => {
    // If user is already logged in, redirect them to dashboard
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleSignIn = () => navigate('/login');
  const handleSignUp = () => navigate('/signup');

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const features = [
    {
      icon: Layers,
      title: "RFQ & Quotation Tracking",
      desc: "Manage customer requests and commercial bids. Compare quotes instantly to secure the best rates."
    },
    {
      icon: FileText,
      title: "Purchase & Release Orders",
      desc: "Draft, update, and manage POs/ROs. Keep tabs on order histories, item quantities, and vendor details."
    },
    {
      icon: FileCheck,
      title: "Delivery & Invoice Workflows",
      desc: "Generate delivery notes, link invoices, track dispatches, vehicle registrations, and shipping details."
    },
    {
      icon: Boxes,
      title: "Unified Item Inventory",
      desc: "Store detailed specifications including item codes, long descriptions, drawings, and stock levels."
    },
    {
      icon: Activity,
      title: "Live Operations Dashboard",
      desc: "Overview of your pending and completed trades, status panels, active RFQs, and purchase tracking."
    },
    {
      icon: Shield,
      title: "LAN-Secured Console",
      desc: "Designed for localized operations. Your data stays internal, highly secure, and accessible on your local network."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans select-none scroll-smooth">
      {/* Background Decorative Blur Blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Sticky Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Logo" className="w-10 h-10 object-contain rounded-xl shadow-sm border border-slate-100" />
            <div>
              <p className="font-extrabold text-sm text-slate-900 leading-tight tracking-tight">Shreeji Industries</p>
              <p className="text-[9px] font-black uppercase tracking-widest leading-none mt-0.5" style={{ color: 'var(--theme-color)' }}>DeskManager</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <button onClick={() => scrollToSection('features')} className="hover:text-slate-900 transition-colors cursor-pointer">Features</button>
            <button onClick={() => scrollToSection('about')} className="hover:text-slate-900 transition-colors cursor-pointer">About System</button>
            <button onClick={() => scrollToSection('architecture')} className="hover:text-slate-900 transition-colors cursor-pointer">Architecture</button>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSignIn}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-50 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={handleSignUp}
              className="px-4 py-2 text-white font-bold text-xs rounded-xl hover:opacity-90 shadow-md active:scale-95 transition-all cursor-pointer"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 md:py-28 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 space-y-6 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200/60 rounded-full text-xs font-semibold" style={{ color: 'var(--theme-color)' }}>
            <Zap size={13} />
            <span>Industrial Information System</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight">
            Streamline Your <br />
            <span style={{ color: 'var(--theme-color)' }}>Industrial Desk</span> Management
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed">
            A comprehensive web application engineered to coordinate quotes, RFQs, purchase orders, delivery notes, and inventory status in one responsive LAN-secured platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 pt-2">
            <button
              onClick={handleSignUp}
              className="w-full sm:w-auto px-8 py-3.5 text-white font-bold text-sm rounded-xl hover:opacity-90 shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              <span>Setup Operator Account</span>
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => scrollToSection('features')}
              className="w-full sm:w-auto px-8 py-3.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl transition-all flex items-center justify-center cursor-pointer"
            >
              Explore Modules
            </button>
          </div>
        </div>

        {/* Hero Interactive UI Card Mockup */}
        <div className="flex-1 w-full max-w-lg relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-red-500/10 to-indigo-500/10 rounded-3xl blur-2xl pointer-events-none" />
          <div className="relative bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xl shadow-slate-200/50">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded-full" />
                <div className="w-3 h-3 bg-yellow-400 rounded-full" />
                <div className="w-3 h-3 bg-green-400 rounded-full" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">Operator Hub</span>
            </div>
            
            {/* Mockup Stats */}
            <div className="grid grid-cols-2 gap-4 my-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs text-slate-400 font-bold uppercase">Pending RFQs</span>
                <p className="text-2xl font-black text-slate-900 mt-1">12</p>
                <span className="text-[10px] text-green-500 font-bold flex items-center gap-0.5 mt-1">
                  <TrendingUp size={10} /> +4 this week
                </span>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs text-slate-400 font-bold uppercase">Inventory Items</span>
                <p className="text-2xl font-black text-slate-900 mt-1">1,248</p>
                <span className="text-[10px] text-slate-500 font-bold mt-1 block">Active drawing records</span>
              </div>
            </div>

            {/* Mockup Action Item */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100/60 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center" style={{ color: 'var(--theme-color)' }}>
                    <ClipboardCheck size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">PO-2026-9810</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Shreeji &rarr; Vendor dispatch</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full uppercase tracking-wider">Ordered</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">RFQ-2026-004</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Techno-commercial bid pending</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Open</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Grid Section */}
      <section id="features" className="py-20 bg-slate-100 border-t border-b border-slate-200/60 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Built Specifically for Industrial Workflows</h2>
            <p className="text-slate-600 font-medium">
              DeskManager consolidates every stage of industrial trade, keeping inventory synced and paperwork organized.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div key={idx} className="group bg-white rounded-2xl p-6 border border-slate-200/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-5 group-hover:bg-red-50 group-hover:border-red-100 transition-colors">
                    <Icon className="text-slate-500 group-hover:text-red-500 transition-colors" size={20} style={{ color: 'var(--theme-color)' }} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{feat.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Info / About Section */}
      <section id="about" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">The Shreeji Industries Information System</h2>
            <p className="text-slate-600 leading-relaxed font-medium">
              The DeskManager system was designed to resolve critical pain points in industrial trade tracking. Instead of relying on scattered spreadsheets and physical drawing logs, the platform integrates technical drawing references, GST categories, buyer contacts, and multi-stage invoice matching.
            </p>
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-green-100 text-green-700 mt-0.5"><Zap size={14} /></div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">Complete Traceability</h4>
                  <p className="text-xs text-slate-500 font-medium">Trace an order from RFQ, Quotation, Purchase/Release Order, to Delivery Note and Invoice.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-green-100 text-green-700 mt-0.5"><Zap size={14} /></div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">Precision Pricing & GST calculation</h4>
                  <p className="text-xs text-slate-500 font-medium">Pre-load tax and packing configuration to ensure error-free bills of materials.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex-1 bg-slate-900 rounded-3xl p-8 text-slate-200 border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/20 rounded-full blur-2xl" />
            <h3 className="text-xl font-bold text-white mb-4">Why operators love DeskManager</h3>
            <blockquote className="border-l-2 border-red-500 pl-4 py-1 my-4 italic text-slate-300 text-sm font-medium">
              "Transitioning our release order processing to DeskManager cut down manual search times for drawing numbers from hours to seconds. The system auto-links trades flawlessly."
            </blockquote>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-6">Internal Audit Console &bull; 2026</p>
          </div>
        </div>
      </section>

      {/* Network Security / Architecture Section */}
      <section id="architecture" className="py-20 bg-slate-900 text-slate-100 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-semibold text-slate-400">
              <Shield size={12} className="text-slate-300" />
              <span>Internal Operations Architecture</span>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white">Local LAN Security & Stability</h2>
            <p className="text-slate-400 font-medium">
              Designed as an on-premises enterprise platform, DeskManager offers industrial safety and lightning-fast speeds on the local office network.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-800">
              <h3 className="text-3xl font-black text-white">100%</h3>
              <p className="text-sm font-bold text-slate-400 mt-2">Data Sovereignty</p>
              <p className="text-xs text-slate-500 mt-2 font-medium">Stored securely in the local PostgreSQL cluster inside the factory walls.</p>
            </div>
            <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-800">
              <h3 className="text-3xl font-black text-white">&lt; 10ms</h3>
              <p className="text-sm font-bold text-slate-400 mt-2">Latency Response</p>
              <p className="text-xs text-slate-500 mt-2 font-medium">Bypasses external internet delays for direct database reads.</p>
            </div>
            <div className="p-6 bg-slate-800/40 rounded-2xl border border-slate-800">
              <h3 className="text-3xl font-black text-white">8 Hour</h3>
              <p className="text-sm font-bold text-slate-400 mt-2">Token Sessions</p>
              <p className="text-xs text-slate-500 mt-2 font-medium">Automated session expiry checks safeguard inactive terminals.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Signup Banner */}
      <section className="py-20 max-w-4xl mx-auto px-4 text-center">
        <div className="bg-slate-900 rounded-3xl p-8 md:p-12 border border-slate-800 shadow-xl space-y-6 relative overflow-hidden">
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-red-500/10 rounded-full blur-2xl" />
          <h2 className="text-2xl md:text-3xl font-black text-white">Ready to digitalize your desk files?</h2>
          <p className="text-slate-400 text-sm max-w-lg mx-auto font-medium">
            Setup an operator profile and begin linking RFQs, POs, and invoicing schedules seamlessly today.
          </p>
          <div className="pt-2">
            <button
              onClick={handleSignUp}
              className="px-8 py-3.5 text-white font-bold text-sm rounded-xl hover:opacity-90 shadow-md active:scale-95 transition-all flex items-center gap-2 mx-auto cursor-pointer"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              <span>Create Account</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-slate-500 text-xs font-semibold">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Logo" className="w-6 h-6 object-contain rounded" />
            <span className="text-slate-700">Shreeji Industries DeskManager</span>
          </div>
          <p>&copy; {new Date().getFullYear()} Shreeji Industries. All rights reserved. Operator Console v1.1.0</p>
        </div>
      </footer>
    </div>
  );
}
