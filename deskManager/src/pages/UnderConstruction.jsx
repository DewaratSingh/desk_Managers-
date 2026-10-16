import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Construction, HardHat, Cone, Hammer, ArrowLeft, LayoutDashboard, ShieldAlert, Sparkles } from 'lucide-react';

export default function UnderConstruction({ sectionName, title, message }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract optional query params (e.g. /under-construction?section=Release%20Order)
  const searchParams = new URLSearchParams(location.search);
  const displaySection = sectionName || searchParams.get('section') || 'This Section';
  const displayTitle = title || searchParams.get('title') || `${displaySection} is Under Construction`;
  const displayMessage = message || searchParams.get('message') || 
    'Our development team is actively building this module. New features, workflows, and tools will be available here soon.';

  const stripePattern = {
    background: 'repeating-linear-gradient(-45deg, #facc15, #facc15 16px, #111827 16px, #111827 32px)',
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-100 text-slate-900 transition-colors">
      
      {/* Outer Card with Hazard Tape Accent */}
      <div className="w-full max-w-2xl bg-white border border-slate-300 rounded-2xl shadow-xl overflow-hidden relative">
        
        {/* Top Black & Yellow Hazard Strip */}
        <div className="h-5 w-full shadow-inner" style={stripePattern} />
        
        {/* Caution Ribbon Banner */}
        <div className="bg-amber-400 text-black font-black text-[11px] sm:text-xs py-1.5 px-4 tracking-widest uppercase flex items-center justify-around border-y border-amber-500 overflow-hidden select-none">
          <span className="flex items-center gap-1.5 shrink-0">
            <Cone size={14} className="text-black" /> CAUTION
          </span>
          <span className="hidden sm:inline">&bull;</span>
          <span className="shrink-0 font-extrabold tracking-wider">UNDER CONSTRUCTION</span>
          <span className="hidden sm:inline">&bull;</span>
          <span className="shrink-0 hidden md:inline">WORK IN PROGRESS</span>
          <span className="hidden sm:inline">&bull;</span>
          <span className="flex items-center gap-1.5 shrink-0">
            <Cone size={14} className="text-black" /> HARD HAT AREA
          </span>
        </div>

        {/* Card Content */}
        <div className="p-8 sm:p-12 text-center flex flex-col items-center">
          
          {/* Construction Icon Animation & Shield */}
          <div className="relative mb-6">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-amber-50 border-2 border-amber-300 flex items-center justify-center text-amber-600 shadow-md relative z-10">
              <Construction size={52} className="text-amber-500 animate-pulse" />
              <div className="absolute -bottom-2 -right-2 bg-amber-400 text-slate-950 p-2 rounded-xl shadow border border-amber-500">
                <HardHat size={20} />
              </div>
            </div>
            
            {/* Background Glow */}
            <div className="absolute inset-0 bg-amber-300/30 blur-2xl rounded-full -z-0" />
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 mb-4">
            <Hammer size={13} className="text-amber-700" />
            <span>Building in Progress</span>
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
            {displayTitle}
          </h1>

          {/* Subtitle / Message */}
          <p className="text-sm sm:text-base text-slate-600 max-w-lg leading-relaxed mb-8">
            {displayMessage}
          </p>

          {/* Diagonal Hazard Divider Strip */}
          <div className="w-3/4 h-2.5 rounded-full mb-8 shadow-inner" style={stripePattern} />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <ArrowLeft size={14} />
              Go Back
            </button>

            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-6 py-2.5 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:opacity-95"
              style={{ backgroundColor: 'var(--theme-color, #d9352d)' }}
            >
              <LayoutDashboard size={14} />
              Back to Dashboard
            </Link>
          </div>

          {/* Helpful Links */}
          <div className="mt-8 pt-6 border-t border-slate-200 w-full text-center">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Available Sections You Can Access:
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap text-xs">
              <Link
                to="/addProcessRfq"
                className="font-bold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-3 py-1 rounded-lg transition-colors"
              >
                Sell Process RFQ
              </Link>
              <Link
                to="/addRfq"
                className="font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1 rounded-lg transition-colors"
              >
                Standard RFQ
              </Link>
              <Link
                to="/inventory"
                className="font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1 rounded-lg transition-colors"
              >
                Inventory
              </Link>
            </div>
          </div>

        </div>

        {/* Bottom Black & Yellow Hazard Strip */}
        <div className="h-5 w-full shadow-inner" style={stripePattern} />

      </div>

    </div>
  );
}
