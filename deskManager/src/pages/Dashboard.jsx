import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, RefreshCw, X, TrendingUp, FileOutput, ArrowRightLeft, Factory, Workflow } from 'lucide-react';
import { hasPermission } from '../utils/permissions';
import { computeItemOperationStatus } from './PurchaseOrderView';

const statusStyle = (s) => {
  const v = (s || '').toLowerCase();
  if (v === 'ro' || v === 'release order') return { color: '#059669', borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' };
  if (v === 'ordered')             return { color: '#4f46e5', borderColor: '#a5b4fc', backgroundColor: '#eef2ff' };
  if (v === 'quotation')           return { color: '#0369a1', borderColor: '#7dd3fc', backgroundColor: '#f0f9ff' };
  if (v === 'payment')             return { color: '#15803d', borderColor: '#86efac', backgroundColor: '#f0fdf4' };
  if (v === 'completed')           return { color: '#15803d', borderColor: '#86efac', backgroundColor: '#f0fdf4' };
  if (v === 'delivered')           return { color: '#15803d', borderColor: '#86efac', backgroundColor: '#f0fdf4' };
  if (v === 'payed')               return { color: '#15803d', borderColor: '#86efac', backgroundColor: '#f0fdf4' };
  if (v === 'partially delivered') return { color: '#d97706', borderColor: '#fcd34d', backgroundColor: '#fef3c7' };
  if (v === 'cancelled')           return { color: '#9f1239', borderColor: '#fca5a5', backgroundColor: '#fff1f2' };
  return { color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' };
};

export default function Dashboard({ activeTab: propActiveTab }) {
  const [activeTab, setActiveTab] = useState(propActiveTab || 'dashboard');
  const navigate = useNavigate();
  const location = useLocation();

  const userStr = sessionStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const canSeeAllTrades = hasPermission(currentUser, 'trades:view_all');

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
  const [processPOs, setProcessPOs]         = useState([]);
  const [pposLoading, setPposLoading]       = useState(false);
  const [processROs, setProcessROs]         = useState([]);
  const [prosLoading, setProsLoading]       = useState(false);
  const [orderFilter, setOrderFilter]       = useState('ALL'); // 'ALL' | 'PO' | 'RO' | 'BUY_PROCESS'
  const [orderSearchQuery, setOrderSearchQuery] = useState('');

  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab);
    } else {
      setActiveTab('dashboard');
    }
  }, [propActiveTab]);

  useEffect(() => {
    if (activeTab === 'purchase-order') {
      fetchPurchaseOrders();
      fetchReleaseOrders();
      fetchProcessPOs();
      fetchProcessROs();
    }
  }, [activeTab]);

  useEffect(() => {
    const trimmed = filterInput.trim();
    if (!trimmed) {
      setAllStatuses([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetch(`/api/statuses?q=${encodeURIComponent(trimmed)}`)
        .then(r => r.json())
        .then(data => setAllStatuses(Array.isArray(data) ? data : []))
        .catch(console.error);
    }, 200);

    return () => clearTimeout(delayDebounceFn);
  }, [filterInput]);

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
    if (activeTab === 'dashboard' && canSeeAllTrades) {
      const delayDebounceFn = setTimeout(() => {
        fetchTrades(false, tradeSearchQuery, selectedFilter);
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [tradeSearchQuery, selectedFilter, activeTab, canSeeAllTrades]);

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

  const fetchProcessPOs = async () => {
    setPposLoading(true);
    try {
      const res = await fetch('/api/process-po');
      if (res.ok) setProcessPOs(await res.json());
    } catch (err) { console.error('Failed to fetch Process POs:', err); }
    finally { setPposLoading(false); }
  };

  const fetchProcessROs = async () => {
    setProsLoading(true);
    try {
      const res = await fetch('/api/process-ro');
      if (res.ok) setProcessROs(await res.json());
    } catch (err) { console.error('Failed to fetch Process ROs:', err); }
    finally { setProsLoading(false); }
  };

  const refreshAllOrders = () => {
    fetchPurchaseOrders();
    fetchReleaseOrders();
    fetchProcessPOs();
    fetchProcessROs();
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

            {/* Top 10 Trades Chart (Line Graph) */}
            {/* <TradeComparisonChart trades={trades} /> */}

            {/* List all trade or Operation Desk */}
            {!canSeeAllTrades ? (
              <div className="space-y-6 pt-4 border-t border-slate-200">
                <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-md">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">✍️</span>
                    <h3 className="text-lg font-bold">Operations Desk</h3>
                  </div>
                  <p className="text-xs text-slate-300 max-w-xl">
                    Welcome to your transaction entry portal. Select any workflow below to fill and submit operational documents.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Sell Workflows */}
                  {hasPermission(currentUser, 'sell_rfq:create') && (
                    <div onClick={() => navigate('/addRfq')} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all">
                      <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Sell Workflow</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">Create RFQ</h4>
                      <p className="text-xs text-slate-500 mt-1">Submit new Request for Quotation</p>
                    </div>
                  )}
                  {hasPermission(currentUser, 'sell_quotation:create') && (
                    <div onClick={() => navigate('/addQuotation')} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all">
                      <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Sell Workflow</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">Send Quotation</h4>
                      <p className="text-xs text-slate-500 mt-1">Prepare customer sales quotation</p>
                    </div>
                  )}
                  {hasPermission(currentUser, 'sell_po:create') && (
                    <div onClick={() => navigate('/addPurchaseOrder')} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all">
                      <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Sell Workflow</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">Customer PO</h4>
                      <p className="text-xs text-slate-500 mt-1">Input incoming purchase order</p>
                    </div>
                  )}
                  {hasPermission(currentUser, 'ro:create') && (
                    <div onClick={() => navigate('/addReleaseOrder')} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all">
                      <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Sell Workflow</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">Release Order (RO)</h4>
                      <p className="text-xs text-slate-500 mt-1">Dispatch and release order allocation</p>
                    </div>
                  )}

                  {/* Buy Workflows */}
                  {hasPermission(currentUser, 'buy_rq:create') && (
                    <div onClick={() => navigate('/addReceivedQuotation')} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md cursor-pointer transition-all">
                      <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Buy Workflow</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">Received Quotation (RQ)</h4>
                      <p className="text-xs text-slate-500 mt-1">Record supplier received quote</p>
                    </div>
                  )}
                  {hasPermission(currentUser, 'buy_contract_order:create') && (
                    <div onClick={() => navigate('/addContractOrder')} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-md cursor-pointer transition-all">
                      <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Buy Workflow</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">Contract Order</h4>
                      <p className="text-xs text-slate-500 mt-1">Vendor purchase order / contract</p>
                    </div>
                  )}

                  {/* Process / Manufacture Workflows */}
                  {hasPermission(currentUser, 'process_rq:create') && (
                    <div onClick={() => navigate('/addProcessReceivedQuotation')} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-500 hover:shadow-md cursor-pointer transition-all">
                      <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Manufacture / Process</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">Process Received Quotation</h4>
                      <p className="text-xs text-slate-500 mt-1">Outsourced process quote</p>
                    </div>
                  )}
                  {hasPermission(currentUser, 'process_order:create') && (
                    <div onClick={() => navigate('/addProcessContractOrder')} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-amber-500 hover:shadow-md cursor-pointer transition-all">
                      <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Manufacture / Process</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">Process Contract Order</h4>
                      <p className="text-xs text-slate-500 mt-1">Outsourced job work order</p>
                    </div>
                  )}

                  {/* ARC Contract Management */}
                  {hasPermission(currentUser, 'arc:create') && (
                    <div onClick={() => navigate('/arc/form')} className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all">
                      <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Contract Management</span>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">New ARC Contract</h4>
                      <p className="text-xs text-slate-500 mt-1">Create annual rate contract agreement</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (() => {
              const staticTypes = ['Sell', 'Buy', 'Buy Process', 'Sell Process', 'ARC', 'buyARC', 'sellARC', 'Process'];
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
                      <div className="flex items-center gap-2.5 border border-slate-300 rounded-xl px-3.5 py-2 bg-[var(--bg-form)] shadow-sm transition-all focus-within:border-[var(--theme-color)] focus-within:ring-2 focus-within:ring-[var(--theme-color)]/10 w-full sm:w-64 md:w-80 animate-fade-in">
                        <Search size={16} className="text-slate-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="Search by ID, item code, PO, RO, DN..."
                          value={tradeSearchQuery}
                          onChange={(e) => setTradeSearchQuery(e.target.value)}
                          className="w-full bg-transparent focus:outline-none text-xs text-slate-900 placeholder:text-slate-400 font-semibold"
                        />
                      </div>

                      {/* Filter Option Input (Suggests type/status) */}
                      <div className="relative w-full sm:w-56" ref={filterRef}>
                        <div className="flex items-center gap-2 border border-slate-300 rounded-xl px-3 py-2  bg-[white] shadow-sm transition-colors focus-within:border-[var(--theme-color)]">
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
                          <div className="absolute z-20 top-full left-0 right-0 mt-1  bg-[white] border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto animate-fade-in">
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
                  <div className="border border-slate-300 rounded-lg overflow-x-auto bg-[var(--bg-form)] shadow-sm transition-colors duration-300">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-2.5">Trade ID</th>
                          <th className="px-4 py-2.5">Ref ID</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Party</th>
                          <th className="px-4 py-2.5">Contact name</th>
                          <th className="px-4 py-2.5 text-right">Delivered %</th>
                          <th className="px-4 py-2.5">Pipeline Status</th>
                          <th className="px-4 py-2.5">Created Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200  bg-[white]">
                        {trades.map((trade) => (
                          <tr 
                            key={trade.trade_id} 
                            onClick={() => navigate(`/trade/${trade.trade_id}`)}
                            className="hover:bg-slate-50 transition-colors cursor-pointer group"
                          >
                            <td className="px-4 py-3 font-mono font-bold text-slate-900 group-hover:text-[var(--theme-color)]">
                              {trade.trade_id}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-700">
                              {trade.ref_id || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-600 capitalize">{(trade.trade_type || '').replace(/_/g, ' ')}</span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700">
                              {trade.party_id || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-semibold">
                              {trade.contact_name || '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">
                              <span 
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  parseFloat(trade.delivered_pct) === 100 
                                    ? 'text-green-700 bg-green-50 border border-green-200' 
                                    : parseFloat(trade.delivered_pct) === 0
                                    ? 'text-slate-500 bg-slate-50 border border-slate-200'
                                    : 'text-amber-700 bg-amber-50 border border-amber-200'
                                }`}
                              >
                                {parseFloat(trade.delivered_pct || 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span 
                                className="px-2 py-0.5 text-[10px] font-bold uppercase rounded border"
                                style={statusStyle(trade.status)}
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
                        className="px-4 py-2 bg-[var(--bg-form)] border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
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

      case 'purchase-order': {
        const fmtDate = (d) => {
          if (!d) return '—';
          const s = typeof d === 'string' ? d : String(d);
          if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
            const [y, m, day] = s.substring(0, 10).split('-');
            return `${day}/${m}/${y}`;
          }
          const dt = new Date(d);
          if (isNaN(dt)) return d;
          return `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}/${dt.getUTCFullYear()}`;
        };
        const fmtAmt = (v) => (parseFloat(v)||0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const fmtQty = (v) => (parseFloat(v)||0).toLocaleString('en-IN');

        // Sell Orders: Customer Purchase Orders (PO) & Release Orders (RO)
        const sellOrders = [];

        // 1. Purchase Orders from /api/purchase-orders (Customer POs)
        purchaseOrders.forEach(po => {
          if (!po.po_no) return;
          const tType = (po.trade_type || '').toLowerCase();
          const isProcess = tType.includes('process') || po.po_no.startsWith('PPO-');
          const isBuy = tType.includes('buy') || Boolean(po.received_quotation_id);

          if (!isProcess && !isBuy) {
            sellOrders.push({
              groupKey: po.po_no,
              type: 'PO',
              number: po.po_no,
              date: po.po_date,
              partyId: po.party_id || '—',
              partyName: po.party_name || '',
              items: po.items || [],
              tradeId: po.trade_id,
              navigatePath: `/order/${encodeURIComponent(po.po_no)}`,
            });
          }
        });

        // 2. Release Orders from /api/release-orders (Customer ROs)
        releaseOrders.forEach(ro => {
          if (!ro.ro_no) return;
          const tType = (ro.trade_type || '').toLowerCase();
          const rType = (ro.ro_type || '').toLowerCase();
          const isProcess = tType.includes('process') || ro.ro_no.startsWith('PRO-');
          const isBuy = tType.includes('buy') || rType === 'buy';

          if (!isProcess && !isBuy) {
            sellOrders.push({
              groupKey: ro.ro_no,
              type: 'RO',
              number: ro.ro_no,
              date: ro.ro_date,
              partyId: ro.party_id || ro.customer_code || '—',
              partyName: ro.customer_name || '',
              items: ro.items || [],
              tradeId: ro.trade_id,
              navigatePath: `/release-order/${encodeURIComponent(ro.ro_no)}`,
            });
          }
        });

        // 3. Buy Process Orders (Process POs & Process ROs)
        const buyProcessOrders = [];
        const seenProcessKeys = new Set();

        (processPOs || []).forEach(ppo => {
          if (!ppo.po_no || seenProcessKeys.has(ppo.po_no)) return;
          seenProcessKeys.add(ppo.po_no);
          let items = [];
          const tradeCode = ppo.trade_id ? (String(ppo.trade_id).startsWith('TRD-') ? ppo.trade_id : `TRD-PRO-${String(ppo.trade_id).padStart(4, '0')}`) : '';
          const targetItems = Array.isArray(ppo.target_items) ? ppo.target_items : (Array.isArray(ppo.items) ? ppo.items : []);
          if (targetItems.length > 0) {
            items = targetItems.map(t => ({
              item_code: t.item_code || '—',
              description: t.description || '—',
              process_name: t.process_name || ppo.process_name || '',
              quantity: parseFloat(t.qty || t.quantity || 0),
              delivered_qty: parseFloat(t.delivered_qty || 0),
              delivery_date: t.delivery_date || ppo.delivery_date || ppo.date_of_end,
              status: t.status || ppo.status || 'ordered',
              unit_price: parseFloat(t.price || t.rate || ppo.basic_value || 0),
              linked_operations: tradeCode ? [{
                operation_type: 'TRADE',
                trade_ref: tradeCode,
                trade_id: ppo.trade_id,
                trade_type: 'BUY_PROCESS',
                trade_status: ppo.status || 'Ordered',
                trade_process_name: t.process_name || ppo.process_name || '',
                trade_delivery_percentage: 0
              }] : []
            }));
          } else {
            items = [{
              item_code: '—',
              description: ppo.message || 'Process Purchase Order',
              process_name: ppo.process_name || '',
              quantity: 1,
              delivered_qty: 0,
              delivery_date: ppo.delivery_date || ppo.date_of_end,
              status: ppo.status || 'ordered',
              unit_price: parseFloat(ppo.basic_value || 0),
              linked_operations: tradeCode ? [{
                operation_type: 'TRADE',
                trade_ref: tradeCode,
                trade_id: ppo.trade_id,
                trade_type: 'BUY_PROCESS',
                trade_status: ppo.status || 'Ordered',
                trade_process_name: ppo.process_name || '',
                trade_delivery_percentage: 0
              }] : []
            }];
          }

          buyProcessOrders.push({
            groupKey: ppo.po_no,
            type: 'PPO',
            number: ppo.po_no,
            date: ppo.date_of_start || ppo.created_at,
            partyId: ppo.party || ppo.seller || '—',
            partyName: ppo.seller || ppo.party || '',
            items,
            tradeId: ppo.trade_id,
            navigatePath: tradeCode ? `/trade/${encodeURIComponent(tradeCode)}` : `/order/${encodeURIComponent(ppo.po_no)}`,
          });
        });

        (processROs || []).forEach(pro => {
          if (!pro.ro_no || seenProcessKeys.has(pro.ro_no)) return;
          seenProcessKeys.add(pro.ro_no);
          let items = [];
          const tradeCode = pro.trade_id ? (String(pro.trade_id).startsWith('TRD-') ? pro.trade_id : `TRD-PRO-${String(pro.trade_id).padStart(4, '0')}`) : '';
          const targetItems = Array.isArray(pro.target_items) ? pro.target_items : (Array.isArray(pro.items) ? pro.items : []);
          if (targetItems.length > 0) {
            items = targetItems.map(t => ({
              item_code: t.item_code || '—',
              description: t.description || '—',
              process_name: t.process_name || pro.process_name || '',
              quantity: parseFloat(t.qty || t.quantity || 0),
              delivered_qty: parseFloat(t.delivered_qty || 0),
              delivery_date: t.delivery_date || pro.delivery_date || pro.date_of_end,
              status: t.status || pro.status || 'RO',
              unit_price: parseFloat(t.price || t.rate || pro.basic_value || 0),
              linked_operations: tradeCode ? [{
                operation_type: 'TRADE',
                trade_ref: tradeCode,
                trade_id: pro.trade_id,
                trade_type: 'BUY_PROCESS',
                trade_status: pro.status || 'RO',
                trade_process_name: t.process_name || pro.process_name || '',
                trade_delivery_percentage: 0
              }] : []
            }));
          } else {
            items = [{
              item_code: '—',
              description: pro.message || 'Process Release Order',
              process_name: pro.process_name || '',
              quantity: 1,
              delivered_qty: 0,
              delivery_date: pro.delivery_date || pro.date_of_end,
              status: pro.status || 'RO',
              unit_price: parseFloat(pro.basic_value || 0),
              linked_operations: tradeCode ? [{
                operation_type: 'TRADE',
                trade_ref: tradeCode,
                trade_id: pro.trade_id,
                trade_type: 'BUY_PROCESS',
                trade_status: pro.status || 'RO',
                trade_process_name: pro.process_name || '',
                trade_delivery_percentage: 0
              }] : []
            }];
          }

          buyProcessOrders.push({
            groupKey: pro.ro_no,
            type: 'PRO',
            number: pro.ro_no,
            date: pro.date_of_start || pro.created_at,
            partyId: pro.party || pro.seller || '—',
            partyName: pro.seller || pro.party || '',
            items,
            tradeId: pro.trade_id,
            navigatePath: tradeCode ? `/trade/${encodeURIComponent(tradeCode)}` : `/release-order/${encodeURIComponent(pro.ro_no)}`,
          });
        });

        // Filter by order type: ALL, PO, RO, BUY_PROCESS
        let filteredOrders = sellOrders;
        if (orderFilter === 'PO') {
          filteredOrders = sellOrders.filter(ord => ord.type === 'PO');
        } else if (orderFilter === 'RO') {
          filteredOrders = sellOrders.filter(ord => ord.type === 'RO');
        } else if (orderFilter === 'BUY_PROCESS') {
          filteredOrders = buyProcessOrders;
        }

        filteredOrders.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        let displayedOrders = filteredOrders;
        if (orderSearchQuery.trim()) {
          const q = orderSearchQuery.toLowerCase();
          displayedOrders = filteredOrders.filter(ord =>
            ord.number.toLowerCase().includes(q) ||
            ord.partyId.toLowerCase().includes(q) ||
            (ord.partyName||'').toLowerCase().includes(q) ||
            (ord.items||[]).some(i =>
              (i.item_code||'').toLowerCase().includes(q) ||
              (i.description||'').toLowerCase().includes(q) ||
              (i.linked_operations||[]).some(lo =>
                (lo.trade_ref||'').toLowerCase().includes(q) ||
                (lo.job_ref||'').toLowerCase().includes(q)
              )
            )
          );
        }

        let sn = 0;
        const flatRows = [];
        displayedOrders.forEach(ord => {
          (ord.items||[]).forEach((item, idx) => {
            sn++;
            flatRows.push({
              ...item,
              _sn:          sn,
              _groupKey:    ord.groupKey,
              _type:        ord.type,
              _number:      ord.number,
              _date:        ord.date,
              _partyId:     ord.partyId,
              _partyName:   ord.partyName,
              _isFirst:     idx === 0,
              _groupSize:   (ord.items||[]).length,
              _navigatePath: ord.navigatePath,
            });
          });
        });

        const isLoadingAll = posLoading || rosLoading || pposLoading || prosLoading;

        const TH = ({ children, align = 'left', className = '', style = {} }) => (
          <th
            className={`px-2 py-1.5 text-[9.5px] font-black uppercase tracking-wider whitespace-nowrap border-b-2 border-r select-none ${className}`}
            style={{
              textAlign: align,
              backgroundColor: 'color-mix(in srgb, var(--text-primary, #0f172a) 8%, var(--bg-form, #ffffff))',
              color: 'var(--text-primary, #0f172a)',
              borderColor: 'var(--border-color, #cbd5e1)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              ...style
            }}
          >
            {children}
          </th>
        );

        const TD = ({ children, align = 'left', className = '', style = {} }) => (
          <td
            className={`px-2 py-1.5 text-[11px] border-r last:border-r-0 ${className}`}
            style={{ textAlign: align, borderColor: 'var(--border-color)', ...style }}
          >
            {children}
          </td>
        );

        const StatusBadge = ({ status }) => {
          const v = (status||'').toLowerCase();
          let s = { color:'var(--theme-secondary)', background:'rgba(217,53,45,0.06)', border:'1px solid var(--theme-secondary)' };
          if (v.startsWith('delivered')||v==='received'||v==='completed') s={color:'#15803d',background:'#f0fdf4',border:'1px solid #86efac'};
          else if (v.includes('delivery')||v.includes('partial')) s={color:'#b45309',background:'#fef3c7',border:'1px solid #fcd34d'};
          else if (v==='shipped'||v==='in transit') s={color:'#1d4ed8',background:'#eff6ff',border:'1px solid #93c5fd'};
          else if (v.includes('progress')) s={color:'#4338ca',background:'#eef2ff',border:'1px solid #a5b4fc'};
          else if (v==='ordered') s={color:'#6d28d9',background:'#f5f3ff',border:'1px solid #c4b5fd'};
          else if (v==='cancelled') s={color:'#9f1239',background:'#fff1f2',border:'1px solid #fca5a5'};
          else if (v.includes('await')||v==='pending') s={color:'#92400e',background:'#fffbeb',border:'1px solid #fcd34d'};
          return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wide whitespace-nowrap" style={s}>
              {status || '—'}
            </span>
          );
        };

        return (
          <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-app)' }}>
            {/* Top Bar with Filter Tabs: All, PO, RO */}
            <div
              className="px-4 py-2.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0"
              style={{ backgroundColor: 'var(--bg-form,white)', borderColor: 'var(--border-color)' }}
            >
              {/* Filter Tabs for Customer Orders */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setOrderFilter('ALL')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    orderFilter === 'ALL'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>All</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      orderFilter === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {sellOrders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderFilter('PO')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    orderFilter === 'PO'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <TrendingUp size={14} />
                  <span>Purchase Orders (PO)</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      orderFilter === 'PO' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {sellOrders.filter(o => o.type === 'PO').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderFilter('RO')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    orderFilter === 'RO'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <FileOutput size={14} />
                  <span>Release Orders (RO)</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      orderFilter === 'RO' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {sellOrders.filter(o => o.type === 'RO').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderFilter('BUY_PROCESS')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    orderFilter === 'BUY_PROCESS'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Workflow size={14} />
                  <span>Buy Process</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      orderFilter === 'BUY_PROCESS' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {buyProcessOrders.length}
                  </span>
                </button>
              </div>

              {/* Search Bar & Order Counter */}
              <div className="flex items-center gap-2.5 flex-1 sm:max-w-md ml-auto w-full">
                <div
                  className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-1.5 transition-colors"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'white' }}
                  onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--theme-secondary)'}
                  onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <Search size={13} style={{ color: 'var(--theme-secondary)', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search Sell orders (PO, RO, Party, Item)…"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="w-full bg-transparent focus:outline-none text-[11px] font-semibold placeholder:font-normal"
                    style={{ color: 'var(--text-primary)' }}
                  />
                  {orderSearchQuery && (
                    <button onClick={() => setOrderSearchQuery('')} className="shrink-0 cursor-pointer" style={{ color: 'var(--theme-secondary)' }}>
                      <X size={12} />
                    </button>
                  )}
                </div>

                <span className="text-[10px] font-bold shrink-0 whitespace-nowrap" style={{ color: 'var(--text-primary)', opacity: 0.65 }}>
                  {isLoadingAll ? 'Loading…' : `${flatRows.length} item${flatRows.length !== 1 ? 's' : ''} · ${displayedOrders.length} order${displayedOrders.length !== 1 ? 's' : ''}`}
                </span>

                <button
                  type="button"
                  onClick={refreshAllOrders}
                  title="Refresh orders"
                  disabled={isLoadingAll}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shrink-0 cursor-pointer"
                >
                  <RefreshCw size={13} className={isLoadingAll ? 'animate-spin' : ''} style={{ color: 'var(--theme-secondary)' }} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {flatRows.length === 0 && !isLoadingAll ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-[11px] font-bold" style={{ color: 'var(--text-primary)', opacity: 0.35 }}>
                    {orderSearchQuery
                      ? 'No results match your search.'
                      : 'No orders found.'}
                  </p>
                </div>
              ) : (
                <OrderTable
                  flatRows={flatRows}
                  fmtDate={fmtDate}
                  fmtAmt={fmtAmt}
                  fmtQty={fmtQty}
                  currentUser={currentUser}
                  navigate={navigate}
                  TH={TH}
                  TD={TD}
                  StatusBadge={StatusBadge}
                />
              )}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return activeTab === 'purchase-order' ? (
    renderContent()
  ) : (
    <div className="p-6 transition-colors duration-300">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl border border-slate-200 bg-[var(--bg-form)] p-6 shadow-sm transition-colors duration-300">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

function OrderTable({ flatRows, fmtDate, fmtAmt, fmtQty, currentUser, navigate, TH, TD, StatusBadge }) {
  const [hoveredGroup, setHoveredGroup] = React.useState(null);

  if (!flatRows.length) return null;

  return (
    <div className="overflow-x-auto w-full">
      <table
        className="w-full border-collapse"
        style={{ minWidth: '1000px', tableLayout: 'fixed' }}
      >
        <colgroup>
          <col style={{ width: '28px' }} />    {/* # */}
          <col style={{ width: '105px' }} />   {/* Order No */}
          <col style={{ width: '68px' }} />    {/* Date */}
          <col style={{ width: '105px' }} />   {/* Party */}
          <col style={{ width: '85px' }} />    {/* Item Code */}
          <col style={{ width: '140px' }} />   {/* Description */}
          <col style={{ width: '80px' }} />    {/* Pending / Total */}
          <col style={{ width: '70px' }} />    {/* Delivery Date */}
          <col style={{ width: '185px' }} />   {/* Linked Operator */}
          <col style={{ width: '95px' }} />    {/* Status */}
          <col style={{ width: '75px' }} />    {/* Rate */}
        </colgroup>

        <thead className="border-b-2" style={{ borderColor: 'var(--border-color, #cbd5e1)' }}>
          <tr style={{ backgroundColor: 'color-mix(in srgb, var(--text-primary, #0f172a) 8%, var(--bg-form, #ffffff))' }}>
            <TH align="center">#</TH>
            <TH>Order No</TH>
            <TH>Date</TH>
            <TH>Party</TH>
            <TH>Item Code</TH>
            <TH>Description</TH>
            <TH align="right">Pending&nbsp;/&nbsp;Total</TH>
            <TH>Delivery Date</TH>
            <TH>Linked Operator</TH>
            <TH align="center">Status</TH>
            <TH align="right">Rate</TH>
          </tr>
        </thead>

        <tbody>
          {flatRows.map((row, idx) => {
            const isHovered   = hoveredGroup === row._groupKey;
            const pendingQty  = Math.max(0, (parseFloat(row.quantity)||0) - (parseFloat(row.delivered_qty)||0));
            const rawStatus   = (row.status || '').trim();
            const qty         = parseFloat(row.quantity) || 0;
            const delQty      = parseFloat(row.delivered_qty) || 0;
            const delPct      = qty > 0 ? Math.min(100, Math.round((delQty / qty) * 100)) : 0;

            let sellStatus = rawStatus || 'Ordered';
            if (rawStatus.toLowerCase() === 'cancelled') {
              sellStatus = 'Cancelled';
            } else if (delPct >= 100) {
              sellStatus = 'Delivered 100%';
            } else if (delPct > 0) {
              sellStatus = `Delivery ${delPct}%`;
            } else if (rawStatus.toLowerCase() === 'delivered') {
              sellStatus = 'Delivered 100%';
            } else if (!rawStatus) {
              sellStatus = 'Ordered';
            }

            const isEvenGroup = (() => {
              let g = 0, lastKey = null;
              for (let i = 0; i < flatRows.length; i++) {
                if (flatRows[i]._groupKey !== lastKey) { g++; lastKey = flatRows[i]._groupKey; }
                if (i === idx) return g % 2 === 0;
              }
              return false;
            })();

            let rowBg;
            if (isHovered) {
              rowBg = 'rgba(217,53,45,0.07)';
            } else if (row._isFirst && isEvenGroup) {
              rowBg = 'rgba(0,0,0,0.022)';
            } else {
              rowBg = 'transparent';
            }

            const topBorderStyle = row._isFirst && idx > 0
              ? { borderTop: '2px solid var(--border-color)' }
              : {};

            return (
              <tr
                key={`${row._groupKey}-${row.item_code}-${idx}`}
                style={{ backgroundColor: rowBg, cursor: 'pointer', transition: 'background 0.12s', ...topBorderStyle }}
                onMouseEnter={() => setHoveredGroup(row._groupKey)}
                onMouseLeave={() => setHoveredGroup(null)}
                onClick={() => navigate(row._navigatePath)}
              >
                <TD align="center">
                  <span className="font-mono text-[9px] font-bold" style={{ color: 'var(--theme-secondary)', opacity: 0.6 }}>
                    {row._sn}
                  </span>
                </TD>

                <TD>
                  {row._isFirst ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span
                        className="font-mono font-black text-[10px] leading-tight"
                        style={{ color: isHovered ? 'var(--theme-secondary)' : 'var(--text-primary)' }}
                      >
                        {row._number}
                      </span>
                      <span
                        className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide"
                        style={
                          row._type === 'RO'
                            ? { color: '#0d9488', background: '#f0fdfa', border: '1px solid #99f6e4' }
                            : row._type === 'PO'
                            ? { color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0' }
                            : row._type === 'PRO' || row._type === 'PPO'
                            ? { color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a' }
                            : { color: 'var(--theme-secondary)', background: 'rgba(217,53,45,0.08)', border: '1px solid var(--theme-secondary)' }
                        }
                      >
                        {row._type}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[9px]" style={{ color: 'transparent', userSelect: 'none' }}>·</span>
                  )}
                </TD>

                <TD>
                  {row._isFirst ? (
                    <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)', opacity: 0.7 }}>
                      {fmtDate(row._date)}
                    </span>
                  ) : null}
                </TD>

                <TD>
                  {row._isFirst ? (
                    <div className="flex flex-col min-w-0" title={row._partyName ? `${row._partyName} (${row._partyId})` : row._partyId}>
                      {row._partyName && row._partyName !== row._partyId && row._partyName !== '—' ? (
                        <>
                          <span className="font-bold text-[11px] leading-tight truncate block" style={{ color: 'var(--text-primary)' }}>
                            {row._partyName}
                          </span>
                          <span className="font-mono text-[9px] text-slate-500 font-semibold truncate block">
                            {row._partyId}
                          </span>
                        </>
                      ) : (
                        <span className="font-mono font-bold text-[10px] whitespace-nowrap overflow-hidden block" style={{ color: 'var(--text-primary)' }}>
                          {row._partyId}
                        </span>
                      )}
                    </div>
                  ) : null}
                </TD>

                <TD>
                  <span
                    className="font-mono font-black text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap"
                    style={{
                      color: 'var(--theme-secondary)',
                      borderColor: 'var(--theme-secondary)',
                      backgroundColor: 'rgba(217,53,45,0.05)'
                    }}
                  >
                    {row.item_code}
                  </span>
                </TD>

                <TD>
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className="font-semibold text-[11px] leading-tight block truncate flex-1"
                      style={{ color: 'var(--text-primary)' }}
                      title={row.description || '—'}
                    >
                      {row.description || <span style={{ opacity: 0.25 }}>—</span>}
                    </span>
                    {row.process_name && (
                      <span
                        className="text-[8px] font-bold text-amber-900 bg-amber-100/80 border border-amber-300 px-1 py-0.2 rounded shrink-0 whitespace-nowrap"
                        title={`Process: ${row.process_name}`}
                      >
                        ⚙ {row.process_name}
                      </span>
                    )}
                  </div>
                </TD>

                <TD align="right">
                  <span className="font-mono font-black text-[11px]" style={{ color: pendingQty > 0 ? 'var(--theme-secondary)' : '#15803d' }}>
                    {fmtQty(pendingQty)}
                  </span>
                  <span className="font-mono text-[9px]" style={{ color: 'var(--text-primary)', opacity: 0.35 }}>
                    /{fmtQty(row.quantity)}
                  </span>
                </TD>

                <TD>
                  <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)', opacity: 0.65 }}>
                    {fmtDate(row.delivery_date)}
                  </span>
                </TD>

                {/* Linked Operator (Trade Type, Trade ID, Status, Delivery %) */}
                <TD>
                  {row.linked_operations && row.linked_operations.length > 0 ? (
                    <div className="flex flex-col gap-1.5 py-1">
                      {row.linked_operations.map((op, opIdx) => {
                        const isTrade = op.operation_type === 'TRADE';
                        const rawType = (op.trade_type || (isTrade ? 'Trade' : 'Manufacture')).toUpperCase();
                        const isBuyProcess = rawType.includes('PROCESS');
                        const tradeType = isBuyProcess ? 'Buy Process' : rawType.replace(/_/g, ' ');
                        const opId = isTrade ? (op.trade_ref || `Trade #${op.trade_id}`) : (op.job_ref || `Job #${op.job_id}`);
                        const procName = op.trade_process_name || (!isTrade ? op.job_ref : '');

                        let typeBadgeClass = 'bg-amber-100/70 text-amber-900 border-amber-200';
                        if (isBuyProcess) {
                          typeBadgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
                        } else if (!isTrade) {
                          typeBadgeClass = 'bg-indigo-100/70 text-indigo-900 border-indigo-200';
                        }

                        let statText = 'Pending';
                        let statBadgeColor = 'bg-slate-100 text-slate-700 border-slate-200';

                        if (isTrade) {
                          const pct = parseFloat(op.trade_delivery_percentage) || 0;
                          const rawStat = (op.trade_status || 'ordered').toLowerCase();
                          if (pct >= 100 || rawStat === 'delivered' || rawStat === 'completed') {
                            statText = 'Delivered 100%';
                            statBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-300';
                          } else if (pct > 0 || rawStat.includes('partial')) {
                            statText = `Delivery ${pct}%`;
                            statBadgeColor = 'bg-amber-50 text-amber-800 border-amber-300';
                          } else {
                            statText = op.trade_status || 'Ordered';
                            statBadgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
                          }
                        } else {
                          const rawStat = (op.job_status || 'pending').toLowerCase();
                          const formattedStat = (op.job_status || 'Pending').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                          statText = formattedStat;
                          if (rawStat === 'completed' || rawStat === 'done') {
                            statBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-300';
                          } else if (rawStat.includes('progress')) {
                            statBadgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-300';
                          } else {
                            statBadgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                          }
                        }

                        return (
                          <div
                            key={`dash-link-${op.id || opIdx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isTrade) {
                                const tradeCode = op.trade_ref || op.trade_id;
                                if (tradeCode) navigate(`/trade/${encodeURIComponent(tradeCode)}`);
                              } else {
                                const jobQuery = op.job_ref || (op.job_id ? String(op.job_id) : '');
                                navigate(`/manufactures?q=${encodeURIComponent(jobQuery)}`);
                              }
                            }}
                            title={isTrade ? `Click to open Trade ${opId}${procName ? ` (${procName})` : ''}` : `Click to open Manufacture ${opId}`}
                            className="flex items-center gap-1.5 p-1 rounded-md bg-white border border-slate-200 shadow-2xs hover:border-[var(--theme-color)] hover:bg-slate-50 transition-all cursor-pointer group/link"
                          >
                            <span className={`text-[7.5px] font-black uppercase px-1 py-0.2 rounded tracking-wider shrink-0 border ${typeBadgeClass}`}>
                              {tradeType}
                            </span>
                            <span className="font-mono font-bold text-[9.5px] text-slate-800 truncate group-hover/link:text-[var(--theme-color)] group-hover/link:underline" title={opId}>
                              {opId}
                            </span>
                            {procName && procName !== opId && (
                              <span className="text-[7.5px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded truncate max-w-[75px] shrink-0" title={`Process: ${procName}`}>
                                ⚙ {procName}
                              </span>
                            )}
                            <span className={`ml-auto text-[8.5px] font-bold px-1.5 py-0.2 rounded-full border whitespace-nowrap shrink-0 ${statBadgeColor}`}>
                              {statText}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">No linked operator</span>
                  )}
                </TD>

                {/* Status (Sell Order Status / Delivery %) */}
                <TD align="center">
                  <StatusBadge status={sellStatus} />
                </TD>

                {/* Rate */}
                <TD align="right">
                  {hasPermission(currentUser, 'view_pricing') ? (
                    <span className="font-mono font-bold text-[11px]" style={{ color: 'var(--text-primary)' }}>
                      ₹{fmtAmt(row.unit_price)}
                    </span>
                  ) : (
                    <span style={{ opacity: 0.25, fontSize: '10px' }}>***</span>
                  )}
                </TD>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   TradeComparisonChart — SVG Line Graph, Top 10 Trades by Delivered %
───────────────────────────────────────────────────────────────────────────── */
function TradeComparisonChart({ trades }) {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 150);
    return () => clearTimeout(t);
  }, [trades]);

  const top10 = [...(trades || [])]
    .sort((a, b) => parseFloat(b.delivered_pct || 0) - parseFloat(a.delivered_pct || 0))
    .slice(0, 10);

  const TYPES = [
    { key: 'Sell', label: 'Sell', color: '#10b981' },
    { key: 'Buy', label: 'Buy', color: '#3b82f6' },
    { key: 'Buy Process', label: 'Buy Process', color: '#8b5cf6' },
    { key: 'Sell Process', label: 'Sell Process', color: '#f59e0b' },
  ];

  const typeCounts = TYPES.map(t => ({
    ...t,
    count: (trades || []).filter(
      tr => (tr.trade_type || '').toLowerCase().replace(/_/g, ' ') === t.key.toLowerCase()
    ).length,
  }));

  if (!top10.length) {
    return (
      <div className="rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs font-semibold shadow-sm bg-[var(--bg-form,white)]">
        No trade data available for chart.
      </div>
    );
  }

  const W = 780, H = 280;
  const PAD = { top: 32, right: 24, bottom: 48, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const n = top10.length;
  const stepX = n > 1 ? chartW / (n - 1) : chartW;

  const points = top10.map((trade, i) => {
    const pct = Math.min(100, Math.max(0, parseFloat(trade.delivered_pct || 0)));
    const x = PAD.left + (n === 1 ? chartW / 2 : i * stepX);
    const y = PAD.top + chartH - (pct / 100) * chartH;
    return { x, y, pct, trade };
  });

  const linePath = points.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD.top + chartH} L ${points[0].x} ${PAD.top + chartH} Z`;

  const Y_LINES = [0, 25, 50, 75, 100];

  return (
    <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-[var(--bg-form,white)]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
            Trade Activity Trend
          </h3>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            Delivery progression curve across top 10 recent transactions
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {TYPES.map(t => (
            <div key={t.key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <span className="text-[11px] font-bold text-slate-500">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 divide-x divide-slate-200 border-b border-slate-200">
        {typeCounts.map(t => (
          <div key={t.key} className="px-4 py-3 flex items-center gap-2.5">
            <span className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: t.color, opacity: 0.8 }} />
            <div>
              <p className="text-xl font-black leading-tight" style={{ color: t.color }}>{t.count}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{t.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* SVG Line Chart */}
      <div className="px-2 py-4 overflow-x-auto">
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: '520px', display: 'block' }}
          onMouseLeave={() => { setActiveTooltip(null); setHoveredId(null); }}
        >
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--theme-color, #2563eb)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--theme-color, #2563eb)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {Y_LINES.map(pct => {
            const y = PAD.top + chartH - (pct / 100) * chartH;
            return (
              <g key={pct}>
                <line
                  x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                  stroke={pct === 0 ? '#94a3b8' : '#e2e8f0'}
                  strokeWidth={pct === 0 ? 1.5 : 0.75}
                  strokeDasharray={pct === 0 ? undefined : '4 3'}
                />
                <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={9} fontWeight="700" fill="#94a3b8">
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Area under curve */}
          <path
            d={areaPath}
            fill="url(#lineGradient)"
            style={{ opacity: animated ? 1 : 0, transition: 'opacity 0.8s ease-in-out' }}
          />

          {/* Smooth Line Path */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--theme-color, #2563eb)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: chartW * 2,
              strokeDashoffset: animated ? 0 : chartW * 2,
              transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />

          {/* Data Points */}
          {points.map((pt, i) => {
            const isHov = hoveredId === pt.trade.trade_id;
            return (
              <g key={pt.trade.trade_id || i}>
                {/* Vertical guide line on hover */}
                {isHov && (
                  <line
                    x1={pt.x} y1={PAD.top} x2={pt.x} y2={PAD.top + chartH}
                    stroke="var(--theme-color, #2563eb)"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    opacity={0.4}
                  />
                )}

                {/* Outer Glow Ring on Hover */}
                {isHov && (
                  <circle cx={pt.x} cy={pt.y} r={8} fill="var(--theme-color, #2563eb)" opacity={0.25} />
                )}

                {/* Main Point Circle */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHov ? 5 : 3.5}
                  fill="#ffffff"
                  stroke="var(--theme-color, #2563eb)"
                  strokeWidth={isHov ? 2.5 : 2}
                  style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                  onMouseEnter={() => {
                    setHoveredId(pt.trade.trade_id);
                    setActiveTooltip(pt);
                  }}
                />

                {/* X Axis Label */}
                <text
                  x={pt.x}
                  y={PAD.top + chartH + 18}
                  textAnchor="middle"
                  fontSize={8}
                  fontWeight="700"
                  fill={isHov ? 'var(--theme-color,#2563eb)' : '#94a3b8'}
                >
                  {String(pt.trade.trade_id).length > 8 ? String(pt.trade.trade_id).slice(0, 7) + '…' : pt.trade.trade_id}
                </text>
              </g>
            );
          })}

          {/* Tooltip Overlay */}
          {activeTooltip && (() => {
            const { x, y, pct, trade } = activeTooltip;
            const bw = 130, bh = 64;
            const tx = Math.max(4, Math.min(W - bw - 4, x - bw / 2));
            const ty = Math.max(4, y - bh - 12);

            return (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={tx} y={ty} width={bw} height={bh} rx={6} fill="#0f172a" opacity={0.94} />
                <text x={tx + 10} y={ty + 16} fontSize={8} fontWeight="800" fill="#fff" opacity={0.5}>TRADE ID</text>
                <text x={tx + 10} y={ty + 28} fontSize={11} fontWeight="900" fill="#fff">{trade.trade_id}</text>
                <text x={tx + bw - 10} y={ty + 26} fontSize={15} fontWeight="900" fill="#38bdf8" textAnchor="end">{pct.toFixed(1)}%</text>
                <text x={tx + bw - 10} y={ty + 38} fontSize={8} fontWeight="700" fill="#94a3b8" textAnchor="end">Delivered</text>
                <text x={tx + 10} y={ty + 52} fontSize={8} fontWeight="600" fill="#94a3b8">
                  {(trade.party_id || trade.contact_name || '—').slice(0, 18)}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}