import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Edit2, Check, X, Lock, Eye } from 'lucide-react';

const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:5000/api'
  : `${window.location.protocol}//${window.location.hostname}:5000/api`;

export default function PurchaseOrderDetailView({ purchaseOrders, quotations, rfqs, customers, buyers, onUpdatePOItems }) {
  const { po_no: po_no_param } = useParams();
  const po_no = decodeURIComponent(po_no_param);
  const navigate = useNavigate();

  const [statusSuggestions, setStatusSuggestions] = useState([]);
  const [editingItemCode, setEditingItemCode] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editVendor, setEditVendor] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const token = localStorage.getItem('dm_token');
        const res = await fetch(`${API_BASE_URL}/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStatusSuggestions(data);
        }
      } catch (e) {
        console.error('Error loading status suggestions:', e);
      }
    };
    fetchStatuses();
  }, []);

  const handleSaveInline = async (itemCode) => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('dm_token');
      const res = await fetch(`${API_BASE_URL}/purchase-orders/${encodeURIComponent(po_no)}/items/${encodeURIComponent(itemCode)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: editStatus,
          vendor: editVendor
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update PO item');
      
      if (onUpdatePOItems) {
        onUpdatePOItems(po_no, data);
      }
      
      if (editStatus && !statusSuggestions.includes(editStatus)) {
        setStatusSuggestions(prev => [...prev, editStatus].sort());
      }
      
      setEditingItemCode(null);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const po = purchaseOrders.find((p) => p.po_no === po_no);

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f1f5f9] p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Purchase Order Not Found</h2>
        <p className="text-slate-600 mb-6">No Purchase Order record matches the identifier <span className="font-mono bg-slate-100 px-2 py-1 rounded">{po_no}</span>.</p>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <ArrowLeft size={18} /> Back
        </button>
      </div>
    );
  }

  // Find linked customer/buyer info
  const quotation = quotations.find((q) => q.quotation_no === po.quotation_no);
  const rfq = rfq_no => rfqs.find((r) => r.rfq_no === rfq_no);
  const matchedRfq = quotation ? rfq(quotation.rfq_no) : po.rfq_no ? rfq(po.rfq_no) : null;
  
  const customer = matchedRfq ? customers.find((c) => c.id === matchedRfq.customer_id) : null;
  const buyer = matchedRfq ? (buyers || []).find((b) => b.id === matchedRfq.buyer_id) : null;

  const fmtDate = (d) => {
    if (!d) return '—';
    if (d instanceof Date) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
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

  const calculateTotalItemsAmount = (itemsList) => {
    if (!Array.isArray(itemsList)) return 0;
    return itemsList.reduce((sum, i) => sum + (i.quantity || 0) * (parseFloat(i.unit_price) || 0), 0);
  };

  const gstValue = parseFloat(po.gst) || 0;
  const transportValue = parseFloat(po.transport) || 0;
  const packingValue = parseFloat(po.packing_forward) || 0;
  const otherValue = parseFloat(po.other) || 0;
  const basicValue = parseFloat(po.basic_value) || 0;
  const grossTotal = basicValue + gstValue + transportValue + packingValue + otherValue;

  return (
    <div className="w-full px-4 sm:px-8 py-6 bg-[#f1f5f9] print:bg-white print:p-0 min-h-screen text-slate-900">
      <div className="flex items-center mb-6 print:hidden">
        <button onClick={() => navigate(-1)} className="flex items-center text-blue-600 hover:underline mr-4 cursor-pointer px-4 py-2 rounded-lg transition-colors text-sm">
          <ArrowLeft size={16} className="mr-1.5" /> Back
        </button>
        <h1 className="text-3xl font-extrabold text-slate-900">Purchase Order Detail – {po.po_no}</h1>
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-6 hidden print:block">Purchase Order – {po.po_no}</h1>

      {po.has_grn && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-semibold flex items-center gap-2 shadow-sm print:hidden">
          <Lock size={16} className="text-amber-600 shrink-0" />
          <span>This Purchase Order is locked. Editing and modifying details is disabled because a Goods Receipt Note (GRN) has been generated.</span>
        </div>
      )}

      {/* Grid of basic info, customer info, buyer info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border print:border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-3 border-b border-slate-100 pb-1.5">PO Information</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold text-slate-500">PO No:</span> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded font-bold text-blue-700">{po.po_no}</span></p>
            <p><span className="font-semibold text-slate-500">PO Date:</span> <span className="font-bold">{fmtDate(po.po_date)}</span></p>
            {po.delivery_date && (
              <p><span className="font-semibold text-slate-500">Delivery Date:</span> <span className="font-bold text-slate-800">{fmtDate(po.delivery_date)}</span></p>
            )}
            {po.contract_ref && (
              <p><span className="font-semibold text-slate-500">Contract Ref:</span> <span className="font-bold">{po.contract_ref}</span></p>
            )}
            {po.quotation_no && (
              <p>
                <span className="font-semibold text-slate-500">Quotation No:</span>{' '}
                <Link to={`/quotation/${po.quotation_no}`} className="font-mono bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors font-bold print:border-0 print:bg-transparent print:p-0">
                  {po.quotation_no}
                </Link>
              </p>
            )}
            {matchedRfq && (
              <p>
                <span className="font-semibold text-slate-500">RFQ No:</span>{' '}
                <Link to={`/rfq/${matchedRfq.rfq_no}`} className="font-mono bg-slate-100 px-2 py-0.5 rounded hover:bg-slate-200 transition-colors font-bold print:border-0 print:bg-transparent print:p-0">
                  {matchedRfq.rfq_no}
                </Link>
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {po.customer_name || customer ? (
            <div>
              <p className="font-bold text-slate-500 text-xs uppercase tracking-wider">Customer</p>
              <p className="font-bold text-slate-800">{po.customer_name || customer?.name} (ID: {po.customer_id || customer?.id})</p>
              <p className="text-xs text-slate-500 mt-0.5">{po.customer_address || customer?.address}</p>
            </div>
          ) : (
            <p className="text-slate-500">Customer information not available.</p>
          )}

          {po.buyer_name || buyer ? (
            <div className="border-t border-slate-100 pt-3">
              <p className="font-bold text-slate-500 text-xs uppercase tracking-wider">Buyer Contact</p>
              <p className="font-bold text-slate-800">{po.buyer_name || buyer?.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {po.buyer_email || buyer?.email} &bull; {po.buyer_phone || buyer?.phone}
              </p>
            </div>
          ) : (
            <p className="text-slate-500 border-t border-slate-100 pt-3">Buyer information not available.</p>
          )}
        </div>
      </div>

      {/* Items Section */}
      <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border print:border-slate-200 overflow-hidden">
        <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Ordered Items ({Array.isArray(po.items) ? po.items.length : 0})</h2>
        {Array.isArray(po.items) && po.items.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse bg-white">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-2.5 py-3">Item Code</th>
                  <th className="px-2.5 py-3 min-w-[180px]">Description</th>
                  <th className="px-2.5 py-3 text-right">Qty</th>
                  <th className="px-2.5 py-3 text-right">Rate</th>
                  <th className="px-2.5 py-3 text-right">GST</th>
                  <th className="px-2.5 py-3 text-right">Amount</th>
                  <th className="px-2.5 py-3 min-w-[120px]">Shipping Address</th>
                  <th className="px-2.5 py-3">Delivery Date</th>
                  <th className="px-2.5 py-3">Status</th>
                  <th className="px-2.5 py-3 min-w-[100px]">Vendor</th>
                  {!po.has_grn && <th className="px-2.5 py-3 text-center print:hidden">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
                {po.items.map((item) => {
                  const isEditing = editingItemCode === item.item_code;
                  const amount = (item.quantity || 1) * parseFloat(item.unit_price);
                  const taxRate = item.gst_rate !== undefined ? parseFloat(item.gst_rate) : 0;
                  const taxAmount = amount * (taxRate / 100);

                  return (
                    <tr key={item.item_code} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-2.5 py-3 font-mono font-bold text-blue-700">{item.item_code}</td>
                      <td className="px-2.5 py-3">
                        <p className="font-semibold text-slate-800 line-clamp-2">{item.description}</p>
                        {item.drawing_number && (
                          <span className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                            DRW: {item.drawing_number}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-3 text-right font-medium">{item.quantity || 1}</td>
                      <td className="px-2.5 py-3 text-right font-mono">₹{parseFloat(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-2.5 py-3 text-right">
                        <span className="text-slate-800 font-mono font-bold">{taxRate}%</span>
                        <span className="text-[10px] text-slate-400 block">₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </td>
                      <td className="px-2.5 py-3 text-right font-mono font-bold text-slate-800">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-2.5 py-3 text-xs text-slate-500 whitespace-pre-wrap">{item.shipping_address || '—'}</td>
                      <td className="px-2.5 py-3 text-xs font-medium">{fmtDate(item.delivery_date)}</td>
                      
                      {/* Status Column */}
                      <td className="px-2.5 py-3">
                        {isEditing ? (
                          <div className="relative">
                            <input
                              list={`status-suggestions-${item.item_code}`}
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              placeholder="Status"
                              className="w-24 px-1.5 py-0.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500"
                            />
                            <datalist id={`status-suggestions-${item.item_code}`}>
                              {statusSuggestions.map(s => <option key={s} value={s} />)}
                            </datalist>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider
                            ${(item.status || 'pending').toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              (item.status || '').toLowerCase() === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              (item.status || '').toLowerCase() === 'cancelled' ? 'bg-red-50 text-red-700 border border-red-200' :
                              'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {item.status || 'pending'}
                          </span>
                        )}
                      </td>
                      
                      {/* Vendor Column */}
                      <td className="px-2.5 py-3">
                        {isEditing ? (
                          <div className="relative">
                            <input
                              list={`vendor-customer-suggestions-${item.item_code}`}
                              type="text"
                              value={editVendor}
                              onChange={(e) => setEditVendor(e.target.value)}
                              placeholder="Vendor"
                              className="w-24 px-1.5 py-0.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-blue-500 font-medium"
                            />
                            <datalist id={`vendor-customer-suggestions-${item.item_code}`}>
                              {(customers || []).map(c => (
                                <option key={c.id} value={c.name} />
                              ))}
                            </datalist>
                          </div>
                        ) : (
                          <span className="font-semibold text-slate-800">{item.vendor || '—'}</span>
                        )}
                      </td>
                      
                      {/* Actions Column */}
                      {!po.has_grn && (
                        <td className="px-2.5 py-3 text-center print:hidden">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleSaveInline(item.item_code)}
                                disabled={isSaving}
                                className="p-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200 transition-colors cursor-pointer"
                                title="Save Changes"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={() => setEditingItemCode(null)}
                                disabled={isSaving}
                                className="p-0.5 bg-red-50 hover:bg-red-100 text-red-700 rounded border border-red-200 transition-colors cursor-pointer"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingItemCode(item.item_code);
                                setEditStatus(item.status || 'pending');
                                setEditVendor(item.vendor || '');
                              }}
                              className="p-0.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded border border-transparent hover:border-slate-200 transition-all cursor-pointer inline-flex items-center gap-0.5 text-xs font-bold"
                              title="Edit Status & Vendor"
                            >
                              <Edit2 size={10} /> Edit
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500">No items listed in this Purchase Order.</p>
        )}
      </div>

      {/* Commercial Breakdown */}
      <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200 print:shadow-none print:border print:border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Financial Breakdown</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2.5">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">Items Subtotal:</span>
              <span className="font-mono">₹{calculateTotalItemsAmount(po.items).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">Basic Value (Customizable):</span>
              <span className="font-mono font-bold">₹{basicValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">GST (Tax):</span>
              <span className="font-mono">₹{gstValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">Transport / Freight:</span>
              <span className="font-mono">₹{transportValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">Packing &amp; Forwarding:</span>
              <span className="font-mono">₹{packingValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="font-semibold text-slate-500">Other Charges:</span>
              <span className="font-mono">₹{otherValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t-2 border-slate-100 flex justify-between items-center">
          <span className="text-sm font-extrabold uppercase text-slate-500 tracking-wider">Gross Total PO Value</span>
          <span className="text-2xl font-black text-blue-800">
            ₹{grossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="mt-8 flex items-center justify-end gap-3 print:hidden">
        {po.trade_id && (
          <button
            onClick={() => navigate(`/trace/${encodeURIComponent(po.trade_id)}`)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Eye size={18} /> View Trade Trace
          </button>
        )}
        <button 
          onClick={() => window.print()} 
          className="px-6 py-3 border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Printer size={18} /> Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
