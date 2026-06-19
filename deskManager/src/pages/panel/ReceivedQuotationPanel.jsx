import { FileText, List, Edit2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function ReceivedQuotationPanel({ receivedQuotation, tradeId }) {
  if (!receivedQuotation) return null;

  const itemsTotal = (receivedQuotation.items || []).reduce(
    (a, i) => a + (parseFloat(i.unit_price) || 0) * (parseInt(i.quantity) || 0), 0
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <FileText size={14} style={{ color: 'var(--theme-color)' }} />
          Received Quotation
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            {receivedQuotation.received_quotation_no}
          </span>
          <Link
            to={`/updateReceivedQuotation/${receivedQuotation.received_quotation_no}?trade_id=${tradeId}`}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Edit2 size={10} /> Edit
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Meta row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-100">
          {[
            { label: 'Quotation Date', value: fmtDate(receivedQuotation.quotation_date) },
            { label: 'Seller Name',    value: receivedQuotation.buyer_name || '—' },
            { label: 'Customer ID',    value: receivedQuotation.customer_id || '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        {/* Items table */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
            <List size={11} /> Received Items &amp; Pricing ({(receivedQuotation.items || []).length})
          </p>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5">Drawing No.</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit Price</th>
                  <th className="px-4 py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(receivedQuotation.items || []).map((item, idx) => {
                  const lineTotal = (parseFloat(item.unit_price) || 0) * (parseInt(item.quantity) || 0);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border"
                          style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' }}>
                          {item.item_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">{item.drawing_number || '—'}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">{item.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">₹{fmt(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900">₹{fmt(lineTotal)}</td>
                    </tr>
                  );
                })}
                {(receivedQuotation.items || []).length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-6 text-center text-slate-400 text-xs font-medium">No items.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Total */}
          <div className="flex justify-end pt-2 pr-1 text-sm font-bold text-slate-700">
            Total Value: <span className="font-black text-slate-900 ml-2">₹{fmt(itemsTotal)}</span>
          </div>
        </div>

        {/* Terms */}
        {receivedQuotation.terms_and_conditions && (
          <div className="border-t border-slate-100 pt-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Terms &amp; Conditions</p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 font-medium whitespace-pre-line">
              {receivedQuotation.terms_and_conditions}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
