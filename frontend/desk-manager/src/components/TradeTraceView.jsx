import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowRight,
  Lock,
  X,
  Edit2,
  Plus,
  Truck,
  CheckSquare,
  DollarSign
} from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

export default function TradeTraceView({ setActiveTab }) {
  const { trade_id } = useParams();
  const navigate = useNavigate();
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTraceData = async () => {
      setLoading(true);
      setError(null);
      try {
        const savedToken = localStorage.getItem('dm_token');
        const res = await fetch(`${API_BASE_URL}/trades/${encodeURIComponent(trade_id)}/trace`, {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });
        if (!res.ok) throw new Error('Failed to load trade trace details');
        const data = await res.json();
        setTraceData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (trade_id) {
      fetchTraceData();
    }
  }, [trade_id]);

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

  const handleBack = () => {
    if (setActiveTab) setActiveTab('dashboard');
    navigate('/');
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f1f5f9] min-h-screen gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        <span className="text-lg font-bold text-slate-400 font-mono tracking-widest uppercase">Loading Trace Data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-8 bg-[#f1f5f9] min-h-screen">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={handleBack}
            className="mb-6 flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 font-bold transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft size={18} /> Back to Dashboard
          </button>
          <div className="p-6 bg-red-50 border-2 border-red-200 rounded-2xl text-red-700 text-lg font-bold flex items-center gap-3 shadow-sm">
            <AlertCircle size={24} />
            {error}
          </div>
        </div>
      </div>
    );
  }
  const traceDocs = traceData && traceData.documents
    ? traceData.documents.filter(d => ['DN', 'INVOICE', 'GRN', 'PAYMENT'].includes(d.type.toUpperCase()))
    : [];

  const orderDoc = traceData
    ? (traceData.purchase_order || traceData.release_order)
    : null;
  const isRO = traceData && traceData.release_order ? true : false;
  const isBuy = traceData && traceData.received_quotation ? true : false;

  return (
    <div className="flex-1 p-4 sm:p-8 lg:p-12 bg-[#f1f5f9] min-h-screen overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b-2 border-slate-200">
          <div className="space-y-1">
            <button
              onClick={handleBack}
              className="mb-4 flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 font-bold transition-all shadow-sm cursor-pointer w-fit"
            >
              <ArrowLeft size={18} /> Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-slate-800">{isRO ? 'Pipeline Trace (ARC)' : 'Pipeline Trace'}</h1>
            <p className="text-base text-slate-500 font-medium mt-1 font-mono">Ref: {trade_id}</p>
          </div>
        </div>

        {traceData && !traceData.rfq && !traceData.release_order && !traceData.received_quotation && (
          <div className="bg-white border-2 border-slate-200 rounded-[2rem] p-16 text-center space-y-6 shadow-sm">
            <div className="text-4xl text-slate-350">📄</div>
            <h3 className="text-xl font-bold text-slate-800">Empty Trade Sequence</h3>
            <p className="text-slate-500 max-w-md mx-auto">No RFQ has been linked to this trade workspace yet. Link documents using the Trade manager tab to visualize trace progress.</p>
          </div>
        )}

        {traceData && (traceData.rfq || traceData.release_order || traceData.received_quotation) && (
          <div className="space-y-10">
            {/* Visual Stepper */}
            <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] border-2 border-slate-200 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 opacity-50" />
               
              <div className="flex items-center justify-between px-2 sm:px-4 relative z-10 overflow-x-auto">
                {traceData.rfq && !isRO && (
                  <>
                    <div 
                      onClick={() => navigate(`/rfq/${encodeURIComponent(traceData.rfq.rfq_no)}`)}
                      className="flex flex-col items-center gap-2 cursor-pointer group shrink-0"
                    >
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm sm:text-base group-hover:bg-blue-700 shadow-lg transition-all group-hover:scale-110">
                        1
                      </div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">RFQ</span>
                    </div>
                    
                    <div className="flex-1 h-1 bg-slate-100 mx-1 sm:mx-2 relative rounded-full min-w-[12px]">
                      {traceData.quotation && <div className="absolute inset-0 bg-blue-600 rounded-full" />}
                    </div>

                    <div 
                      onClick={() => {
                        if (traceData.quotation) {
                          navigate(`/quotation/${encodeURIComponent(traceData.quotation.quotation_no)}`);
                        }
                      }}
                      className={`flex flex-col items-center gap-2 shrink-0 ${traceData.quotation ? 'cursor-pointer group' : 'opacity-30'}`}
                    >
                      <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center font-black text-sm sm:text-base transition-all
                        ${traceData.quotation ? 'bg-blue-600 text-white group-hover:bg-blue-700 shadow-lg group-hover:scale-110' : 'bg-slate-50 text-slate-400 border-2 border-slate-100'}`}>
                        2
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-wider ${traceData.quotation ? 'text-slate-500 group-hover:text-blue-600 transition-colors' : 'text-slate-400'}`}>Quotation</span>
                    </div>

                    <div className="flex-1 h-1 bg-slate-100 mx-1 sm:mx-2 relative rounded-full min-w-[12px]">
                      {orderDoc && <div className="absolute inset-0 bg-blue-600 rounded-full" />}
                    </div>
                  </>
                )}

                {isBuy && traceData.received_quotation && (
                  <>
                    <div 
                      onClick={() => navigate(`/received-quotation/${encodeURIComponent(traceData.received_quotation.received_quotation_no)}`)}
                      className="flex flex-col items-center gap-2 cursor-pointer group shrink-0"
                    >
                      <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-sm sm:text-base group-hover:bg-blue-700 shadow-lg transition-all group-hover:scale-110">
                        1
                      </div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">Received Quotation</span>
                    </div>
                    
                    <div className="flex-1 h-1 bg-slate-100 mx-1 sm:mx-2 relative rounded-full min-w-[12px]">
                      {orderDoc && <div className="absolute inset-0 bg-blue-600 rounded-full" />}
                    </div>
                  </>
                )}

                <div 
                  onClick={() => {
                    if (orderDoc) {
                      navigate(isRO ? `/release-order/${encodeURIComponent(orderDoc.ro_no)}` : `/purchase-order/${encodeURIComponent(orderDoc.po_no)}`);
                    }
                  }}
                  className={`flex flex-col items-center gap-2 shrink-0 ${orderDoc ? 'cursor-pointer group' : 'opacity-30'}`}
                >
                  <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center font-black text-sm sm:text-base transition-all
                    ${orderDoc ? 'bg-emerald-600 text-white group-hover:bg-emerald-700 shadow-lg group-hover:scale-110' : 'bg-slate-50 text-slate-400 border-2 border-slate-100'}`}>
                    {traceData.rfq ? '3' : isBuy ? '2' : '1'}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${orderDoc ? 'text-slate-500 group-hover:text-emerald-600 transition-colors' : 'text-slate-400'}`}>{isRO ? 'Release Order' : 'Purchase Order'}</span>
                </div>

                <div className="flex-1 h-1 bg-slate-100 mx-1 sm:mx-2 relative rounded-full min-w-[12px]">
                  {traceData.delivery_notes && traceData.delivery_notes.length > 0 && <div className="absolute inset-0 bg-emerald-600 rounded-full" />}
                </div>

                <div 
                  onClick={() => {
                    if (traceData.delivery_notes && traceData.delivery_notes.length > 0) {
                      scrollToSection('delivery-section');
                    }
                  }}
                  className={`flex flex-col items-center gap-2 shrink-0 ${traceData.delivery_notes && traceData.delivery_notes.length > 0 ? 'cursor-pointer group' : 'opacity-30'}`}
                >
                  <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center font-black text-sm sm:text-base transition-all
                    ${traceData.delivery_notes && traceData.delivery_notes.length > 0 ? 'bg-blue-600 text-white group-hover:bg-blue-700 shadow-lg group-hover:scale-110' : 'bg-slate-50 text-slate-400 border-2 border-slate-100'}`}>
                    {traceData.rfq ? '4' : isBuy ? '3' : '2'}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${traceData.delivery_notes && traceData.delivery_notes.length > 0 ? 'text-slate-500 group-hover:text-blue-600 transition-colors' : 'text-slate-400'}`}>Delivery</span>
                </div>

                <div className="flex-1 h-1 bg-slate-100 mx-1 sm:mx-2 relative rounded-full min-w-[12px]">
                  {traceData.invoices && traceData.invoices.length > 0 && <div className="absolute inset-0 bg-blue-600 rounded-full" />}
                </div>

                <div 
                  onClick={() => {
                    if (traceData.invoices && traceData.invoices.length > 0) {
                      scrollToSection('invoice-section');
                    }
                  }}
                  className={`flex flex-col items-center gap-2 shrink-0 ${traceData.invoices && traceData.invoices.length > 0 ? 'cursor-pointer group' : 'opacity-30'}`}
                >
                  <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center font-black text-sm sm:text-base transition-all
                    ${traceData.invoices && traceData.invoices.length > 0 ? 'bg-emerald-600 text-white group-hover:bg-emerald-700 shadow-lg group-hover:scale-110' : 'bg-slate-50 text-slate-400 border-2 border-slate-100'}`}>
                    {traceData.rfq ? '5' : isBuy ? '4' : '3'}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${traceData.invoices && traceData.invoices.length > 0 ? 'text-slate-500 group-hover:text-emerald-600 transition-colors' : 'text-slate-400'}`}>Invoice</span>
                </div>

                <div className="flex-1 h-1 bg-slate-100 mx-1 sm:mx-2 relative rounded-full min-w-[12px]">
                  {traceData.grns && traceData.grns.length > 0 && <div className="absolute inset-0 bg-emerald-600 rounded-full" />}
                </div>

                <div 
                  onClick={() => {
                    if (traceData.grns && traceData.grns.length > 0) {
                      scrollToSection('grn-section');
                    }
                  }}
                  className={`flex flex-col items-center gap-2 shrink-0 ${traceData.grns && traceData.grns.length > 0 ? 'cursor-pointer group' : 'opacity-30'}`}
                >
                  <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center font-black text-sm sm:text-base transition-all
                    ${traceData.grns && traceData.grns.length > 0 ? 'bg-indigo-600 text-white group-hover:bg-indigo-700 shadow-lg group-hover:scale-110' : 'bg-slate-50 text-slate-400 border-2 border-slate-100'}`}>
                    {traceData.rfq ? '6' : isBuy ? '5' : '4'}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${traceData.grns && traceData.grns.length > 0 ? 'text-slate-500 group-hover:text-indigo-600 transition-colors' : 'text-slate-400'}`}>GRN</span>
                </div>

                <div className="flex-1 h-1 bg-slate-100 mx-1 sm:mx-2 relative rounded-full min-w-[12px]">
                  {traceData.payments && traceData.payments.length > 0 && <div className="absolute inset-0 bg-indigo-600 rounded-full" />}
                </div>

                <div 
                  onClick={() => {
                    if (traceData.payments && traceData.payments.length > 0) {
                      scrollToSection('payment-section');
                    }
                  }}
                  className={`flex flex-col items-center gap-2 shrink-0 ${traceData.payments && traceData.payments.length > 0 ? 'cursor-pointer group' : 'opacity-30'}`}
                >
                  <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center font-black text-sm sm:text-base transition-all
                    ${traceData.payments && traceData.payments.length > 0 ? 'bg-teal-600 text-white group-hover:bg-teal-700 shadow-lg group-hover:scale-110' : 'bg-slate-50 text-slate-400 border-2 border-slate-100'}`}>
                    {traceData.rfq ? '7' : isBuy ? '6' : '5'}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${traceData.payments && traceData.payments.length > 0 ? 'text-slate-500 group-hover:text-teal-600 transition-colors' : 'text-slate-400'}`}>Payment</span>
                </div>
              </div>
            </div>

            {/* Stages */}
            <div className="space-y-12">
              {/* STAGE 1 - RECEIVED QUOTATION FOR BUY FLOW */}
              {isBuy && traceData.received_quotation && (
                <section className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                    <div className="flex items-center gap-5">
                      <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-blue-100 shadow-lg">
                        <FileText size={28} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-800">Received Quotation</h2>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">Created on {fmtDate(traceData.received_quotation.created_at)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/received-quotation/${encodeURIComponent(traceData.received_quotation.received_quotation_no)}`)}
                      className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm rounded-xl transition-all border-2 border-slate-200 cursor-pointer shadow-sm active:scale-95"
                    >
                      View Details <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quotation No</p>
                        <p className="text-sm font-bold text-slate-800">{traceData.received_quotation.received_quotation_no || '—'}</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier ID</p>
                        <p className="text-sm font-bold text-slate-800">{traceData.received_quotation.customer_id || '—'}{traceData.received_quotation.customer_name ? <span className="text-slate-500 font-medium"> ({traceData.received_quotation.customer_name})</span> : ''}</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buyer Name</p>
                        <p className="text-sm font-bold text-slate-800">{traceData.received_quotation.buyer_name || '—'}</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quotation Date</p>
                        <p className="text-sm font-bold text-slate-800">{fmtDate(traceData.received_quotation.quotation_date)}</p>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No. of Items</p>
                        <p className="text-sm font-bold text-slate-800">{traceData.received_quotation.items.length}</p>
                      </div>
                    </div>
                    <div className="mt-10 pt-8 border-t-2 border-slate-50">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">Quotation Items ({traceData.received_quotation.items.length})</p>
                      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                        <table className="w-full text-left border-collapse bg-white">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                            <tr>
                              <th className="px-3 py-3">Item Code</th>
                              <th className="px-3 py-3">Description</th>
                              <th className="px-3 py-3 text-right">Qty</th>
                              <th className="px-3 py-3 text-right">Unit Price</th>
                              <th className="px-3 py-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                            {traceData.received_quotation.items.map((item, idx) => {
                              const amount = (item.quantity || 0) * (parseFloat(item.unit_price) || 0);
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-3 py-3.5 font-mono font-bold text-blue-700">{item.item_code}</td>
                                  <td className="px-3 py-3.5">
                                    <p className="font-semibold text-slate-800">{item.description || '—'}</p>
                                    {item.drawing_number && (
                                      <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                                        DRW: {item.drawing_number}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3.5 text-right font-medium">{item.quantity} {item.unit || 'Piece'}</td>
                                  <td className="px-3 py-3.5 text-right font-mono">₹{(parseFloat(item.unit_price) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-800">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {/* Footer Action Strip */}
                  {!traceData.purchase_order && (
                    <div className="border-t border-slate-200 px-8 py-5 flex items-center gap-4 bg-slate-50/50">
                      <button
                        onClick={() => {
                          if (setActiveTab) setActiveTab('received-quotation');
                          navigate('/', { state: { activeTab: 'received-quotation', editReceivedQuotationNo: traceData.received_quotation.received_quotation_no } });
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm rounded-lg transition-all border border-amber-200 cursor-pointer"
                      >
                        <Edit2 size={16} /> Update Quotation
                      </button>
                      <button
                        onClick={() => {
                          if (setActiveTab) setActiveTab('purchase-order');
                          navigate('/', { state: { activeTab: 'purchase-order', prefillQuotationNo: traceData.received_quotation.received_quotation_no } });
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm rounded-lg transition-all border border-blue-200 cursor-pointer"
                      >
                        <Plus size={16} /> Add PO
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* STAGE 1 */}
              {traceData.rfq && !isRO && (
                <section className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                  <div className="flex items-center gap-5">
                    <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-blue-100 shadow-lg">
                      <Clock size={28} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">RFQ</h2>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Created on {fmtDate(traceData.rfq.created_at)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/rfq/${encodeURIComponent(traceData.rfq.rfq_no)}`)}
                    className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm rounded-xl transition-all border-2 border-slate-200 cursor-pointer shadow-sm active:scale-95"
                  >
                    View Details <ArrowUpRight size={18} />
                  </button>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RFQ ID</p>
                      <p className="text-sm font-bold text-slate-800">{traceData.rfq.rfq_no || '—'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer ID</p>
                      <p className="text-sm font-bold text-slate-800">{traceData.rfq.customer_id || '—'}{traceData.rfq.customer_name ? <span className="text-slate-500 font-medium"> ({traceData.rfq.customer_name})</span> : ''}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buyer Name</p>
                      <p className="text-sm font-bold text-slate-800">{traceData.rfq.buyer_name || '—'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RFQ Date</p>
                      <p className="text-sm font-bold text-slate-800">{fmtDate(traceData.rfq.rfq_date)}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No. of Items</p>
                      <p className="text-sm font-bold text-slate-800">{traceData.rfq.items.length}</p>
                    </div>
                  </div>
                  <div className="mt-10 pt-8 border-t-2 border-slate-50">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">Inquiry Items ({traceData.rfq.items.length})</p>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse bg-white">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-3 py-3">Item Code</th>
                            <th className="px-3 py-3">Description</th>
                            <th className="px-3 py-3 text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                          {traceData.rfq.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-3 py-3.5 font-mono font-bold text-blue-700">{item.item_code}</td>
                              <td className="px-3 py-3.5">
                                <p className="font-semibold text-slate-800">{item.description || '—'}</p>
                                {item.drawing_number && (
                                  <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                                    DRW: {item.drawing_number}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3.5 text-right font-medium">{item.quantity} {item.unit || 'Piece'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                {/* Footer Action Strip */}
                {!traceData.quotation && (
                  <div className="border-t border-slate-200 px-8 py-5 flex items-center gap-4 bg-slate-50/50">
                    <button
                      onClick={() => {
                        if (setActiveTab) setActiveTab('rfq');
                        navigate('/', { state: { activeTab: 'rfq', editRfqNo: traceData.rfq.rfq_no } });
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm rounded-lg transition-all border border-amber-200 cursor-pointer"
                    >
                      <Edit2 size={16} /> Update RFQ
                    </button>
                    <button
                      onClick={() => {
                        if (setActiveTab) setActiveTab('quotation');
                        navigate('/', { state: { activeTab: 'quotation', prefillRfqNo: traceData.rfq.rfq_no } });
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm rounded-lg transition-all border border-blue-200 cursor-pointer"
                    >
                      <Plus size={16} /> Add Quotation
                    </button>
                  </div>
                )}
              </section>
              )}

              {/* STAGE 2 */}
              {traceData.rfq && !isRO && (
                <section className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                    <div className="flex items-center gap-5">
                      <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-blue-100 shadow-lg">
                        <FileText size={28} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-800">Quotation Proposal</h2>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-mono font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">{traceData.quotation?.quotation_no || '—'}</span>
                          {traceData.rfq.status === 'rejected' && (
                            <span className="text-[10px] font-black text-red-600 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100 uppercase tracking-[0.15em]">Rejected</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {traceData.quotation && (
                      <button
                        onClick={() => navigate(`/quotation/${encodeURIComponent(traceData.quotation.quotation_no)}`)}
                        className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-900 font-black text-sm rounded-xl transition-all border-2 border-slate-200 cursor-pointer shadow-sm active:scale-95"
                      >
                        View Details <ArrowUpRight size={18} />
                      </button>
                    )}
                  </div>
                  {traceData.quotation ? (
                    <div className="p-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Submission Date</p>
                          <p className="text-sm font-bold text-slate-800">{fmtDate(traceData.quotation.quotation_date)}</p>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GST Setup</p>
                          <p className="text-sm font-bold text-slate-800">{traceData.quotation.gst_type || 'CGST/SGST'} • {parseFloat(traceData.quotation.gst_rate)}%</p>
                        </div>
                      </div>
                      <div className="mt-10 pt-8 border-t-2 border-slate-50">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">Commercial Proposal ({traceData.quotation.items.length} Items)</p>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                          <table className="w-full text-left border-collapse bg-white">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                              <tr>
                                <th className="px-3 py-3">Item Code</th>
                                <th className="px-3 py-3">Description</th>
                                <th className="px-3 py-3 text-right">Qty</th>
                                <th className="px-3 py-3 text-right">Unit Price</th>
                                <th className="px-3 py-3 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                              {traceData.quotation.items.map((item, idx) => {
                                const amount = (item.quantity || 0) * (parseFloat(item.unit_price) || 0);
                                return (
                                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-3 py-3.5 font-mono font-bold text-blue-700">{item.item_code}</td>
                                    <td className="px-3 py-3.5">
                                      <p className="font-semibold text-slate-800">{item.description || '—'}</p>
                                      {item.drawing_number && (
                                        <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                                          DRW: {item.drawing_number}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-3.5 text-right font-medium">{item.quantity} {item.unit || 'Piece'}</td>
                                    <td className="px-3 py-3.5 text-right font-mono">₹{(parseFloat(item.unit_price) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-800">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-16 text-center space-y-8 bg-slate-50/50">
                      <div className="h-24 w-24 bg-white rounded-[2rem] border-2 border-slate-100 flex items-center justify-center mx-auto text-slate-200 shadow-xl shadow-slate-100">
                        <FileText size={48} />
                      </div>
                      <div className="max-w-md mx-auto space-y-3">
                        <h3 className="text-2xl font-bold text-slate-300">Quotation Pending</h3>
                        <p className="text-slate-400 font-medium text-sm leading-relaxed">This inquiry has not been processed for a commercial offer yet.</p>
                      </div>
                      <button
                        onClick={() => {
                          if (setActiveTab) setActiveTab('quotation');
                          navigate('/', { state: { activeTab: 'quotation', prefillRfqNo: traceData.rfq.rfq_no } });
                        }}
                        className="inline-flex items-center gap-4 px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white text-lg font-black rounded-2xl transition-all cursor-pointer shadow-xl hover:shadow-blue-200 uppercase tracking-[0.1em] group active:scale-95"
                      >
                        Prepare Quotation <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  )}
                  {traceData.quotation && !traceData.purchase_order && (
                    <div className="border-t border-slate-200 px-8 py-5 flex items-center gap-4 bg-slate-50/50">
                      {traceData.rfq && traceData.rfq.status !== 'rejected' ? (
                        <>
                          <button
                            onClick={() => {
                              if (setActiveTab) setActiveTab('quotation');
                              navigate('/', { state: { activeTab: 'quotation', editQuotationNo: traceData.quotation.quotation_no } });
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm rounded-lg transition-all border border-amber-200 cursor-pointer"
                          >
                            <Edit2 size={16} /> Update Quotation
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm('Are you sure you want to reject this quotation and end this trade?')) return;
                              try {
                                const savedToken = localStorage.getItem('dm_token');
                                const res = await fetch(`${API_BASE_URL}/quotations/${encodeURIComponent(traceData.quotation.quotation_no)}/reject`, {
                                  method: 'POST',
                                  headers: { 'Authorization': `Bearer ${savedToken}` }
                                });
                                if (!res.ok) {
                                  const errData = await res.json();
                                  throw new Error(errData.error || 'Failed to reject quotation');
                                }
                                window.location.reload();
                              } catch (err) {
                                alert(err.message);
                              }
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm rounded-lg transition-all border border-red-200 cursor-pointer"
                          >
                            <X size={16} /> Reject Quotation
                          </button>
                          <button
                            onClick={() => {
                              if (setActiveTab) setActiveTab('purchase-order');
                              navigate('/', { state: { activeTab: 'purchase-order', prefillQuotationNo: traceData.quotation.quotation_no } });
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm rounded-lg transition-all border border-emerald-200 cursor-pointer"
                          >
                            <Plus size={16} /> Add PO
                          </button>
                        </>
                      ) : (
                        <div className="text-sm font-bold text-red-600 flex items-center gap-2">
                          <X size={16} className="text-red-500" /> This Quotation Proposal has been rejected and the trade is ended.
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* STAGE 3: PO or RO */}
              {orderDoc ? (
                <section className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                  <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                    <div className="flex items-center gap-5">
                      <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-emerald-100 shadow-lg">
                        <CheckCircle2 size={28} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-800">{isRO ? 'Release Order' : 'Purchase Order'}</h2>
                        <span className="text-xs font-mono font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 mt-1 inline-block">{orderDoc.po_no || orderDoc.ro_no}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(isRO ? `/release-order/${encodeURIComponent(orderDoc.ro_no)}` : `/purchase-order/${encodeURIComponent(orderDoc.po_no)}`)}
                      className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-50 text-slate-900 font-black text-sm rounded-xl transition-all border-2 border-slate-200 cursor-pointer shadow-sm active:scale-95"
                    >
                      View Details <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Date</p>
                        <p className="text-sm font-bold text-slate-800">{fmtDate(orderDoc.po_date || orderDoc.ro_date)}</p>
                      </div>
                      {orderDoc.delivery_date && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Delivery</p>
                          <p className="text-sm font-bold text-slate-800">{fmtDate(orderDoc.delivery_date)}</p>
                        </div>
                      )}
                      {orderDoc.contract_ref && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contract Ref</p>
                          <p className="text-sm font-bold text-slate-800">{orderDoc.contract_ref}</p>
                        </div>
                      )}
                    </div>
                    
                    {isRO && (
                      <div className="mt-6 pt-6 border-t-2 border-slate-50 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</p>
                          <p className="text-sm font-bold text-slate-800">{orderDoc.customer_name || '—'}</p>
                          {orderDoc.customer_address && (
                            <p className="text-xs text-slate-500 mt-0.5">{orderDoc.customer_address}</p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buyer Contact</p>
                          <p className="text-sm font-bold text-slate-800">{orderDoc.buyer_name || '—'}</p>
                          {(orderDoc.buyer_email || orderDoc.buyer_phone) && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {orderDoc.buyer_email || '—'} &bull; {orderDoc.buyer_phone || '—'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-10 pt-8 border-t-2 border-slate-50">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">Ordered Items ({(orderDoc.items || []).length})</p>
                      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white mb-6">
                        <table className="w-full text-left border-collapse bg-white">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                            <tr>
                              <th className="px-3 py-3">Item Code</th>
                              <th className="px-3 py-3">Description</th>
                              <th className="px-3 py-3 text-right">Qty</th>
                              <th className="px-3 py-3 text-right">Unit Price</th>
                              <th className="px-3 py-3 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                            {(orderDoc.items || []).map((item, idx) => {
                              const amount = (item.quantity || 0) * (parseFloat(item.unit_price) || 0);
                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-3 py-3.5 font-mono font-bold text-blue-700">{item.item_code}</td>
                                  <td className="px-3 py-3.5">
                                    <p className="font-semibold text-slate-800">{item.description || '—'}</p>
                                    {item.drawing_number && (
                                      <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                                        DRW: {item.drawing_number}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3.5 text-right font-medium">{item.quantity} {item.unit || 'Piece'}</td>
                                  <td className="px-3 py-3.5 text-right font-mono">₹{(parseFloat(item.unit_price) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-800">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 space-y-4 max-w-xl">
                        <div className="flex justify-between text-xs font-bold text-slate-500"><span>Basic Value</span> <span className="text-slate-800 font-mono">₹{parseFloat(orderDoc.basic_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between text-xs font-bold text-slate-500"><span>GST Component</span> <span className="text-slate-800 font-mono">₹{parseFloat(orderDoc.gst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between text-xs font-bold text-slate-500"><span>Logistic Charges</span> <span className="text-slate-800 font-mono">₹{parseFloat(orderDoc.transport).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        {orderDoc.packing_forward && parseFloat(orderDoc.packing_forward) > 0 && (
                          <div className="flex justify-between text-xs font-bold text-slate-500"><span>Packing & Forwarding</span> <span className="text-slate-800 font-mono">₹{parseFloat(orderDoc.packing_forward).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        )}
                        {orderDoc.other && parseFloat(orderDoc.other) > 0 && (
                          <div className="flex justify-between text-xs font-bold text-slate-500"><span>Other Charges</span> <span className="text-slate-800 font-mono">₹{parseFloat(orderDoc.other).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        )}
                        <div className="flex justify-between text-xs font-bold text-slate-500 border-t border-slate-200 pt-4"><span>Total Aggregate</span> <span className="text-slate-900 font-black text-base">₹{(
                          (parseFloat(orderDoc.basic_value) || 0) +
                          (parseFloat(orderDoc.gst) || 0) +
                          (parseFloat(orderDoc.transport) || 0) +
                          (parseFloat(orderDoc.packing_forward) || 0) +
                          (parseFloat(orderDoc.other) || 0)
                        ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                      </div>
                    </div>
                  </div>
                  {/* Footer Action Strip */}
                  {traceDocs.length === 0 && (
                    <div className="border-t border-slate-200 px-8 py-5 flex items-center gap-4 bg-slate-50/50">
                      <button
                        onClick={() => {
                          if (setActiveTab) setActiveTab(isRO ? 'release-order' : 'purchase-order');
                          navigate('/', { state: { activeTab: isRO ? 'release-order' : 'purchase-order', editPoNo: !isRO ? orderDoc.po_no : undefined, editRoNo: isRO ? orderDoc.ro_no : undefined } });
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm rounded-lg transition-all border border-amber-200 cursor-pointer"
                      >
                        <Edit2 size={16} /> Update {isRO ? 'RO' : 'PO'}
                      </button>
                      <button
                        onClick={() => {
                          if (setActiveTab) setActiveTab('delivery');
                          navigate('/', { state: { activeTab: 'delivery', prefillPoNo: !isRO ? orderDoc.po_no : undefined, prefillRoNo: isRO ? orderDoc.ro_no : undefined } });
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm rounded-lg transition-all border border-blue-200 cursor-pointer"
                      >
                        <Plus size={16} /> {isRO ? 'Delivery Note' : 'Add Delivery Note'}
                      </button>
                      <button
                        onClick={() => {
                          if (setActiveTab) setActiveTab('invoice');
                          navigate('/', { state: { activeTab: 'invoice', prefillPoNo: !isRO ? orderDoc.po_no : undefined, prefillRoNo: isRO ? orderDoc.ro_no : undefined } });
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm rounded-lg transition-all border border-emerald-200 cursor-pointer"
                      >
                        <Plus size={16} /> {isRO ? 'Invoice' : 'Add Invoice'}
                      </button>
                    </div>
                  )}
                </section>
              ) : (traceData.rfq && traceData.rfq.status === 'rejected') ? (
                <div className="bg-red-50/30 border-4 border-dashed border-red-100 rounded-[2.5rem] p-16 text-center space-y-8">
                  <div className="h-24 w-24 bg-white rounded-[2rem] border-2 border-red-50 flex items-center justify-center mx-auto text-red-400 shadow-xl shadow-red-50">
                    <X size={48} />
                  </div>
                  <div className="max-w-md mx-auto space-y-3">
                    <h3 className="text-2xl font-bold text-red-600">Trade Terminated</h3>
                    <p className="text-red-400 font-medium text-sm leading-relaxed">The commercial proposal was rejected by the customer. No further stages can be initiated for this record.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2.5rem] p-16 text-center space-y-8">
                  <div className="h-24 w-24 bg-white rounded-[2rem] border-2 border-slate-100 flex items-center justify-center mx-auto text-slate-200 shadow-xl shadow-slate-100">
                    <Lock size={48} />
                  </div>
                  <div className="max-w-md mx-auto space-y-3">
                    <h3 className="text-2xl font-bold text-slate-300">Purchase Order Locked</h3>
                    <p className="text-slate-400 font-bold text-sm leading-relaxed">
                      {isBuy
                        ? 'Pending supplier order registration. Process the Purchase Order to complete the procurement stage.'
                        : traceData.quotation 
                          ? 'Pending formal customer confirmation. Upload the official Purchase Order to complete the transaction lifecycle.' 
                          : 'A formal quotation is required before a Purchase Order can be recorded.'}
                    </p>
                  </div>
                  {(traceData.quotation || (isBuy && traceData.received_quotation)) && (
                    <button
                      onClick={() => {
                        if (setActiveTab) setActiveTab('purchase-order');
                        navigate('/', { 
                          state: { 
                            activeTab: 'purchase-order', 
                            prefillQuotationNo: isBuy ? traceData.received_quotation.received_quotation_no : traceData.quotation.quotation_no 
                          } 
                        });
                      }}
                      className="inline-flex items-center gap-4 px-10 py-5 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-black rounded-2xl transition-all cursor-pointer shadow-xl hover:shadow-emerald-200 uppercase tracking-[0.1em] group active:scale-95"
                    >
                      Process Purchase Order <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                </div>
              )}

              {/* Dynamic Stages 4-7 based on Database Array Sequence */}
              {orderDoc ? (
                <>
                                  {(() => {
                    const traceDocs = (traceData.documents || []).filter(d => 
                      ['DN', 'INVOICE', 'GRN', 'PAYMENT'].includes(d.type.toUpperCase())
                    );

                    return traceDocs.map((doc, index) => {
                      const type = doc.type.toUpperCase();
                      if (type === 'DN') {
                        const dn = (traceData.delivery_notes || []).find(d => d.delivery_note_no === doc.id);
                        if (!dn) return null;
                        return (
                          <section key={`dn-${doc.id}-${index}`} id="delivery-section" className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                            <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                              <div className="flex items-center gap-5">
                                <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-blue-100 shadow-lg">
                                  <Truck size={28} />
                                </div>
                                <div>
                                  <h2 className="text-xl font-bold text-slate-800">Delivery Note</h2>
                                  <p className="text-xs text-slate-400 font-medium mt-0.5">Part of delivery sequence</p>
                                </div>
                              </div>
                            </div>
                            <div className="p-8 space-y-6">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                                    <span className="font-mono text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">{dn.delivery_note_no}</span>
                                    <span className="text-sm text-slate-400 font-medium">{fmtDate(dn.delivery_date)}</span>
                                  </h3>
                                </div>
                                <button
                                  onClick={() => navigate(`/delivery-note/${encodeURIComponent(dn.delivery_note_no)}`)}
                                  className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs rounded-lg transition-all border border-slate-200 cursor-pointer shadow-sm"
                                >
                                  View Details <ArrowUpRight size={14} />
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch Doc No</p>
                                  <p className="text-sm font-bold text-slate-700">{dn.dispatch_doc_no || '—'}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch Through</p>
                                  <p className="text-sm font-bold text-slate-700">{dn.dispatch_through || '—'}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motor Vehicle No</p>
                                  <p className="text-sm font-bold text-slate-700">{dn.motor_vehicle_no || '—'}</p>
                                </div>
                              </div>

                              <div className="mt-6">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">Delivered Items ({(dn.items || []).length})</p>
                                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                                  <table className="w-full text-left border-collapse bg-white">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                                      <tr>
                                        <th className="px-3 py-3">Item Code</th>
                                        <th className="px-3 py-3">Description</th>
                                        <th className="px-3 py-3 text-right">Qty</th>
                                        <th className="px-3 py-3 text-right">Rate/Piece</th>
                                        <th className="px-3 py-3 text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                                      {(dn.items || []).map((item, idx) => {
                                        const qty = parseFloat(item.quantity) || 0;
                                        const rate = parseFloat(item.rate_per_piece) || 0;
                                        const amount = qty * rate;
                                        return (
                                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-3 py-3.5 font-mono font-bold text-blue-700">{item.item_code}</td>
                                            <td className="px-3 py-3.5">
                                              <p className="font-semibold text-slate-800">{item.description || '—'}</p>
                                              {item.drawing_number && (
                                                <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                                                  DRW: {item.drawing_number}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-3.5 text-right font-medium">{qty}</td>
                                            <td className="px-3 py-3.5 text-right font-mono">₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-800">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                            {index === traceDocs.length - 1 && (
                              <div className="border-t border-slate-200 px-8 py-5 flex items-center gap-4 bg-slate-50/50">
                                <button
                                  onClick={() => {
                                    if (setActiveTab) setActiveTab('delivery');
                                    navigate('/', { state: { activeTab: 'delivery', editDeliveryNoteNo: dn.delivery_note_no } });
                                  }}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm rounded-lg transition-all border border-amber-200 cursor-pointer"
                                >
                                  <Edit2 size={16} /> Update DN
                                </button>
                                <button
                                  onClick={() => {
                                    if (setActiveTab) setActiveTab('invoice');
                                    navigate('/', {
                                      state: {
                                        activeTab: 'invoice',
                                        prefillDnNo: dn.delivery_note_no,
                                        prefillPoNo: !isRO ? orderDoc.po_no : undefined,
                                        prefillRoNo: isRO ? orderDoc.ro_no : undefined
                                      }
                                    });
                                  }}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-sm rounded-lg transition-all border border-emerald-200 cursor-pointer"
                                >
                                  <Plus size={16} /> {isRO ? 'Invoice' : 'Add Invoice'}
                                </button>
                                <button
                                  onClick={() => {
                                    if (setActiveTab) setActiveTab('grn');
                                    navigate('/', { state: { activeTab: 'grn', prefillTradeId: trade_id } });
                                  }}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-sm rounded-lg transition-all border border-indigo-200 cursor-pointer"
                                >
                                  <Plus size={16} /> {isRO ? 'GRN' : 'Add GRN'}
                                </button>
                                <button
                                  onClick={() => {
                                    if (setActiveTab) setActiveTab('delivery');
                                    navigate('/', { state: { activeTab: 'delivery', prefillPoNo: !isRO ? orderDoc.po_no : undefined, prefillRoNo: isRO ? orderDoc.ro_no : undefined } });
                                  }}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm rounded-lg transition-all border border-blue-200 cursor-pointer"
                                >
                                  <Plus size={16} /> {isRO ? 'New DN' : 'Add New DN'}
                                </button>
                              </div>
                            )}
                          </section>
                        );
                      }

                      if (type === 'INVOICE') {
                        const inv = (traceData.invoices || []).find(i => i.invoice_no === doc.id);
                        if (!inv) return null;
                        return (
                          <section key={`invoice-${doc.id}-${index}`} id="invoice-section" className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                            <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                              <div className="flex items-center gap-5">
                                <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-emerald-100 shadow-lg">
                                  <FileText size={28} />
                                </div>
                                <div>
                                  <h2 className="text-xl font-bold text-slate-800">Invoice</h2>
                                  <p className="text-xs text-slate-400 font-medium mt-0.5">Part of billing sequence</p>
                                </div>
                              </div>
                            </div>
                            <div className="p-8 space-y-6">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                                    <span className="font-mono text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">{inv.invoice_no}</span>
                                    <span className="text-sm text-slate-400 font-medium">{fmtDate(inv.invoice_date)}</span>
                                  </h3>
                                </div>
                                <button
                                  onClick={() => navigate(`/invoice/${encodeURIComponent(inv.invoice_no)}`)}
                                  className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs rounded-lg transition-all border border-slate-200 cursor-pointer shadow-sm"
                                >
                                  View Details <ArrowUpRight size={14} />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivery Note Ref</p>
                                  <p className="text-sm font-bold text-slate-700">{inv.delivery_note_no || '—'}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Order Reference</p>
                                  <p className="text-sm font-bold text-slate-700">{inv.po_no ? `PO: ${inv.po_no}` : inv.ro_no ? `RO: ${inv.ro_no}` : '—'}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dispatch Doc No</p>
                                  <p className="text-sm font-bold text-slate-700">{inv.dispatch_doc_no || '—'}</p>
                                </div>
                              </div>

                              <div className="mt-6">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-4">Invoiced Items ({(inv.items || []).length})</p>
                                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                                  <table className="w-full text-left border-collapse bg-white">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                                      <tr>
                                        <th className="px-3 py-3">Item Code</th>
                                        <th className="px-3 py-3">Description</th>
                                        <th className="px-3 py-3 text-right">Qty</th>
                                        <th className="px-3 py-3 text-right">Rate/Piece</th>
                                        <th className="px-3 py-3 text-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                                      {(inv.items || []).map((item, idx) => {
                                        const qty = parseFloat(item.quantity) || 0;
                                        const rate = parseFloat(item.rate_per_piece) || 0;
                                        const amount = qty * rate;
                                        return (
                                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-3 py-3.5 font-mono font-bold text-blue-700">{item.item_code}</td>
                                            <td className="px-3 py-3.5">
                                              <p className="font-semibold text-slate-800">{item.description || '—'}</p>
                                              {item.drawing_number && (
                                                <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                                                  DRW: {item.drawing_number}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-3.5 text-right font-medium">{qty}</td>
                                            <td className="px-3 py-3.5 text-right font-mono">₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-800">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                            {index === traceDocs.length - 1 && (
                              <div className="border-t border-slate-200 px-8 py-5 flex items-center gap-4 bg-slate-50/50">
                                <button
                                  onClick={() => {
                                    if (setActiveTab) setActiveTab('invoice');
                                    navigate('/', { state: { activeTab: 'invoice', editInvoiceNo: inv.invoice_no } });
                                  }}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm rounded-lg transition-all border border-amber-200 cursor-pointer"
                                >
                                  <Edit2 size={16} /> Update Invoice
                                </button>
                                <button
                                  onClick={() => {
                                    if (setActiveTab) setActiveTab('grn');
                                    navigate('/', { state: { activeTab: 'grn', prefillTradeId: trade_id } });
                                  }}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-sm rounded-lg transition-all border border-indigo-200 cursor-pointer"
                                >
                                  <Plus size={16} /> {isRO ? 'GRN' : 'Add GRN'}
                                </button>
                                <button
                                  onClick={() => {
                                    if (setActiveTab) setActiveTab('payment');
                                    navigate('/', { state: { activeTab: 'payment', prefillPoNo: !isRO ? orderDoc.po_no : undefined, prefillRoNo: isRO ? orderDoc.ro_no : undefined, prefillTradeId: trade_id } });
                                  }}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-sm rounded-lg transition-all border border-teal-200 cursor-pointer"
                                >
                                  <Plus size={16} /> {isRO ? 'Payment' : 'Record Payment'}
                                </button>
                                <button
                                  onClick={() => {
                                    if (setActiveTab) setActiveTab('delivery');
                                    navigate('/', { state: { activeTab: 'delivery', prefillPoNo: !isRO ? orderDoc.po_no : undefined, prefillRoNo: isRO ? orderDoc.ro_no : undefined } });
                                  }}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-sm rounded-lg transition-all border border-blue-200 cursor-pointer"
                                >
                                  <Plus size={16} /> {isRO ? 'New DN' : 'Add New DN'}
                                </button>
                              </div>
                            )}
                          </section>
                        );
                      }

                      if (type === 'GRN') {
                        const grn = (traceData.grns || []).find(g => g.grn_no === doc.id);
                        if (!grn) return null;
                        return (
                          <section key={`grn-${doc.id}-${index}`} id="grn-section" className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                            <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                              <div className="flex items-center gap-5">
                                <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-indigo-100 shadow-lg">
                                  <CheckSquare size={28} />
                                </div>
                                <div>
                                  <h2 className="text-xl font-bold text-slate-800">Goods Receipt Note (GRN)</h2>
                                </div>
                              </div>
                            </div>
                            <div className="p-8 space-y-6">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                                    <span className="font-mono text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">{grn.grn_no}</span>
                                    <span className="text-sm text-slate-400 font-medium">{fmtDate(grn.created_at)}</span>
                                  </h3>
                                </div>
                              </div>
                            </div>
                            {index === traceDocs.length - 1 && (
                              <div className="border-t border-slate-200 px-8 py-5 flex items-center gap-4 bg-slate-50/50">
                                <button
                                  onClick={() => {
                                    if (setActiveTab) setActiveTab('payment');
                                    navigate('/', { state: { activeTab: 'payment', prefillPoNo: !isRO ? orderDoc.po_no : undefined, prefillRoNo: isRO ? orderDoc.ro_no : undefined, prefillTradeId: trade_id } });
                                  }}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-sm rounded-lg transition-all border border-teal-200 cursor-pointer"
                                >
                                  <Plus size={16} /> {isRO ? 'Payment' : 'Record Payment'}
                                </button>
                              </div>
                            )}
                          </section>
                        );
                      }

                      if (type === 'PAYMENT') {
                        const pay = (traceData.payments || []).find(p => p.payment_no === doc.id);
                        if (!pay) return null;
                        return (
                          <section key={`payment-${doc.id}-${index}`} id="payment-section" className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                            <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                              <div className="flex items-center gap-5">
                                <div className="p-4 bg-teal-600 text-white rounded-2xl shadow-teal-100 shadow-lg">
                                  <DollarSign size={28} />
                                </div>
                                <div>
                                  <h2 className="text-xl font-bold text-slate-800">Payment</h2>
                                </div>
                              </div>
                            </div>
                            <div className="p-8 space-y-6">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                                    <span className="font-mono text-teal-600 bg-teal-50 px-3 py-1 rounded-lg border border-teal-100">{pay.payment_no}</span>
                                    <span className="text-sm text-slate-400 font-medium">{fmtDate(pay.created_at)}</span>
                                  </h3>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Amount Paid</p>
                                  <p className="text-sm font-bold text-slate-800">₹{parseFloat(pay.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linked Order</p>
                                  <p className="text-sm font-bold text-slate-700">{pay.po_no ? `PO: ${pay.po_no}` : pay.ro_no ? `RO: ${pay.ro_no}` : '—'}</p>
                                </div>
                              </div>
                            </div>
                          </section>
                        );
                      }

                      return null;
                    });
                  })()}

                  {/* Render Next Pending Stage */}
                  {(() => {
                    const traceDocs = (traceData.documents || []).filter(d => 
                      ['DN', 'INVOICE', 'GRN', 'PAYMENT'].includes(d.type.toUpperCase())
                    );

                    let nextStage = 'DN'; 
                    if (traceDocs.length > 0) {
                      const lastType = traceDocs[traceDocs.length - 1].type.toUpperCase();
                      if (lastType === 'DN') nextStage = 'INVOICE';
                      else if (lastType === 'INVOICE') nextStage = 'GRN';
                      else if (lastType === 'GRN') nextStage = 'PAYMENT';
                      else if (lastType === 'PAYMENT') nextStage = 'COMPLETE';
                    }

                    if (nextStage === 'DN') {
                      return (
                        <section id="delivery-section" className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                          <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <div className="flex items-center gap-5">
                              <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-blue-100 shadow-lg">
                                  <Truck size={28} />
                              </div>
                              <div>
                                <h2 className="text-xl font-bold text-slate-800">Delivery Notes</h2>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">Awaiting first delivery note</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-16 text-center space-y-8 bg-slate-50/50">
                            <div className="h-20 w-20 bg-white rounded-[1.5rem] border border-slate-150 flex items-center justify-center mx-auto text-slate-300 shadow-md">
                              <Truck size={36} />
                            </div>
                            <div className="max-w-md mx-auto space-y-2">
                              <h3 className="text-xl font-bold text-slate-400">Delivery Notes Pending</h3>
                              <p className="text-slate-400 text-sm leading-relaxed">No delivery notes have been recorded for this trade yet.</p>
                            </div>
                            <button
                              onClick={() => {
                                if (setActiveTab) setActiveTab('delivery');
                                navigate('/', { state: { activeTab: 'delivery', prefillPoNo: !isRO ? orderDoc.po_no : undefined, prefillRoNo: isRO ? orderDoc.ro_no : undefined } });
                              }}
                              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all cursor-pointer shadow-md group active:scale-95"
                            >
                              {isRO ? 'Delivery Note' : 'Add Delivery Note'} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </section>
                      );
                    }

                    if (nextStage === 'INVOICE') {
                      return (
                        <section id="invoice-section" className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                          <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <div className="flex items-center gap-5">
                              <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-emerald-100 shadow-lg">
                                <FileText size={28} />
                              </div>
                              <div>
                                <h2 className="text-xl font-bold text-slate-800">Invoices</h2>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">Awaiting billing stage</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-16 text-center space-y-8 bg-slate-50/50">
                            <div className="h-20 w-20 bg-white rounded-[1.5rem] border border-slate-150 flex items-center justify-center mx-auto text-slate-300 shadow-md">
                              <FileText size={36} />
                            </div>
                            <div className="max-w-md mx-auto space-y-2">
                              <h3 className="text-xl font-bold text-slate-400">Invoices Pending</h3>
                              <p className="text-slate-400 text-sm leading-relaxed">No invoices have been issued for this trade yet.</p>
                            </div>
                            <button
                              onClick={() => {
                                if (setActiveTab) setActiveTab('invoice');
                                const lastDn = [...traceDocs].reverse().find(d => d.type.toUpperCase() === 'DN');
                                navigate('/', {
                                  state: {
                                    activeTab: 'invoice',
                                    prefillDnNo: lastDn ? lastDn.id : null,
                                    prefillPoNo: !isRO ? orderDoc.po_no : undefined,
                                    prefillRoNo: isRO ? orderDoc.ro_no : undefined
                                  }
                                });
                              }}
                              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all cursor-pointer shadow-md group active:scale-95"
                            >
                              {isRO ? 'Invoice' : 'Add Invoice'} <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </section>
                      );
                    }

                    if (nextStage === 'GRN') {
                      return (
                        <section id="grn-section" className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                          <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <div className="flex items-center gap-5">
                              <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-indigo-100 shadow-lg">
                                <CheckSquare size={28} />
                              </div>
                              <div>
                                <h2 className="text-xl font-bold text-slate-800">Goods Receipt Notes (GRN)</h2>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">Awaiting goods verification</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-16 text-center space-y-8 bg-slate-50/50">
                            <div className="h-20 w-20 bg-white rounded-[1.5rem] border border-slate-150 flex items-center justify-center mx-auto text-slate-300 shadow-md">
                              <CheckSquare size={36} />
                            </div>
                            <div className="max-w-md mx-auto space-y-2">
                              <h3 className="text-xl font-bold text-slate-400">GRN Pending</h3>
                              <p className="text-slate-400 text-sm leading-relaxed">No Goods Receipt Notes have been logged for this trade yet.</p>
                            </div>
                            <button
                              onClick={() => {
                                if (setActiveTab) setActiveTab('grn');
                                navigate('/', { state: { activeTab: 'grn', prefillTradeId: trade_id } });
                              }}
                              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all cursor-pointer shadow-md group active:scale-95"
                            >
                              Add GRN <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </section>
                      );
                    }

                    if (nextStage === 'PAYMENT') {
                      return (
                        <section id="payment-section" className="bg-white border-2 border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                          <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/30">
                            <div className="flex items-center gap-5">
                              <div className="p-4 bg-teal-600 text-white rounded-2xl shadow-teal-100 shadow-lg">
                                <DollarSign size={28} />
                              </div>
                              <div>
                                <h2 className="text-xl font-bold text-slate-800">Payments</h2>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">Awaiting transaction records</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-16 text-center space-y-8 bg-slate-50/50">
                            <div className="h-20 w-20 bg-white rounded-[1.5rem] border border-slate-150 flex items-center justify-center mx-auto text-slate-300 shadow-md">
                              <DollarSign size={36} />
                            </div>
                            <div className="max-w-md mx-auto space-y-2">
                              <h3 className="text-xl font-bold text-slate-400">Payments Pending</h3>
                              <p className="text-slate-400 text-sm leading-relaxed">No payments have been registered for this trade yet.</p>
                            </div>
                            <button
                              onClick={() => {
                                if (setActiveTab) setActiveTab('payment');
                                navigate('/', { state: { activeTab: 'payment', prefillPoNo: !isRO ? orderDoc.po_no : undefined, prefillRoNo: isRO ? orderDoc.ro_no : undefined, prefillTradeId: trade_id } });
                              }}
                              className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition-all cursor-pointer shadow-md group active:scale-95"
                            >
                              Record Payment <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </section>
                      );
                    }

                    return null;
                  })()}
                </>
              ) : (
                <>
                  <div className="bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2.5rem] p-16 text-center space-y-8">
                    <div className="h-24 w-24 bg-white rounded-[2rem] border-2 border-slate-100 flex items-center justify-center mx-auto text-slate-200 shadow-xl shadow-slate-100">
                      <Lock size={48} />
                    </div>
                    <div className="max-w-md mx-auto space-y-3">
                      <h3 className="text-2xl font-bold text-slate-300">Delivery Notes Locked</h3>
                      <p className="text-slate-400 font-bold text-sm leading-relaxed">
                        Delivery notes require a completed Purchase Order or Release Order stage.
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2.5rem] p-16 text-center space-y-8">
                    <div className="h-24 w-24 bg-white rounded-[2rem] border-2 border-slate-100 flex items-center justify-center mx-auto text-slate-200 shadow-xl shadow-slate-100">
                      <Lock size={48} />
                    </div>
                    <div className="max-w-md mx-auto space-y-3">
                      <h3 className="text-2xl font-bold text-slate-300">Invoices Locked</h3>
                      <p className="text-slate-400 font-bold text-sm leading-relaxed">
                        Invoices require a completed Purchase Order or Release Order stage.
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2.5rem] p-16 text-center space-y-8">
                    <div className="h-24 w-24 bg-white rounded-[2rem] border-2 border-slate-100 flex items-center justify-center mx-auto text-slate-200 shadow-xl shadow-slate-100">
                      <Lock size={48} />
                    </div>
                    <div className="max-w-md mx-auto space-y-3">
                      <h3 className="text-2xl font-bold text-slate-300">GRN Locked</h3>
                      <p className="text-slate-400 font-bold text-sm leading-relaxed">
                        GRNs require a completed Purchase Order or Release Order stage.
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2.5rem] p-16 text-center space-y-8">
                    <div className="h-24 w-24 bg-white rounded-[2rem] border-2 border-slate-100 flex items-center justify-center mx-auto text-slate-200 shadow-xl shadow-slate-100">
                      <Lock size={48} />
                    </div>
                    <div className="max-w-md mx-auto space-y-3">
                      <h3 className="text-2xl font-bold text-slate-300">Payments Locked</h3>
                      <p className="text-slate-400 font-bold text-sm leading-relaxed">
                        Payments require a completed Purchase Order or Release Order stage.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
