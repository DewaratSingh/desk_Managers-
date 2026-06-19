import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Search, RefreshCw, X } from 'lucide-react';
import AddBuyerView from './AddBuyer';
import AddCustomerView from './AddCustomer';
import AddItemView from './AddItem';
import GstCategoryView from './GstCategory';
import ArcView from './Arc';
import RfqForm from '../form/RfqForm';
import QuotationForm from '../form/QuotationForm';
import InventoryView from './Inventory';

export default function Dashboard({ activeTab: propActiveTab }) {
  const [activeTab, setActiveTab] = useState(propActiveTab || 'dashboard');
  const navigate = useNavigate();
  const location = useLocation();
  
  const user = JSON.parse(localStorage.getItem('user') || '{"username":"admin","role":"admin"}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginTime');
    navigate('/login');
  };

  const [trades, setTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradeSearchQuery, setTradeSearchQuery] = useState('');
  const [hasMoreTrades, setHasMoreTrades] = useState(true);
  const [loadingMoreTrades, setLoadingMoreTrades] = useState(false);
  const [allStatuses, setAllStatuses]       = useState([]);
  const [filterInput, setFilterInput]       = useState('');
  const [selectedFilter, setSelectedFilter] = useState(null); // { label, type, value }
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filterRef = useRef(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [posLoading, setPosLoading]         = useState(false);
  const [releaseOrders, setReleaseOrders]   = useState([]);
  const [rosLoading, setRosLoading]         = useState(false);
  const [orderFilter, setOrderFilter]       = useState('ALL'); // 'ALL', 'PO', 'RO', 'PO_BUY'
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab);
    }
  }, [propActiveTab]);

  useEffect(() => {
    if (location.state?.openTab) {
      setActiveTab(location.state.openTab);
    }
  }, [location.state]);

  useEffect(() => {
    if (activeTab === 'purchase-order') {
      fetchPurchaseOrders();
      fetchReleaseOrders();
    }
  }, [activeTab]);

  useEffect(() => {
    // Load all statuses from DB on mount
    fetch('/api/statuses')
      .then(r => r.json())
      .then(data => setAllStatuses(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      const delayDebounceFn = setTimeout(() => {
        fetchTrades(false, tradeSearchQuery, selectedFilter);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [tradeSearchQuery, selectedFilter, activeTab]);

  const fetchTrades = async (isLoadMore = false, searchVal = tradeSearchQuery, filterObj = selectedFilter) => {
    if (isLoadMore) {
      setLoadingMoreTrades(true);
    } else {
      setTradesLoading(true);
    }
    try {
      const currentOffset = isLoadMore ? trades.length : 0;
      let url = `/api/trades?limit=20&offset=${currentOffset}&q=${encodeURIComponent(searchVal || '')}`;
      if (filterObj) {
        url += `&${filterObj.type}=${encodeURIComponent(filterObj.value)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (isLoadMore) {
          setTrades(prev => [...prev, ...data]);
        } else {
          setTrades(data);
        }
        if (data.length < 20) {
          setHasMoreTrades(false);
        } else {
          setHasMoreTrades(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch trades:', err);
    } finally {
      setTradesLoading(false);
      setLoadingMoreTrades(false);
    }
  };

  const fetchPurchaseOrders = async () => {
    setPosLoading(true);
    try {
      const res = await fetch('/api/purchase-orders');
      if (res.ok) setPurchaseOrders(await res.json());
    } catch (err) { console.error('Failed to fetch POs:', err); }
    finally { setPosLoading(false); }
  };

  const fetchReleaseOrders = async () => {
    setRosLoading(true);
    try {
      const res = await fetch('/api/release-orders');
      if (res.ok) setReleaseOrders(await res.json());
    } catch (err) { console.error('Failed to fetch ROs:', err); }
    finally { setRosLoading(false); }
  };

  const handleNavigateAndOpenForm = (tabName) => {
    setActiveTab(tabName);
    navigate('/');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6 text-slate-900">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Trade</h2>
              <p className="text-xs text-slate-500 mt-1">Quick stats and recent activity.</p>
            </div>

            {/* 3 Buttons at top */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => navigate('/addRfq')}
                className="p-5 bg-white border border-slate-300 hover:border-[var(--theme-color)] rounded-xl flex flex-col items-center justify-center gap-2 transition-all shadow-sm cursor-pointer hover:shadow-md group animate-fade-in"
              >
                <span className="font-extrabold text-lg text-slate-900 group-hover:text-[var(--theme-color)]">SELL</span>
                <span className="text-xs text-slate-500 font-semibold">Create Sale Trade (RFQ)</span>
              </button>
              
              <button
                onClick={() => navigate('/addReleaseOrder')}
                className="p-5 bg-white border border-slate-300 hover:border-[var(--theme-color)] rounded-xl flex flex-col items-center justify-center gap-2 transition-all shadow-sm cursor-pointer hover:shadow-md group animate-fade-in"
              >
                <span className="font-extrabold text-lg text-slate-900 group-hover:text-[var(--theme-color)]">ARC</span>
                <span className="text-xs text-slate-500 font-semibold">Annual Rate Contract</span>
              </button>

              <button
                onClick={() => navigate('/addReceivedQuotation')}
                className="p-5 bg-white border border-slate-300 hover:border-[var(--theme-color)] rounded-xl flex flex-col items-center justify-center gap-2 transition-all shadow-sm cursor-pointer hover:shadow-md group animate-fade-in"
              >
                <span className="font-extrabold text-lg text-slate-900 group-hover:text-[var(--theme-color)]">BUY</span>
                <span className="text-xs text-slate-500 font-semibold">Create Buy Trade</span>
              </button>
            </div>

            {/* List all trade at bottom */}
            {(() => {
              const staticTypes = ['Sell', 'Buy', 'ARC'];
              const filterOptions = [
                ...staticTypes.map(t => ({ label: `Type: ${t}`, type: 'trade_type', value: t })),
                ...allStatuses.map(s => ({ label: `Status: ${s.toUpperCase()}`, type: 'status', value: s }))
              ];
              const suggestions = filterInput.trim()
                ? filterOptions.filter(opt => opt.label.toLowerCase().includes(filterInput.toLowerCase()))
                : filterOptions;

              return (
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Trades Directory</h3>
                      <p className="text-xs text-slate-400 font-medium">Browse active client and purchase pipeline trades.</p>
                    </div>

                    {/* Controls: bigger search + filter suggestions */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center shrink-0">
                      {/* Search Bar (Bigger) */}
                      <div className="flex items-center gap-2.5 border border-slate-300 rounded-xl px-3.5 py-2 bg-white shadow-sm transition-all focus-within:border-[var(--theme-color)] focus-within:ring-2 focus-within:ring-[var(--theme-color)]/10 w-full sm:w-64 md:w-80 animate-fade-in">
                        <Search size={16} className="text-slate-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="Search by ID, item code..."
                          value={tradeSearchQuery}
                          onChange={(e) => setTradeSearchQuery(e.target.value)}
                          className="w-full bg-transparent focus:outline-none text-xs text-slate-900 placeholder:text-slate-400 font-semibold"
                        />
                      </div>

                      {/* Filter Option Input (Suggests type/status) */}
                      <div className="relative w-full sm:w-56" ref={filterRef}>
                        <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2 bg-white shadow-sm transition-colors focus-within:border-[var(--theme-color)]">
                          <input
                            type="text"
                            placeholder="Filter by type or status..."
                            value={filterInput}
                            onChange={(e) => {
                              setFilterInput(e.target.value);
                              setShowSuggestions(true);
                              if (!e.target.value.trim()) {
                                setSelectedFilter(null);
                              }
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            className="w-full bg-transparent focus:outline-none text-xs text-slate-900 placeholder:text-slate-400 font-semibold"
                          />
                          {filterInput && (
                            <button
                              onClick={() => {
                                setFilterInput('');
                                setSelectedFilter(null);
                                setShowSuggestions(false);
                              }}
                              className="text-slate-400 hover:text-red-500 cursor-pointer transition-colors"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        {showSuggestions && suggestions.length > 0 && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto animate-fade-in">
                            {suggestions.map((opt) => (
                              <button
                                key={opt.label}
                                onMouseDown={() => {
                                  setSelectedFilter(opt);
                                  setFilterInput(opt.label);
                                  setShowSuggestions(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 cursor-pointer flex items-center justify-between"
                              >
                                <span>{opt.label}</span>
                                <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">{opt.type === 'trade_type' ? 'Type' : 'Status'}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {tradesLoading && trades.length === 0 ? (
                    <p className="text-center text-xs font-bold text-slate-400 py-8 animate-pulse">Loading Trades...</p>
                  ) : trades.length === 0 ? (
                    <p className="text-center text-xs font-bold text-slate-400 py-8">No trade records found. Click "SELL" to get started.</p>
                  ) : (
                    <>
                  <div className="border border-slate-300 rounded-lg overflow-x-auto bg-white shadow-sm">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-2.5">Trade ID</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Pipeline Status</th>
                          <th className="px-4 py-2.5">Created Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {trades.map((trade) => (
                          <tr 
                            key={trade.trade_id} 
                            onClick={() => navigate(`/trade/${trade.trade_id}`)}
                            className="hover:bg-slate-50 transition-colors cursor-pointer group"
                          >
                            <td className="px-4 py-3 font-mono font-bold text-slate-900 group-hover:text-[var(--theme-color)]">
                              {trade.trade_id}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-600 capitalize">{trade.trade_type}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span 
                                className="px-2 py-0.5 text-[10px] font-bold uppercase rounded border"
                                style={{
                                  color: 'var(--theme-color)',
                                  borderColor: 'var(--theme-color)',
                                  backgroundColor: 'rgba(217, 53, 45, 0.05)'
                                }}
                              >
                                {trade.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-semibold">
                              {new Date(trade.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {hasMoreTrades && (
                    <div className="flex justify-center pt-1 animate-fade-in">
                      <button
                        onClick={() => fetchTrades(true)}
                        disabled={loadingMoreTrades}
                        className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                      >
                        {loadingMoreTrades && <RefreshCw size={12} className="animate-spin" />}
                        Show More
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}
          </div>
        );
      case 'add-buyer':
        return <AddBuyerView />;
      case 'add-customer':
        return <AddCustomerView />;
      case 'add-item':
        return <AddItemView />;
      case 'gst-category':
        return <GstCategoryView />;
      case 'arc':
        return <ArcView />;
      case 'inventory':
        return <InventoryView />;
      case 'addRfq':
      case 'updateRfq':
        return <RfqForm onNavigateAndOpenForm={handleNavigateAndOpenForm} />;
      case 'purchase-order': {
        const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        const calcTotal = (ord) => {
          const itemsBasic = (ord.items || []).reduce((s, i) => s + (parseFloat(i.unit_price)||0)*(parseInt(i.quantity)||0), 0);
          const gst   = parseFloat(ord.gst)             || 0;
          const trans = parseFloat(ord.transport)       || 0;
          const pack  = parseFloat(ord.packing_forward) || 0;
          const other = parseFloat(ord.other)           || 0;
          const bv    = parseFloat(ord.basic_value)     || 0;
          return itemsBasic + gst + trans + pack + other + bv;
        };
        const fmt = (v) => (parseFloat(v)||0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

        const showPOs = orderFilter === 'ALL' || orderFilter === 'PO' || orderFilter === 'PO_BUY';
        const showROs = orderFilter === 'ALL' || orderFilter === 'RO';

        let displayOrders = [];

        if (showPOs) {
          purchaseOrders.forEach(po => {
            if (orderFilter === 'PO_BUY' && po.trade_type !== 'buy') return;
            if (po.trade_status && (po.trade_status.trim().toLowerCase() === 'completed' || po.trade_status.trim().toLowerCase() === 'complete')) return;
            displayOrders.push({
              id: po.po_no,
              type: 'PO',
              number: po.po_no,
              date: po.po_date,
              deliveryDate: po.delivery_date,
              tradeId: po.trade_id,
              linkedDoc: po.quotation_no ? `QTN: ${po.quotation_no}` : null,
              items: po.items || [],
              basic_value: po.basic_value,
              gst: po.gst,
              transport: po.transport,
              packing_forward: po.packing_forward,
              other: po.other,
              navigatePath: `/order/${encodeURIComponent(po.po_no)}`,
              status: 'Ordered'
            });
          });
        }

        if (showROs) {
          releaseOrders.forEach(ro => {
            if (ro.trade_status && (ro.trade_status.trim().toLowerCase() === 'completed' || ro.trade_status.trim().toLowerCase() === 'complete')) return;
            displayOrders.push({
              id: ro.ro_no,
              type: 'RO',
              number: ro.ro_no,
              date: ro.ro_date,
              deliveryDate: ro.delivery_date,
              tradeId: ro.trade_id,
              linkedDoc: ro.contract_ref ? `Ref: ${ro.contract_ref}` : null,
              items: ro.items || [],
              basic_value: ro.basic_value,
              gst: ro.gst,
              transport: ro.transport,
              packing_forward: ro.packing_forward,
              other: ro.other,
              navigatePath: `/release-order/${encodeURIComponent(ro.ro_no)}`,
              status: 'Release Order'
            });
          });
        }

        // Apply Search Filter
        if (orderSearchQuery.trim() !== '') {
          const q = orderSearchQuery.toLowerCase();
          displayOrders = displayOrders.filter(ord => 
            ord.number.toLowerCase().includes(q) ||
            (ord.linkedDoc && ord.linkedDoc.toLowerCase().includes(q)) ||
            (ord.tradeId && ord.tradeId.toLowerCase().includes(q)) ||
            (ord.items || []).some(item => item.item_code.toLowerCase().includes(q))
          );
        }

        displayOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

        const isLoadingAll = posLoading || rosLoading;

        return (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Orders &amp; Releases</h2>
                <p className="text-xs text-slate-500 mt-1">Manage purchase orders and release orders.</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-2.5 border border-slate-300 rounded-lg px-3 py-2 bg-white shadow-sm transition-colors focus-within:border-[var(--theme-color)]">
              <Search size={18} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search orders by number, trade reference, linked doc, or item code..."
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                className="w-full bg-transparent focus:outline-none text-sm text-slate-900 placeholder:text-slate-400 font-medium"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              {[
                { id: 'ALL', label: 'All Orders' },
                { id: 'PO',  label: 'Purchase Orders (PO)' },
                { id: 'PO_BUY', label: 'Buy POs' },
                { id: 'RO',  label: 'Release Orders (RO)' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setOrderFilter(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${orderFilter === tab.id ? 'text-white' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
                  style={orderFilter === tab.id ? { backgroundColor: 'var(--theme-color)' } : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {isLoadingAll && displayOrders.length === 0 ? (
              <p className="text-center text-xs font-bold text-slate-400 py-10 animate-pulse">Loading Orders...</p>
            ) : displayOrders.length === 0 ? (
              <p className="text-center text-xs font-bold text-slate-400 py-10">No orders match filter or search.</p>
            ) : (
              <div className="space-y-3">
                {displayOrders.map((ord) => {
                  const total = calcTotal(ord);
                  const itemCount = (ord.items || []).length;
                  return (
                    <div
                      key={ord.id}
                      className="bg-white border border-slate-200 rounded-lg px-5 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3 hover:border-[var(--theme-color)] hover:shadow-md cursor-pointer transition-all"
                      onClick={() => navigate(ord.navigatePath)}
                    >
                      {/* Left: Order No + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-sm text-slate-900">{ord.number}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${ord.type === 'PO' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-purple-700 bg-purple-50 border-purple-200'}`}>
                            {ord.type}
                          </span>
                          {ord.linkedDoc && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                              {ord.linkedDoc}
                            </span>
                          )}
                          {ord.tradeId && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-75 transition-opacity"
                              style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' }}
                              onClick={(e) => { e.stopPropagation(); navigate(`/trade/${ord.tradeId}`); }}
                              title="Open Trade"
                            >
                              {ord.tradeId}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] font-semibold text-slate-500">
                          <span>Date: {fmtDate(ord.date)}</span>
                          {ord.deliveryDate && <span>Delivery: {fmtDate(ord.deliveryDate)}</span>}
                          <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Right: total + status badge */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Grand Total</div>
                          <div className="font-black text-base text-slate-900">₹{fmt(total)}</div>
                        </div>
                        <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border"
                          style={{
                            color: ord.type === 'PO' ? '#4f46e5' : '#8b5cf6',
                            borderColor: ord.type === 'PO' ? '#a5b4fc' : '#c084fc',
                            backgroundColor: ord.type === 'PO' ? '#eef2ff' : '#f5f3ff'
                          }}>
                          {ord.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }
      case 'quotation':
      case 'addQuotation':
      case 'updateQuotation':
        return <QuotationForm activeTab={activeTab} setActiveTab={setActiveTab} />;
      default:
        return (
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{activeTab}</h2>
            <p className="mt-2 text-sm text-slate-600">Content for {activeTab}.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={handleLogout} />

      <main className="flex-1">
        {activeTab === 'add-buyer' || 
         activeTab === 'add-customer' || 
         activeTab === 'add-item' || 
         activeTab === 'gst-category' || 
         activeTab === 'arc' || 
         activeTab === 'inventory' || 
         activeTab === 'addRfq' || 
         activeTab === 'updateRfq' ||
         activeTab === 'quotation' ||
         activeTab === 'addQuotation' ||
         activeTab === 'purchase-order' ||
         activeTab === 'updateQuotation' ? (
          renderContent()
        ) : (
          <div className="p-6">
            <div className="mx-auto max-w-6xl">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                {renderContent()}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
