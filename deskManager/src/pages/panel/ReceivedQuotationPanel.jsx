import { FileText, List, Edit2, Building2, User, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmt = (v) => (parseFloat(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function ReceivedQuotationPanel({ receivedQuotation, tradeId }) {
  if (!receivedQuotation) return null;

  const isProcess = receivedQuotation.received_quotation_no?.startsWith('PRQ-') || 
                    (receivedQuotation.items || []).some(i => i.process_name);

  const itemsTotal = (receivedQuotation.items || []).reduce(
    (a, i) => a + (parseFloat(i.unit_price) || 0) * (parseInt(i.quantity) || 0), 0
  );

  const editUrl = isProcess 
    ? `/updateProcessQuotation/${encodeURIComponent(receivedQuotation.received_quotation_no)}?trade_id=${encodeURIComponent(tradeId)}`
    : `/updateReceivedQuotation/${encodeURIComponent(receivedQuotation.received_quotation_no)}?trade_id=${encodeURIComponent(tradeId)}`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          {isProcess ? <Cpu size={15} className="text-amber-600" /> : <FileText size={15} style={{ color: 'var(--theme-color)' }} />}
          {isProcess ? 'Process Quotation' : 'Received Quotation'}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            {receivedQuotation.received_quotation_no}
          </span>
          <Link
            to={editUrl}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Edit2 size={10} /> Edit
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Meta row */}
        <div className="pb-5 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Quotation Date</p>
            <p className="text-sm font-semibold text-slate-800">{fmtDate(receivedQuotation.quotation_date)}</p>
          </div>
        </div>

        {/* Customer / Seller details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-5 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
              <Building2 size={11} /> Customer / Party
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-0.5">
              <p className="text-[10px] font-semibold text-slate-400">ID: <span className="text-slate-700 font-mono font-bold">{receivedQuotation.customer_id}</span></p>
              <p className="text-sm font-bold text-slate-900">{receivedQuotation.customer_name || '—'}</p>
              {receivedQuotation.customer_address && (
                <p className="text-[11px] font-medium text-slate-500 mt-2 pt-2 border-t border-slate-200/60 whitespace-pre-line leading-relaxed">
                  {receivedQuotation.customer_address}
                </p>
              )}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
              <User size={11} /> Process Vendor / Seller
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-0.5">
              <p className="text-sm font-bold text-slate-900">{receivedQuotation.buyer_name || '—'}</p>
              <p className="text-[10px] font-semibold text-slate-400">{receivedQuotation.buyer_email || '—'}</p>
              <p className="text-[10px] font-semibold text-slate-400">{receivedQuotation.buyer_phone || '—'}</p>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
            <List size={11} /> {isProcess ? 'Process Items & Pricing' : 'Received Items & Pricing'} ({(receivedQuotation.items || []).length})
          </p>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Item Code</th>
                  {isProcess && <th className="px-4 py-2.5">Process Name</th>}
                  {isProcess && <th className="px-4 py-2.5">Expected Output</th>}
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
                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border bg-slate-100 border-slate-200 text-slate-800">
                          {item.item_code}
                        </span>
                      </td>
                      {isProcess && (
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                            {item.process_name || '—'}
                          </span>
                        </td>
                      )}
                      {isProcess && (
                        <td className="px-4 py-3 font-mono font-bold text-slate-700">
                          {item.expected_output_code || item.item_code}
                        </td>
                      )}
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
                    <td colSpan={isProcess ? "8" : "6"} className="px-4 py-6 text-center text-slate-400 text-xs font-medium">No items.</td>
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
