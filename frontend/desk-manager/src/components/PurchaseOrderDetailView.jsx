import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PurchaseOrderDetailView({ purchaseOrders, quotations, rfqs, customers, buyers }) {
  const { po_no } = useParams();
  const navigate = useNavigate();

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
    <div className="max-w-5xl mx-auto p-6 sm:p-8 bg-[#f1f5f9] min-h-screen text-slate-900">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center text-blue-600 hover:underline mr-4 cursor-pointer bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors text-sm font-bold">
          <ArrowLeft size={16} className="mr-1.5" /> Back
        </button>
        <h1 className="text-3xl font-extrabold text-slate-900">Purchase Order Detail – {po.po_no}</h1>
      </div>

      {/* Grid of basic info, customer info, buyer info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-3 border-b border-slate-100 pb-1.5">PO Information</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold text-slate-500">PO No:</span> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded font-bold text-blue-700">{po.po_no}</span></p>
            <p><span className="font-semibold text-slate-500">PO Date:</span> <span className="font-bold">{fmtDate(po.po_date)}</span></p>
            {po.quotation_no && (
              <p>
                <span className="font-semibold text-slate-500">Quotation No:</span>{' '}
                <Link to={`/quotation/${po.quotation_no}`} className="font-mono bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors font-bold">
                  {po.quotation_no}
                </Link>
              </p>
            )}
            {matchedRfq && (
              <p>
                <span className="font-semibold text-slate-500">RFQ No:</span>{' '}
                <Link to={`/rfq/${matchedRfq.rfq_no}`} className="font-mono bg-slate-100 px-2 py-0.5 rounded hover:bg-slate-200 transition-colors font-bold">
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
      <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Ordered Items ({Array.isArray(po.items) ? po.items.length : 0})</h2>
        {Array.isArray(po.items) && po.items.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {po.items.map((item) => (
              <div key={item.item_code} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-blue-700">{item.item_code}</span>
                    {item.drawing_number && (
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">DRW: {item.drawing_number}</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                  )}
                </div>
                <div className="shrink-0 flex gap-6">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Qty</span>
                    <span className="text-slate-800 font-bold text-sm">{item.quantity || 1}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Rate</span>
                    <span className="text-slate-800 font-bold text-sm">₹{parseFloat(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Amount</span>
                    <span className="text-slate-800 font-bold text-sm">₹{((item.quantity || 1) * parseFloat(item.unit_price)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">No items listed in this Purchase Order.</p>
        )}
      </div>

      {/* Commercial Breakdown */}
      <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
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
    </div>
  );
}
