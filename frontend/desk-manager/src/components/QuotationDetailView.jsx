import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function QuotationDetailView({ quotations, rfqs, customers }) {
  const { quotation_no } = useParams();
  const navigate = useNavigate();

  const quotation = quotations.find((q) => q.quotation_no === quotation_no);

  if (!quotation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f1f5f9] p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Quotation Not Found</h2>
        <p className="text-slate-600 mb-6">No Quotation record matches the identifier <span className="font-mono bg-slate-100 px-2 py-1 rounded">{quotation_no}</span>.</p>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <ArrowLeft size={18} /> Back
        </button>
      </div>
    );
  }

  const rfq = rfqs.find((r) => r.rfq_no === quotation.rfq_no);
  const customer = rfq ? customers.find((c) => c.id === rfq.customer_id) : null;

  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const calculateTotal = (itemsList) => {
    if (!Array.isArray(itemsList)) return 0;
    return itemsList.reduce((sum, i) => sum + (i.quantity || 0) * (parseFloat(i.unit_price) || 0), 0);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 bg-[#f1f5f9] min-h-screen">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center text-blue-600 hover:underline mr-4">
          <ArrowLeft size={20} className="mr-1" /> Back
        </button>
        <h1 className="text-3xl font-extrabold text-slate-900">Quotation Detail – {quotation.quotation_no}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow-sm">
        {/* Basic Info */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-3">Basic Information</h2>
          <p><span className="font-semibold">Quotation No:</span> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{quotation.quotation_no}</span></p>
          <p><span className="font-semibold">Quotation Date:</span> {fmtDate(quotation.quotation_date)}</p>
          <p><span className="font-semibold">RFQ No:</span> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{quotation.rfq_no}</span></p>
        </div>
        {/* Customer */}
        <div>
          {quotation.customer_name || customer ? (
            <div>
              <p className="font-semibold text-slate-700">Customer</p>
              <p>{quotation.customer_name || customer?.name} ({quotation.customer_id || customer?.id})</p>
              <p className="text-sm text-slate-500">{quotation.customer_address || customer?.address}</p>
            </div>
          ) : (
            <p className="text-slate-500">Customer information not available.</p>
          )}
        </div>
      </div>

      {/* Terms and Conditions */}
      {quotation.terms_and_conditions && (
        <div className="mt-6 bg-white p-6 rounded-xl shadow-sm">
           <h2 className="text-xl font-bold text-slate-800 mb-3">Terms &amp; Conditions</h2>
           <pre className="whitespace-pre-wrap text-sm text-slate-600 font-sans">{quotation.terms_and_conditions}</pre>
        </div>
      )}

      {/* Items List */}
      <div className="mt-6 bg-white p-6 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Items ({Array.isArray(quotation.items) ? quotation.items.length : 0})</h2>
        {Array.isArray(quotation.items) && quotation.items.length > 0 ? (
          <ul className="divide-y divide-slate-200">
            {quotation.items.map((item) => (
              <li key={item.item_code} className="py-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-mono font-bold text-sm text-blue-700">{item.item_code}</p>
                  {item.drawing_number && (
                    <p className="text-xs text-slate-500">DRW: {item.drawing_number}</p>
                  )}
                  {item.description && (
                    <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                  )}
                </div>
                <div className="shrink-0 flex gap-6">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Qty</span>
                    <span className="text-slate-800 font-bold text-sm">{item.quantity || 1}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Price</span>
                    <span className="text-slate-800 font-bold text-sm">₹{parseFloat(item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Amount</span>
                    <span className="text-slate-800 font-bold text-sm">₹{((item.quantity || 1) * parseFloat(item.unit_price)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">No items attached to this quotation.</p>
        )}
        <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
            <p className="text-xl font-bold text-slate-800">Total: ₹{calculateTotal(quotation.items).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>
    </div>
  );
}
