import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';

export default function RFQDetailView({ rfqs, buyers, customers, items }) {
  const { rfq_no } = useParams();
  const navigate = useNavigate();

  const rfq = rfqs.find((r) => r.rfq_no === rfq_no);

  if (!rfq) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f1f5f9] p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">RFQ Not Found</h2>
        <p className="text-slate-600 mb-6">No RFQ record matches the identifier <span className="font-mono bg-slate-100 px-2 py-1 rounded">{rfq_no}</span>.</p>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <ArrowLeft size={18} /> Back
        </button>
      </div>
    );
  }

  const buyer = buyers.find((b) => b.id === rfq.buyer_id);
  const customer = customers.find((c) => c.id === rfq.customer_id);

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

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 bg-[#f1f5f9] min-h-screen">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center text-blue-600 hover:underline mr-4">
          <ArrowLeft size={20} className="mr-1" /> Back
        </button>
        <h1 className="text-3xl font-extrabold text-slate-900">RFQ Detail – {rfq.rfq_no}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow-sm">
        {/* Basic Info */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-3">Basic Information</h2>
          <p><span className="font-semibold">RFQ No:</span> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{rfq.rfq_no}</span></p>
          <p><span className="font-semibold">RFQ Date:</span> {fmtDate(rfq.rfq_date)}</p>
          <p><span className="font-semibold">Commercial Bid Due:</span> {fmtDate(rfq.commercial_bid_due_date)}</p>
          <p><span className="font-semibold">Technical Bid Due:</span> {fmtDate(rfq.technical_bid_due_date)}</p>
        </div>
        {/* Buyer & Customer */}
        <div>
          {rfq.buyer_name || buyer ? (
            <div className="mb-3">
              <p className="font-semibold text-slate-700">Buyer</p>
              <p>{rfq.buyer_name || buyer?.name}</p>
              <p className="text-sm text-slate-500">
                {rfq.buyer_email || buyer?.email} • {rfq.buyer_phone || buyer?.phone}
              </p>
            </div>
          ) : (
            <p className="text-slate-500">Buyer information not available.</p>
          )}
          {rfq.customer_name || customer ? (
            <div>
              <p className="font-semibold text-slate-700">Customer</p>
              <p>{rfq.customer_name || customer?.name} ({rfq.customer_id || customer?.id})</p>
              <p className="text-sm text-slate-500">{rfq.customer_address || customer?.address}</p>
            </div>
          ) : (
            <p className="text-slate-500">Customer information not available.</p>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="mt-8 bg-white p-6 rounded-xl shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Items ({Array.isArray(rfq.items) ? rfq.items.length : 0})</h2>
        {Array.isArray(rfq.items) && rfq.items.length > 0 ? (
          <ul className="divide-y divide-slate-200">
            {rfq.items.map((item) => (
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
                <div className="shrink-0 flex flex-col items-end">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Qty</span>
                  <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-800 font-bold text-sm rounded-lg">{item.quantity || 1}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-500">No items attached to this RFQ.</p>
        )}
      </div>
    </div>
  );
}
