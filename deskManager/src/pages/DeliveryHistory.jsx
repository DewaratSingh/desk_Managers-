import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Box,
  Move,
  GitCommit,
  GitBranch,
  Truck,
  Briefcase,
  DollarSign,
  TrendingUp,
  RotateCcw
} from 'lucide-react';
import { toast } from 'react-toastify';

const renderIconForStep = (step) => {
  if (step.type === 'SELL') return <Truck size={20} className="text-emerald-500" />;
  if (step.type === 'BUY') return <Briefcase size={20} className="text-blue-500" />;
  if (step.type === 'PROCESS_PO' || step.action === 'Manufacture Production') return <GitBranch size={20} className="text-purple-500" />;
  return <GitCommit size={20} className="text-amber-500" />;
};

const getStepTitle = (step) => {
  if (step.type === 'SELL') return 'Sell Delivery (Dispatched)';
  if (step.type === 'BUY') return 'Purchased Stock';
  if (step.action === 'Manufacture Production') return 'Manufacture Production';
  if (step.type === 'MERGED_STOCK') return 'Merged Stock Allocation';
  if (step.type) return step.type;
  return 'Trace Activity';
};

// A recursive component that renders a linear sequence of history steps.
// If a step contains 'sources', it branches horizontally.
const HistoryBranch = ({ historyArray }) => {
  if (!Array.isArray(historyArray) || historyArray.length === 0) {
    return null;
  }

  // Render latest-first (top to bottom)
  const reversedHistory = [...historyArray].reverse();

  return (
    <div className="flex flex-col items-center relative">
      {reversedHistory.map((step, idx) => {
        const hasSources = Array.isArray(step.sources) && step.sources.length > 0;
        const isLast = idx === reversedHistory.length - 1 && !hasSources;
        const isSellStep = step.type === 'SELL';

        return (
          <div key={idx} className="flex flex-col items-center w-full">
            {/* The Node Card */}
            <div
              className={`bg-[var(--bg-form)] border shadow-md rounded-2xl w-[340px] relative z-10 transition-transform hover:-translate-y-1 hover:shadow-xl cursor-default animate-fade-in-up ${
                isSellStep ? 'border-emerald-400 ring-2 ring-emerald-400/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div
                className={`p-4 border-b flex items-center justify-between rounded-t-2xl ${
                  isSellStep ? 'bg-emerald-50/60 border-emerald-100' : 'bg-[var(--bg-form)] border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl shadow-xs border ${isSellStep ? 'bg-emerald-100/70 border-emerald-200' : 'bg-[var(--bg-form)] border-slate-100'}`}>
                    {renderIconForStep(step)}
                  </div>
                  <div>
                    <span className={`font-black text-sm ${isSellStep ? 'text-emerald-900' : 'text-slate-800'}`}>
                      {getStepTitle(step)}
                    </span>
                    {isSellStep && step.price !== undefined && (
                      <span className="block text-xs font-mono font-black text-emerald-600">
                        Sell Price: ₹{parseFloat(step.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                {step.date && (
                  <div className="text-[10px] font-bold text-slate-400 bg-[white] px-2 py-1 rounded-md border border-slate-200">
                    {new Date(step.date).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="p-4 bg-[var(--bg-form)] rounded-b-2xl">
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
                <div className="flex justify-center relative w-full px-[170px]">
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 bg-slate-300 z-0"
                    style={{
                      left: 'calc(50% / ' + step.sources.length + ')',
                      right: 'calc(50% / ' + step.sources.length + ')'
                    }}
                  />

                  <div className="flex flex-row justify-center gap-12 w-full pt-6 relative z-10">
                    {step.sources.map((srcArray, srcIdx) => (
                      <div key={srcIdx} className="flex flex-col items-center relative">
                        <div className="w-0.5 h-6 bg-slate-300 absolute -top-6"></div>
                        <HistoryBranch historyArray={srcArray} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Connecting line to the next sequential step */}
            {!isLast && !hasSources && (
              <div className="w-0.5 h-10 bg-slate-200 relative z-0"></div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default function DeliveryHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [historyRecord, setHistoryRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  // Pan interaction states
  const [isPanning, setIsPanning] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 50 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchHistoryData();
  }, [id]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e) => {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      setScale((prevScale) => {
        let newScale = prevScale - e.deltaY * zoomSensitivity;
        return Math.min(Math.max(0.1, newScale), 3);
      });
    };

    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  const fetchHistoryData = async () => {
    try {
      const res = await fetch(`/api/history/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.history === 'string') {
          data.history = JSON.parse(data.history);
        }
        setHistoryRecord(data);
      } else {
        toast.error('Failed to fetch delivery history record');
        navigate(-1);
      }
    } catch (err) {
      console.error(err);
      toast.error('Error loading history chart');
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

  const handleResetView = () => {
    setPosition({ x: 0, y: 50 });
    setScale(1);
  };

  const historyArray = Array.isArray(historyRecord?.history)
    ? historyRecord.history
    : [];

  return (
    <div className="h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden relative">
      {/* Header */}
      <div className="bg-[var(--bg-form)] border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 shadow-sm relative">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Truck size={22} className="text-emerald-600" />
              Delivery History Genealogy Chart
            </h1>
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 mt-0.5">
              <span>
                Record ID:{' '}
                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                  HIST-{id}
                </span>
              </span>
              {historyRecord?.item_code && (
                <span>
                  Item Code:{' '}
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                    {historyRecord.item_code}
                  </span>
                </span>
              )}
              {historyRecord?.delivery_note_no && (
                <span>
                  DN:{' '}
                  <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    {historyRecord.delivery_note_no}
                  </span>
                </span>
              )}
              {historyRecord?.price !== undefined && (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <DollarSign size={13} />
                  Sell Price: ₹{parseFloat(historyRecord.price).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetView}
            className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            title="Reset Pan & Zoom"
          >
            <RotateCcw size={12} />
            Reset View
          </button>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Move size={14} className="text-slate-500" />
            Scroll to zoom ({Math.round(scale * 100)}%), drag to pan
          </div>
        </div>
      </div>

      {/* Panning Canvas Area */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden bg-transparent transition-colors ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
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
        ) : historyArray.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Box size={40} className="text-slate-300" />
            <p className="font-bold text-sm">No history records found for this delivery item</p>
          </div>
        ) : (
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-max min-w-full flex justify-center pt-8 pb-32 select-none"
            style={{
              transform: `translate(calc(-50% + ${position.x}px), ${position.y}px) scale(${scale})`,
              transformOrigin: 'top center'
            }}
          >
            <HistoryBranch historyArray={historyArray} />
          </div>
        )}
      </div>
    </div>
  );
}
