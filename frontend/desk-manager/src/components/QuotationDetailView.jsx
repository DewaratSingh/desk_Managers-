import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Printer, FileText, X, CheckCircle2 } from 'lucide-react';

export default function QuotationDetailView({ quotations, rfqs, customers, buyers, onRejectQuotation }) {
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
  const buyer = rfq ? (buyers || []).find((b) => b.id === rfq.buyer_id) : null;

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

  const calculateTotal = (itemsList) => {
    if (!Array.isArray(itemsList)) return 0;
    return itemsList.reduce((sum, i) => sum + (i.quantity || 0) * (parseFloat(i.unit_price) || 0), 0);
  };

  const handleReject = async () => {
    if (window.confirm('Are you sure you want to reject this quotation? This action is permanent and will terminate this trade pipeline.')) {
      if (onRejectQuotation) {
        await onRejectQuotation(quotation.quotation_no);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 bg-[#f1f5f9] print:bg-white print:p-0 min-h-screen">
      <div className="flex items-center mb-6 print:hidden">
        <button onClick={() => navigate(-1)} className="flex items-center text-blue-600 hover:underline mr-4">
          <ArrowLeft size={20} className="mr-1" /> Back
        </button>
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
          Quotation Detail – {quotation.quotation_no}
          {rfq && rfq.status === 'rejected' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-full">
              <X size={12} /> Rejected
            </span>
          )}
          {rfq && rfq.status === 'ordered' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
              <CheckCircle2 size={12} /> Ordered
            </span>
          )}
        </h1>
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-6 hidden print:block">
        Quotation Detail – {quotation.quotation_no}
        {rfq && rfq.status === 'rejected' && ' (Rejected)'}
        {rfq && rfq.status === 'ordered' && ' (Ordered)'}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow-sm print:shadow-none print:border print:border-slate-200">
        {/* Basic Info */}
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-3">Basic Information</h2>
          <p><span className="font-semibold">Quotation No:</span> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{quotation.quotation_no}</span></p>
          <p><span className="font-semibold">Quotation Date:</span> {fmtDate(quotation.quotation_date)}</p>
          <p><span className="font-semibold">RFQ No:</span> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{quotation.rfq_no}</span></p>
        </div>
        {/* Customer & Buyer */}
        <div className="space-y-4">
          {quotation.customer_name || customer ? (
            <div>
              <p className="font-semibold text-slate-700">Customer</p>
              <p>{quotation.customer_name || customer?.name} ({quotation.customer_id || customer?.id})</p>
              <p className="text-sm text-slate-500">{quotation.customer_address || customer?.address}</p>
            </div>
          ) : (
            <p className="text-slate-500">Customer information not available.</p>
          )}
          {quotation.buyer_name || buyer ? (
            <div>
              <p className="font-semibold text-slate-700 border-t border-slate-100 pt-3">Buyer</p>
              <p>{quotation.buyer_name || buyer?.name}</p>
              <p className="text-sm text-slate-500">
                {quotation.buyer_email || buyer?.email} &bull; {quotation.buyer_phone || buyer?.phone}
              </p>
            </div>
          ) : (
            <p className="text-slate-500 border-t border-slate-100 pt-3">Buyer information not available.</p>
          )}
        </div>
      </div>

      {/* Linked Received Quotations */}
      {Array.isArray(quotation.received_quotations) && quotation.received_quotations.length > 0 && (
        <div className="mt-6 bg-white p-6 rounded-xl shadow-sm print:hidden">
          <h2 className="text-xl font-bold text-slate-800 mb-3">Linked Received Quotations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quotation.received_quotations.map((rq) => (
              <div key={rq.received_quotation_no} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex justify-between items-center">
                <div>
                  <span className="font-mono font-extrabold text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded block w-fit">
                    {rq.received_quotation_no}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    Buyer: <span className="font-semibold text-slate-700">{rq.buyer_name || '—'}</span> &bull; Date: {fmtDate(rq.quotation_date)}
                  </p>
                </div>
                <Link
                  to={`/received-quotation/${rq.received_quotation_no}`}
                  className="px-3.5 py-1.5 text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 rounded font-bold transition-colors"
                >
                  View Details
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms and Conditions */}
      {quotation.terms_and_conditions && (
        <div className="mt-6 bg-white p-6 rounded-xl shadow-sm print:shadow-none print:border print:border-slate-200">
           <h2 className="text-xl font-bold text-slate-800 mb-3">Terms &amp; Conditions</h2>
           <pre className="whitespace-pre-wrap text-sm text-slate-600 font-sans">{quotation.terms_and_conditions}</pre>
        </div>
      )}

      {/* Items List */}
      <div className="mt-6 bg-white p-6 rounded-xl shadow-sm print:shadow-none print:border print:border-slate-200">
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
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Qty / Unit</span>
                    <span className="text-slate-800 font-bold text-sm">{item.quantity || 1} {item.unit || 'Piece'}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Price / Unit</span>
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

      {/* Bottom Action Bar */}
      <div className="mt-8 flex items-center justify-end gap-3 print:hidden">
        <button 
          onClick={() => window.print()} 
          className="px-6 py-3 border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Printer size={18} /> Print / Save as PDF
        </button>
        {rfq && rfq.status !== 'ordered' && rfq.status !== 'rejected' && (
          <button 
            onClick={handleReject}
            className="px-6 py-3 border-2 border-red-300 hover:border-red-400 hover:bg-red-50 text-red-600 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <X size={18} /> Reject Quotation
          </button>
        )}
        {(!rfq || (rfq.status !== 'ordered' && rfq.status !== 'rejected')) && (
          <button 
            onClick={() => navigate('/', { state: { activeTab: 'purchase-order', prefillQuotationNo: quotation.quotation_no } })}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileText size={18} /> Make Purchase Order
          </button>
        )}
      </div>
    </div>
  );
}
