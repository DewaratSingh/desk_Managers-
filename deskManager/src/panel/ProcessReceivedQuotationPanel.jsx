import React from 'react';
import { Workflow, Building2, User, List, Edit2, ShoppingCart, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtCurrency = (val) => {
  const num = parseFloat(val);
  if (isNaN(num)) return '—';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ProcessReceivedQuotationPanel({ receivedQuotation, processReceivedQuotation, tradeId, hasPoDoc }) {
  const data = receivedQuotation || processReceivedQuotation;

  if (!data) {
    return (
      <div className=" bg-[white] border border-slate-200 rounded-xl p-10 text-center shadow-sm">
        <p className="text-sm text-slate-400 font-semibold">No Buy Process Received Quotation details found for this trade.</p>
      </div>
    );
  }

  const qtnNo = data.quotation_number || data.quotation_no || data.received_quotation_no;
  const items = Array.isArray(data.items) ? data.items : [];

  const totalAmount = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity ?? item.QTY ?? 0);
    const prc = parseFloat(item.price ?? 0);
    return sum + (qty * prc);
  }, 0);

  return (
    <div className=" bg-[white] border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-amber-100 text-amber-700">
            <Workflow size={14} />
          </span>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Buy Process Received Quotation
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
            {qtnNo}
          </span>
          <Link
            to={`/updateProcessReceivedQuotation/${encodeURIComponent(qtnNo || data.id)}`}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600  bg-[white] border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Edit2 size={10} /> Edit
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Next Step Action Banner */}
        {!hasPoDoc && (
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div>
              <p className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <ShoppingCart size={14} className="text-amber-700" /> Next Step: Process Purchase Order (PO)
              </p>
              <p className="text-[11px] font-semibold text-amber-800 mt-0.5">
                Process Received Quotation registered. Proceed to generate the Process Purchase Order with auto-filled target items and inventory job.
              </p>
            </div>
            <Link
              to={`/addProcessPurchaseOrder?quotation_no=${encodeURIComponent(qtnNo || '')}&trade_id=${encodeURIComponent(tradeId || '')}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer shrink-0"
              style={{ backgroundColor: 'var(--theme-color)' }}
            >
              <Plus size={14} /> Create Process PO
            </Link>
          </div>
        )}

        {/* Dates row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-100">
          {[
            { label: 'Quotation Date',     value: fmtDate(data.quotation_date || data.date) },
            { label: 'Commercial Bid Due', value: fmtDate(data.commercial_bid_due_date) },
            { label: 'Technical Bid Due',  value: fmtDate(data.technical_bid_due_date) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        {/* Customer / Buyer Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-5 border-b border-slate-100">
          {/* Customer / Supplier */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
              <Building2 size={11} /> Customer / Supplier
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-0.5">
              <p className="text-[10px] font-semibold text-slate-400">
                ID / Code: <span className="text-slate-700 font-mono font-bold">{data.customer_code || data.customer_id}</span>
              </p>
              <p className="text-sm font-bold text-slate-900">{data.customer_name || '—'}</p>
              {data.customer_address && (
                <p className="text-[11px] font-medium text-slate-500 mt-2 pt-2 border-t border-slate-200/60 whitespace-pre-line leading-relaxed">
                  {data.customer_address}
                </p>
              )}
            </div>
          </div>

          {/* Buyer */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
              <User size={11} /> Buyer
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-0.5">
              <p className="text-sm font-bold text-slate-900">{data.buyer_name || '—'}</p>
              <p className="text-[10px] font-semibold text-slate-400">{data.buyer_email || '—'}</p>
              <p className="text-[10px] font-semibold text-slate-400">{data.buyer_phone || '—'}</p>
            </div>
          </div>
        </div>

        {/* Attached Process Items Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <List size={11} /> Process Items ({items.length})
            </p>
            {totalAmount > 0 && (
              <span className="text-xs font-bold text-slate-700">
                Total Estimated: <span className="text-emerald-700">{fmtCurrency(totalAmount)}</span>
              </span>
            )}
          </div>

          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5">Drawing No.</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5">Process Name</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Price</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100  bg-[white]">
                {items.map((item, idx) => {
                  const qty = parseFloat(item.quantity ?? item.QTY ?? 0);
                  const prc = parseFloat(item.price ?? 0);
                  const subtotal = qty * prc;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border text-amber-800 border-amber-300 bg-amber-50">
                          {item.item_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">{item.drawing_number || '—'}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{item.description || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {item.process_name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{qty}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{fmtCurrency(prc)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{fmtCurrency(subtotal)}</td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-4 py-6 text-center text-slate-400 text-xs font-medium">
                      No items attached to this Process Received Quotation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
