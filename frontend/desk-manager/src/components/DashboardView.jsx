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

export default function DashboardView({ trades: initialTrades = [], setActiveTab, fetchMoreData, searchResource, setForceFormOpen }) {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Local trades list state supporting combined filters
  const [tradesList, setTradesList] = useState(initialTrades);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Synchronize with parent trades list (when loaded/modified)
  useEffect(() => {
    setTradesList(initialTrades);
  }, [initialTrades]);

  // Combined fetch helper
  const loadTrades = async (search, status, type, append = false) => {
    try {
      const savedToken = localStorage.getItem('dm_token');
      const offset = append ? tradesList.length : 0;
      const url = `${API_BASE_URL}/trades?limit=20&offset=${offset}`
        + `${search ? `&search=${encodeURIComponent(search)}` : ''}`
        + `${status && status !== 'all' ? `&status=${encodeURIComponent(status)}` : ''}`
        + `${type && type !== 'all' ? `&trade_type=${encodeURIComponent(type)}` : ''}`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      if (append) {
        setTradesList(prev => [...prev, ...data]);
      } else {
        setTradesList(data);
      }
    } catch (e) {
      console.error('Error filtering trades:', e);
    }
  };

  // Trigger server-side load on search query or filters change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery !== '' || statusFilter !== 'all' || typeFilter !== 'all') {
        loadTrades(searchQuery, statusFilter, typeFilter, false);
      } else {
        setTradesList(initialTrades);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, statusFilter, typeFilter, initialTrades]);

  // Stepper state counts (filtered by typeFilter to reflect actual available counts)
  const filteredForCounts = typeFilter === 'all' 
    ? initialTrades 
    : initialTrades.filter(t => t.trade_type === typeFilter);

  const totalTrades = filteredForCounts.length;
  const countRfq = filteredForCounts.filter(r => r.status === 'rfq').length;
  const countQuotated = filteredForCounts.filter(r => r.status === 'quotated' || r.status === 'quotation').length;
  const countOrdered = filteredForCounts.filter(r => r.status === 'ordered' || r.status === 'po').length;
  const countArc = filteredForCounts.filter(r => r.status === 'ro').length;
  const countDn = filteredForCounts.filter(r => r.status === 'dn').length;
  const countInvoice = filteredForCounts.filter(r => r.status === 'invoice').length;
  const countGrn = filteredForCounts.filter(r => r.status === 'grn').length;
  const countPayment = filteredForCounts.filter(r => r.status === 'payment').length;
  const countCompleted = filteredForCounts.filter(r => r.status === 'completed').length;
  const countRejected = filteredForCounts.filter(r => r.status === 'rejected').length;

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
      case 'po':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
            <CheckCircle2 size={12} /> Ordered
          </span>
        );
      case 'ro':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-full">
            <CheckCircle2 size={12} /> ARC (Release Order)
          </span>
        );
      case 'quotated':
      case 'quotation':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-full">
            <FileText size={12} /> Quotated
          </span>
        );
      case 'dn':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
            <Layers size={12} /> Delivery Note
          </span>
        );
      case 'invoice':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full">
            <FileText size={12} /> Invoice
          </span>
        );
      case 'grn':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-full">
            <Package size={12} /> GRN
          </span>
        );
      case 'payment':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full">
            <CheckCircle2 size={12} /> Payment
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-full">
            <CheckCircle2 size={12} /> Completed
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

        {/* Quick Actions Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => {
              setActiveTab('rfq');
              if (setForceFormOpen) setForceFormOpen('rfq');
            }}
            className="flex items-center justify-between p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-blue-600 hover:shadow-md transition-all text-left cursor-pointer group"
          >
            <div>
              <p className="font-extrabold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">Sell Products</p>
              <p className="text-xs text-slate-400 font-semibold mt-1">Start standard product sales process</p>
            </div>
            <ArrowUpRight className="text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" size={20} />
          </button>

          <button
            onClick={() => {
              setActiveTab('release-order');
              if (setForceFormOpen) setForceFormOpen('release-order');
            }}
            className="flex items-center justify-between p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-blue-600 hover:shadow-md transition-all text-left cursor-pointer group"
          >
            <div>
              <p className="font-extrabold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">Sell as ARC</p>
              <p className="text-xs text-slate-400 font-semibold mt-1">Manage Annual Rate Contract orders</p>
            </div>
            <ArrowUpRight className="text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" size={20} />
          </button>

          <button
            onClick={() => {
              setActiveTab('received-quotation');
              if (setForceFormOpen) setForceFormOpen('received-quotation');
            }}
            className="flex items-center justify-between p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-blue-600 hover:shadow-md transition-all text-left cursor-pointer group"
          >
            <div>
              <p className="font-extrabold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">Buy Product</p>
              <p className="text-xs text-slate-400 font-semibold mt-1">Create purchase orders for suppliers</p>
            </div>
            <ArrowUpRight className="text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" size={20} />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 border-2 border-slate-200 rounded-xl px-4 py-4 bg-white shadow-sm">
            <Search size={22} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search trades by Trade ID, Customer name, or Buyer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-lg text-slate-900 placeholder:text-slate-400 font-semibold"
            />
          </div>

          {/* Filter Layout: Type Chips + Status Dropdown */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-1">
            {/* Flow Type Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-colors border cursor-pointer select-none
                  ${typeFilter === 'all' 
                    ? 'bg-blue-600 border-blue-600 text-white font-extrabold' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                All Types
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('buy')}
                className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-colors border cursor-pointer select-none
                  ${typeFilter === 'buy' 
                    ? 'bg-pink-600 border-pink-600 text-white font-extrabold' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                Buy Flow (Supplier)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('ARC')}
                className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-colors border cursor-pointer select-none
                  ${typeFilter === 'ARC' 
                    ? 'bg-emerald-600 border-emerald-600 text-white font-extrabold' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                ARC Flow
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('sell')}
                className={`px-4 py-2.5 text-xs font-bold rounded-lg transition-colors border cursor-pointer select-none
                  ${typeFilter === 'sell' 
                    ? 'bg-indigo-600 border-indigo-600 text-white font-extrabold' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                Sell Flow (Standard)
              </button>
            </div>

            {/* Status Selection Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="status-select" className="text-xs font-extrabold text-slate-500 uppercase tracking-wider select-none shrink-0">
                Status:
              </label>
              <select
                id="status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border-2 border-slate-200 text-slate-700 text-sm font-bold rounded-lg px-3 py-2 focus:outline-none focus:border-blue-600 transition-colors cursor-pointer w-full md:w-auto"
              >
                <option value="all">All Statuses ({totalTrades})</option>
                <option value="rfq">RFQ ({countRfq})</option>
                <option value="quotation">Quotated ({countQuotated})</option>
                <option value="po">Ordered ({countOrdered})</option>
                <option value="ro">ARC ({countArc})</option>
                <option value="dn">Delivery Notes ({countDn})</option>
                <option value="invoice">Invoices ({countInvoice})</option>
                <option value="grn">GRNs ({countGrn})</option>
                <option value="payment">Payments ({countPayment})</option>
                <option value="completed">Completed ({countCompleted})</option>
                <option value="rejected">Rejected ({countRejected})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Trade Directory List */}
        <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              Active Trade List ({tradesList.length})
            </span>
          </div>

          {tradesList.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-lg font-semibold">
              No Trade record matches current criteria.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {tradesList.map((trade) => {
                const totalVal = parseFloat(trade.total_value) || 0;
                return (
                  <div
                    key={trade.trade_id}
                    onClick={() => navigate(`/trace/${encodeURIComponent(trade.trade_id)}`)}
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white hover:bg-slate-50/75 transition-all cursor-pointer group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {trade.trade_id}
                        </span>
                        {trade.trade_type && (
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                            trade.trade_type === 'sell' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            trade.trade_type === 'ARC' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            trade.trade_type === 'buy' ? 'bg-pink-50 text-pink-700 border-pink-200' :
                            'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            {trade.trade_type}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                          Created: {fmtDate(trade.created_at)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5" title={trade.customer_address || ''}>
                          <Building2 size={14} className="text-slate-400" /> 
                          <span className="font-semibold text-slate-700">{trade.customer_name || '—'}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5">
                          <User size={14} className="text-slate-400" /> 
                          <span className="font-semibold text-slate-700">{trade.buyer_name || '—'}</span>
                          {(trade.buyer_email || trade.buyer_phone) && (
                            <span className="text-xs text-slate-400 font-normal">
                              ({[trade.buyer_email, trade.buyer_phone].filter(Boolean).join(' • ')})
                            </span>
                          )}
                        </span>
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
                        {getStatusBadge(trade.status)}
                        <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tradesList.length >= 20 && tradesList.length % 20 === 0 && (
            <div className="flex justify-center p-4 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => loadTrades(searchQuery, statusFilter, typeFilter, true)}
                className="px-6 py-2.5 border-2 border-slate-200 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 text-slate-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
              >
                Load More Trades
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
