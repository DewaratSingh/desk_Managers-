import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  TrendingUp, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  Lock, 
  X, 
  Building2, 
  User, 
  Calendar, 
  AlertCircle,
  Package,
  Layers,
  CircleDot,
  ArrowUpRight,
  ChevronRight,
  CircleCheck
} from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

export default function DashboardView({ rfqs = [], setActiveTab, fetchMoreData, searchResource }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRfqNo, setSelectedRfqNo] = useState(null);
  const [traceData, setTraceData] = useState(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState(null);
  const navigate = useNavigate();

  // Local trades list state supporting combined filters
  const [trades, setTrades] = useState(rfqs);
  const [statusFilter, setStatusFilter] = useState('all');

  // Synchronize with parent rfqs list (when loaded/modified)
  useEffect(() => {
    setTrades(rfqs);
  }, [rfqs]);

  // Combined fetch helper
  const loadTrades = async (search, status, append = false) => {
    try {
      const savedToken = localStorage.getItem('dm_token');
      const offset = append ? trades.length : 0;
      const url = `${API_BASE_URL}/rfqs?limit=20&offset=${offset}`
        + `${search ? `&search=${encodeURIComponent(search)}` : ''}`
        + `${status && status !== 'all' ? `&status=${encodeURIComponent(status)}` : ''}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      if (append) {
        setTrades(prev => [...prev, ...data]);
      } else {
        setTrades(data);
      }
    } catch (e) {
      console.error('Error filtering trades:', e);
    }
  };

  // Trigger server-side load on search query or status filter change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery !== '' || statusFilter !== 'all') {
        loadTrades(searchQuery, statusFilter, false);
      } else {
        setTrades(rfqs);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, statusFilter, rfqs]);

  // Load RFQ Trace Details
  const handleRowClick = async (rfqNo) => {
    setSelectedRfqNo(rfqNo);
    setTraceData(null);
    setTraceLoading(true);
    setTraceError(null);
    try {
      const savedToken = localStorage.getItem('dm_token');
      const res = await fetch(`${API_BASE_URL}/rfqs/${encodeURIComponent(rfqNo)}/trace`, {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      if (!res.ok) throw new Error('Failed to load trade trace details');
      const data = await res.json();
      setTraceData(data);
    } catch (err) {
      setTraceError(err.message);
    } finally {
      setTraceLoading(false);
    }
  };

  // Close Trace Drawer
  const handleCloseDrawer = () => {
    setSelectedRfqNo(null);
    setTraceData(null);
  };

  // Stepper state counts
  const totalTrades = rfqs.length;
  const countRfq = rfqs.filter(r => r.status === 'rfq').length;
  const countQuotated = rfqs.filter(r => r.status === 'quotated').length;
  const countOrdered = rfqs.filter(r => r.status === 'ordered').length;
  const countRejected = rfqs.filter(r => r.status === 'rejected').length;

  const fmtDate = (d) => {
    if (!d) return '—';
    if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parts = d.substring(0, 10).split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    const day = String(dt.getUTCDate()).padStart(2, '0');
    const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const year = dt.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ordered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
            <CheckCircle2 size={12} /> Ordered
          </span>
        );
      case 'quotated':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
            <FileText size={12} /> Quotated
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full">
            <X size={12} /> Rejected
          </span>
        );
      case 'rfq':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-full">
            <Clock size={12} /> RFQ
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-10 bg-[#f1f5f9] max-w-5xl mx-auto w-full text-slate-900 overflow-y-auto relative">
      <div className="space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-slate-200">
          <h1 className="text-3xl font-extrabold text-slate-900 m-0">Trade Pipeline Dashboard</h1>
          <p className="text-base text-slate-500 mt-1 font-medium">
            Monitor transaction stages from initial RFQ through Commercial Bidding up to Purchase Orders.
          </p>
        </div>

       

        {/* Search & Filter Bar */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search trades by RFQ No, Customer name, Buyer name, or Item code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-lg text-slate-900 placeholder:text-slate-400 font-semibold"
            />
          </div>

          {/* Status Filter Chips Row */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors border cursor-pointer select-none
                ${statusFilter === 'all' 
                  ? 'bg-blue-600 border-blue-600 text-white font-extrabold' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              All Trades ({totalTrades})
            </button>
            <button
              onClick={() => setStatusFilter('rfq')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors border flex items-center gap-1.5 cursor-pointer select-none
                ${statusFilter === 'rfq' 
                  ? 'bg-slate-700 border-slate-700 text-white font-extrabold' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <Clock size={12} /> RFQs ({countRfq})
            </button>
            <button
              onClick={() => setStatusFilter('quotated')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors border flex items-center gap-1.5 cursor-pointer select-none
                ${statusFilter === 'quotated' 
                  ? 'bg-blue-600 border-blue-600 text-white font-extrabold' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <FileText size={12} /> Quotated ({countQuotated})
            </button>
            <button
              onClick={() => setStatusFilter('ordered')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors border flex items-center gap-1.5 cursor-pointer select-none
                ${statusFilter === 'ordered' 
                  ? 'bg-emerald-600 border-emerald-600 text-white font-extrabold' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <CheckCircle2 size={12} /> Ordered ({countOrdered})
            </button>
            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors border flex items-center gap-1.5 cursor-pointer select-none
                ${statusFilter === 'rejected' 
                  ? 'bg-red-600 border-red-600 text-white font-extrabold' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              <X size={12} /> Rejected ({countRejected})
            </button>
          </div>
        </div>

        {/* Trade Directory List */}
        <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              Active Trade List ({trades.length})
            </span>
          </div>

          {trades.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-lg font-semibold">
              No Trade record matches current criteria.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {trades.map((rfq) => {
                const totalVal = parseFloat(rfq.total_value) || 0;
                return (
                  <div
                    key={rfq.rfq_no}
                    onClick={() => handleRowClick(rfq.rfq_no)}
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white hover:bg-slate-50/75 transition-all cursor-pointer group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {rfq.rfq_no}
                        </span>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                          Created: {fmtDate(rfq.created_at)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                        <span className="flex items-center gap-1"><Building2 size={14} className="text-slate-400" /> {rfq.customer_name || '—'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><User size={14} className="text-slate-400" /> {rfq.buyer_name || '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div className="flex flex-col md:items-end">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total Value</span>
                        <span className="text-slate-800 font-bold text-sm">
                          {totalVal > 0 ? `₹${totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        {getStatusBadge(rfq.status)}
                        <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {trades.length >= 20 && trades.length % 20 === 0 && (
            <div className="flex justify-center p-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => loadTrades(searchQuery, statusFilter, true)}
                className="px-6 py-2.5 border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 text-slate-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
              >
                Load More Trades
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Side Slider Panel / Drawer for Trace timeline */}
      {selectedRfqNo && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-slide-in relative overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div>
                <h3 className="text-lg font-black text-slate-800">Trade Timeline Trace</h3>
                <p className="text-xs text-slate-400 font-semibold font-mono mt-0.5">RFQ: {selectedRfqNo}</p>
              </div>
              <button
                onClick={handleCloseDrawer}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {traceLoading && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  <span className="text-sm font-bold text-slate-400">Loading trace data...</span>
                </div>
              )}

              {traceError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold flex items-center gap-2">
                  <AlertCircle size={16} />
                  {traceError}
                </div>
              )}

              {traceData && (
                <div className="space-y-6">
                  {/* Pipeline Visual Stepper */}
                  <div className="flex items-center justify-between px-4 pb-4 border-b border-slate-100">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <span className="text-[10px] font-black text-slate-700 uppercase">RFQ</span>
                    </div>
                    <div className="flex-1 h-0.5 bg-slate-200 mx-2 mb-4 relative">
                      {traceData.quotation && <div className="absolute inset-0 bg-blue-600" />}
                    </div>

                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors
                        ${traceData.quotation ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                        2
                      </div>
                      <span className={`text-[10px] font-black uppercase ${traceData.quotation ? 'text-slate-700' : 'text-slate-400'}`}>Quotation</span>
                    </div>
                    <div className="flex-1 h-0.5 bg-slate-200 mx-2 mb-4 relative">
                      {traceData.purchase_order && <div className="absolute inset-0 bg-blue-600" />}
                    </div>

                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors
                        ${traceData.purchase_order ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                        3
                      </div>
                      <span className={`text-[10px] font-black uppercase ${traceData.purchase_order ? 'text-slate-700' : 'text-slate-400'}`}>PO Order</span>
                    </div>
                  </div>

                  {/* STAGE 1: RFQ DETAILS */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-extrabold uppercase text-slate-500 tracking-wider">Stage 1: RFQ Details</h4>
                      <span className="text-[10px] font-bold text-slate-400">Created {fmtDate(traceData.rfq.created_at)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><b className="text-slate-400">RFQ Date:</b> <span className="font-semibold text-slate-800">{fmtDate(traceData.rfq.rfq_date)}</span></div>
                      <div><b className="text-slate-400">Customer:</b> <span className="font-semibold text-slate-800">{traceData.rfq.customer_name || '—'}</span></div>
                      <div><b className="text-slate-400">Buyer Contact:</b> <span className="font-semibold text-slate-800">{traceData.rfq.buyer_name || '—'}</span></div>
                      <div><b className="text-slate-400">Technical Bid Due:</b> <span className="font-semibold text-slate-800">{fmtDate(traceData.rfq.technical_bid_due_date)}</span></div>
                    </div>
                    <div className="pt-2">
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Items in RFQ ({traceData.rfq.items.length})</p>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {traceData.rfq.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] bg-slate-50 p-2 rounded font-medium border border-slate-100">
                            <span className="font-mono text-slate-700">{item.item_code} ({item.quantity} {item.unit || 'Piece'})</span>
                            <span className="text-slate-500 max-w-64 truncate">{item.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* STAGE 2: QUOTATION DETAILS */}
                  {traceData.quotation ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h4 className="text-sm font-extrabold uppercase text-slate-500 tracking-wider">Stage 2: Quotation Details</h4>
                        <div className="flex items-center gap-2">
                          {traceData.rfq.status === 'rejected' && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">REJECTED</span>
                          )}
                          <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{traceData.quotation.quotation_no}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><b className="text-slate-400">Quotation Date:</b> <span className="font-semibold text-slate-800">{fmtDate(traceData.quotation.quotation_date)}</span></div>
                        <div><b className="text-slate-400">GST Setup:</b> <span className="font-semibold text-slate-800">{traceData.quotation.gst_type || 'CGST/SGST'} &bull; {parseFloat(traceData.quotation.gst_rate)}%</span></div>
                      </div>
                      <div className="pt-2">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">Quoted Items ({traceData.quotation.items.length})</p>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {traceData.quotation.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-[11px] bg-slate-50 p-2 rounded font-medium border border-slate-100">
                              <span className="font-mono text-slate-700">{item.item_code} ({item.quantity} {item.unit})</span>
                              <span className="font-bold text-slate-800">₹{parseFloat(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })} / unit</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {traceData.quotation.terms_and_conditions && (
                        <div className="pt-2 border-t border-slate-100 text-[10px]">
                          <b className="text-slate-400 uppercase tracking-wider block mb-1">Terms & Conditions</b>
                          <p className="text-slate-600 whitespace-pre-wrap line-clamp-3">{traceData.quotation.terms_and_conditions}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                      <FileText className="mx-auto text-slate-300 mb-2" size={24} />
                      <span className="text-sm font-bold text-slate-400 block">Stage 2: Quotation Pending</span>
                      <p className="text-xs text-slate-400 mt-1">This trade is in the RFQ stage. Commercial bid preparation is required.</p>
                      <button
                        onClick={() => {
                          handleCloseDrawer();
                          setActiveTab('quotation');
                          navigate('/', { state: { activeTab: 'quotation', prefillRfqNo: traceData.rfq.rfq_no } });
                        }}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                      >
                        Create Quotation <ArrowRight size={14} />
                      </button>
                    </div>
                  )}

                  {/* STAGE 3: ORDER / PURCHASE ORDER DETAILS */}
                  {traceData.purchase_order ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h4 className="text-sm font-extrabold uppercase text-slate-500 tracking-wider">Stage 3: Purchase Order Details</h4>
                        <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{traceData.purchase_order.po_no}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><b className="text-slate-400">PO Date:</b> <span className="font-semibold text-slate-800">{fmtDate(traceData.purchase_order.po_date)}</span></div>
                        {traceData.purchase_order.delivery_date && (
                          <div><b className="text-slate-400">Delivery Date:</b> <span className="font-semibold text-slate-800">{fmtDate(traceData.purchase_order.delivery_date)}</span></div>
                        )}
                        {traceData.purchase_order.contract_ref && (
                          <div><b className="text-slate-400">Contract Ref:</b> <span className="font-semibold text-slate-800">{traceData.purchase_order.contract_ref}</span></div>
                        )}
                      </div>
                      <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] font-medium">
                        <div className="flex justify-between text-slate-600"><span>Basic Value:</span> <span>₹{parseFloat(traceData.purchase_order.basic_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between text-slate-600"><span>GST Tax:</span> <span>₹{parseFloat(traceData.purchase_order.gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between text-slate-600"><span>Freight/Transport:</span> <span>₹{parseFloat(traceData.purchase_order.transport).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between text-slate-600"><span>Packing & Fwd:</span> <span>₹{parseFloat(traceData.purchase_order.packing_forward).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">Gross PO Total</span>
                        <span className="text-base font-black text-emerald-700">
                          ₹{(
                            (parseFloat(traceData.purchase_order.basic_value) || 0) +
                            (parseFloat(traceData.purchase_order.gst) || 0) +
                            (parseFloat(traceData.purchase_order.transport) || 0) +
                            (parseFloat(traceData.purchase_order.packing_forward) || 0) +
                            (parseFloat(traceData.purchase_order.other) || 0)
                          ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          handleCloseDrawer();
                          navigate(`/purchase-order/${encodeURIComponent(traceData.purchase_order.po_no)}`);
                        }}
                        className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-slate-200"
                      >
                        View Full Purchase Order Details <ArrowUpRight size={14} />
                      </button>
                    </div>
                  ) : traceData.rfq.status === 'rejected' ? (
                    <div className="bg-red-50/50 border-2 border-dashed border-red-200 rounded-xl p-6 text-center">
                      <X className="mx-auto text-red-400 mb-2" size={24} />
                      <span className="text-sm font-bold text-red-600 block">Stage 3: Trade Terminated</span>
                      <p className="text-xs text-red-500 mt-1">
                        This trade was rejected at the quotation stage. No Purchase Order can be generated.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                      <Lock className="mx-auto text-slate-300 mb-2" size={24} />
                      <span className="text-sm font-bold text-slate-400 block">Stage 3: Purchase Order Locked</span>
                      <p className="text-xs text-slate-400 mt-1">
                        {traceData.quotation 
                          ? 'Commercial quotation has been prepared. Next step is recording the Purchase Order.' 
                          : 'Quotation preparation is required before placing a Purchase Order.'}
                      </p>
                      {traceData.quotation && (
                        <button
                          onClick={() => {
                            handleCloseDrawer();
                            setActiveTab('purchase-order');
                            navigate('/', { state: { activeTab: 'purchase-order', prefillQuotationNo: traceData.quotation.quotation_no } });
                          }}
                          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm"
                        >
                          Make Purchase Order <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
