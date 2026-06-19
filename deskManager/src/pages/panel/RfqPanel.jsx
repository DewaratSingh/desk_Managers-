import { Clock, Building2, User, List, Edit2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function RfqPanel({ rfq, tradeId }) {
  if (!rfq) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
        <p className="text-sm text-slate-400 font-semibold">No RFQ details found for this trade.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={14} style={{ color: 'var(--theme-color)' }} />
          Request For Quotation
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            {rfq.rfq_no}
          </span>
          <Link
            to={`/updateRfq/${rfq.rfq_no}`}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Edit2 size={10} /> Edit
          </Link>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Dates row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-100">
          {[
            { label: 'RFQ Date',              value: fmtDate(rfq.rfq_date) },
            { label: 'Commercial Bid Due',    value: fmtDate(rfq.commercial_bid_due_date) },
            { label: 'Technical Bid Due',     value: fmtDate(rfq.technical_bid_due_date) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        {/* Customer / Buyer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pb-5 border-b border-slate-100">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
              <Building2 size={11} /> Customer
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-0.5">
              <p className="text-[10px] font-semibold text-slate-400">ID: <span className="text-slate-700">{rfq.customer_id}</span></p>
              <p className="text-sm font-bold text-slate-900">{rfq.customer_name || '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
              <User size={11} /> Buyer
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-0.5">
              <p className="text-sm font-bold text-slate-900">{rfq.buyer_name || '—'}</p>
              <p className="text-[10px] font-semibold text-slate-400">{rfq.buyer_email || '—'}</p>
              <p className="text-[10px] font-semibold text-slate-400">{rfq.buyer_phone || '—'}</p>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
            <List size={11} /> Requested Items ({(rfq.items || []).length})
          </p>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2.5">Item Code</th>
                  <th className="px-4 py-2.5">Drawing No.</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(rfq.items || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded border"
                        style={{ color: 'var(--theme-color)', borderColor: 'var(--theme-color)', backgroundColor: 'rgba(217,53,45,0.05)' }}>
                        {item.item_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{item.drawing_number || '—'}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{item.description || '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{item.quantity} &bull; {item.unit || 'Pc'}</td>
                  </tr>
                ))}
                {(rfq.items || []).length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-4 py-6 text-center text-slate-400 text-xs font-medium">No items.</td>
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
