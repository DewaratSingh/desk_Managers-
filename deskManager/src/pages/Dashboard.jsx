import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import AddBuyerView from './AddBuyer';
import AddCustomerView from './AddCustomer';
import AddItemView from './AddItem';
import GstCategoryView from './GstCategory';
import ArcView from './Arc';
import RfqForm from '../form/RfqForm';
import QuotationForm from '../form/QuotationForm';

export default function Dashboard({ activeTab: propActiveTab }) {
  const [activeTab, setActiveTab] = useState(propActiveTab || 'dashboard');
  const navigate = useNavigate();
  const location = useLocation();
  const user = { username: 'operator', role: 'admin' };

  const [trades, setTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [posLoading, setPosLoading]         = useState(false);
  const [releaseOrders, setReleaseOrders]   = useState([]);
  const [rosLoading, setRosLoading]         = useState(false);
  const [orderFilter, setOrderFilter]       = useState('ALL'); // 'ALL', 'PO', 'RO'

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
    if (activeTab === 'dashboard') fetchTrades();
    if (activeTab === 'purchase-order') {
      fetchPurchaseOrders();
      fetchReleaseOrders();
    }
  }, [activeTab]);

  const fetchTrades = async () => {
    setTradesLoading(true);
    try {
      const res = await fetch('/api/trades');
      if (res.ok) setTrades(await res.json());
    } catch (err) { console.error('Failed to fetch trades:', err); }
    finally { setTradesLoading(false); }
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
              <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
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
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Trades Directory</h3>
                <p className="text-xs text-slate-400 font-medium">Browse active client and purchase pipeline trades.</p>
              </div>

              {tradesLoading && trades.length === 0 ? (
                <p className="text-center text-xs font-bold text-slate-400 py-8 animate-pulse">Loading Trades...</p>
              ) : trades.length === 0 ? (
                <p className="text-center text-xs font-bold text-slate-400 py-8">No trade records found. Click "SELL" to get started.</p>
              ) : (
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
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
              )}
            </div>
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

        const showPOs = orderFilter === 'ALL' || orderFilter === 'PO';
        const showROs = orderFilter === 'ALL' || orderFilter === 'RO';

        const displayOrders = [];

        if (showPOs) {
          purchaseOrders.forEach(po => {
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

            {/* Filter Pills */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              {[
                { id: 'ALL', label: 'All Orders' },
                { id: 'PO',  label: 'Purchase Orders (PO)' },
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
              <p className="text-center text-xs font-bold text-slate-400 py-10">No orders found.</p>
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
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={() => alert('Logged out')} />

      <main className="flex-1">
        {activeTab === 'add-buyer' || 
         activeTab === 'add-customer' || 
         activeTab === 'add-item' || 
         activeTab === 'gst-category' || 
         activeTab === 'arc' || 
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
