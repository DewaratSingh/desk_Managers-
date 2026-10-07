import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Box, Move, GitCommit, GitBranch, MapPin, Tag, Briefcase } from 'lucide-react';
import { toast } from 'react-toastify';

const renderIconForStep = (step) => {
  if (step.type === 'BUY') return <Briefcase size={20} className="text-blue-500" />;
  if (step.type === 'PROCESS_PO' || step.action === 'Manufacture Production') return <GitBranch size={20} className="text-purple-500" />;
  return <GitCommit size={20} className="text-amber-500" />;
};

const getStepTitle = (step) => {
  if (step.type === 'BUY') return 'Purchased Stock';
  if (step.action === 'Manufacture Production') return 'Manufacture Production';
  if (step.type) return step.type;
  return 'Trace Activity';
};

// A recursive component that renders a linear sequence of history steps.
// If a step contains 'sources', it branches horizontally.
const HistoryBranch = ({ historyArray }) => {
  if (!Array.isArray(historyArray) || historyArray.length === 0) {
    return null;
  }

  // We want to render latest-first (top to bottom), so we reverse the chronological array
  const reversedHistory = [...historyArray].reverse();

  return (
    <div className="flex flex-col items-center relative">
      {reversedHistory.map((step, idx) => {
        const hasSources = Array.isArray(step.sources) && step.sources.length > 0;
        const isLast = idx === reversedHistory.length - 1 && !hasSources;

        return (
          <div key={idx} className="flex flex-col items-center w-full">
            {/* The Node Card */}
            <div className="bg-white border border-slate-200 shadow-md rounded-2xl w-[320px] relative z-10 transition-transform hover:-translate-y-1 hover:shadow-xl hover:border-slate-300 cursor-default animate-fade-in-up">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="bg-white p-2 rounded-xl shadow-xs border border-slate-100">
                    {renderIconForStep(step)}
                  </div>
                  <span className="font-black text-sm text-slate-700">{getStepTitle(step)}</span>
                </div>
                {step.date && (
                  <div className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-200">
                    {new Date(step.date).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="p-4 bg-white rounded-b-2xl">
                <div className="space-y-2">
                  {Object.entries(step).map(([key, val]) => {
                    // Skip internal/UI keys
                    if (key === 'type' || key === 'date' || key === 'action' || key === 'sources') return null;
                    if (val === null || val === undefined) return null;
                    return (
                      <div key={key} className="flex justify-between items-start text-xs border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                        <span className="font-bold text-slate-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="font-semibold text-slate-800 text-right font-mono bg-slate-50 px-1.5 py-0.5 rounded ml-2 break-all">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* If it has sources, draw the branching split */}
            {hasSources && (
              <div className="flex flex-col items-center w-full mt-0">
                {/* Vertical stem down to the horizontal spine */}
                <div className="w-0.5 h-6 bg-slate-300 relative z-0"></div>
                
                {/* Horizontal Spine connecting all children */}
                <div className="flex justify-center relative w-full px-[160px]"> {/* px is half card width approx to align borders */}
                  {/* The actual horizontal line drawn absolutely across the flex container */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-300 z-0" 
                       style={{ 
                         left: 'calc(50% / ' + step.sources.length + ')', 
                         right: 'calc(50% / ' + step.sources.length + ')' 
                       }} 
                  />
                  
                  <div className="flex flex-row justify-center gap-12 w-full pt-6 relative z-10">
                    {step.sources.map((srcArray, srcIdx) => (
                      <div key={srcIdx} className="flex flex-col items-center relative">
                        {/* Vertical line connecting the child up to the horizontal spine */}
                        <div className="w-0.5 h-6 bg-slate-300 absolute -top-6"></div>
                        <HistoryBranch historyArray={srcArray} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Connecting line to the next sequential step (if no sources and not last) */}
            {!isLast && !hasSources && (
              <div className="w-0.5 h-10 bg-slate-200 relative z-0"></div>
            )}
            
          </div>
        );
      })}
    </div>
  );
};

export default function TraceHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Pan interaction states
  const [isPanning, setIsPanning] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchTraceData();
    
    // Center the view on load
    setPosition({
      x: 0, 
      y: 50
    });
  }, [id]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e) => {
      e.preventDefault(); // Stop browser page zoom
      const zoomSensitivity = 0.001;
      setScale(prevScale => {
        let newScale = prevScale - (e.deltaY * zoomSensitivity);
        return Math.min(Math.max(0.1, newScale), 3);
      });
    };

    // passive: false is required so preventDefault() works
    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  const fetchTraceData = async () => {
    try {
      const res = await fetch(`/api/inventory/trace/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.history === 'string') {
          data.history = JSON.parse(data.history);
        }
        setTraceData(data);
      } else {
        toast.error('Failed to fetch trace history');
        navigate('/inventory');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error loading trace history');
    } finally {
      setLoading(false);
    }
  };

  const handleMouseDown = (e) => {
    setIsPanning(true);
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPosition({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden relative">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 shadow-sm relative">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/inventory')}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Box size={22} className="text-amber-600" />
              Trace Genealogy Tree
            </h1>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Trace ID: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">TR-{id}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <Move size={14} className="text-slate-500" />
          Scroll to zoom, drag to pan
        </div>
      </div>

      {/* Panning Canvas Area */}
      <div 
        ref={containerRef}
        className={`flex-1 relative overflow-hidden bg-[#fafafa] transition-colors ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `calc(50% + ${position.x}px) ${position.y}px`
        }}
      >
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-bold text-sm">
            Loading Tree...
          </div>
        ) : !traceData ? (
          <div className="absolute inset-0 flex items-center justify-center text-rose-500 font-bold text-sm">
            Could not load trace data.
          </div>
        ) : (
          <div 
            className="absolute left-1/2 origin-top transition-transform duration-75 ease-linear"
            style={{ 
              transform: `translate(calc(-50% + ${position.x}px), ${position.y}px) scale(${scale})`,
              width: 'max-content'
            }}
          >
            
            {/* The Main Tree Layout */}
            <div className="flex flex-col items-center">

              {/* Root Node: Current Trace Details */}
              <div className="bg-white border-2 border-amber-300 shadow-xl rounded-2xl w-[360px] relative z-10 animate-fade-in-up">
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-5 py-3 rounded-t-xl flex justify-between items-center">
                  <span className="font-black tracking-wide text-sm flex items-center gap-2">
                    <Box size={16} /> CURRENT TRACE
                  </span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs font-mono font-bold">TR-{traceData.id}</span>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-end border-b border-slate-100 pb-3">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Item Code</div>
                      <div className="font-black text-slate-800 text-base">{traceData.item_code}</div>
                      <div className="text-xs text-slate-500 font-medium leading-tight mt-1">{traceData.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quantity</div>
                      <div className="font-mono font-black text-amber-600 text-xl">{parseFloat(traceData.qty)}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1">
                        <MapPin size={12} /> Location Bin
                      </div>
                      <div className="text-sm font-semibold text-slate-800">{traceData.location}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1">
                        <Tag size={12} /> Cost Price
                      </div>
                      <div className="text-sm font-semibold font-mono text-slate-800">₹{parseFloat(traceData.cost_price || 0).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connecting Line from Root Node down to History */}
              {Array.isArray(traceData.history) && traceData.history.length > 0 && (
                <div className="w-1 h-10 bg-slate-300 relative z-0">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-300 border-[3px] border-white box-content"></div>
                </div>
              )}

              {/* The Recursive Branch Rendering */}
              {Array.isArray(traceData.history) && traceData.history.length > 0 ? (
                <HistoryBranch historyArray={traceData.history} />
              ) : (
                <div className="mt-4 px-4 py-2 bg-slate-200/50 rounded-full text-xs font-bold text-slate-500 border border-slate-300/50">
                  No historical genealogy found.
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
